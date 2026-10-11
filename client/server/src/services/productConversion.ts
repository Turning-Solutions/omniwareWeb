import crypto from 'crypto';
import mongoose from 'mongoose';
import Product from '../models/Product';
import '../models/Brand';
import CategoryAttributeTemplate from '../models/CategoryAttributeTemplate';
import CategoryFeaturedSpecs from '../models/CategoryFeaturedSpecs';
import ProductConversion, { type IConversionExisting, type IConversionField } from '../models/ProductConversion';
import { getCategoryTreeIds } from '../utils/categoryTree';
import { attributeLooseKey, attributeMatchKey } from '../../../lib/attributeMatchKey';
import { listOccurrences, occurrenceKey, specKeyFor, syncFeaturedKeys, type LeanProduct, type Occurrence } from './attributeProposals';
import { generateJson, getActiveAi, chunkSizeFor, type ActiveAi } from './aiProviders';
import { clearFeaturedSpecsCache } from '../controllers/productController';

/**
 * Convert products to their category's standard detail list (e.g. the 16 RAM fields):
 *   1. the AI decides which of the product's existing details belongs in each standard field —
 *      it never writes values: the server copies the chosen detail's value exactly as it is,
 *   2. the admin checks the values, decides which old details to keep, and approves,
 *   3. approval writes the standard fields as the product's specifications (in list order, with
 *      proper display names) and removes the old details that weren't kept. Undo restores them.
 * Values are never changed, reformatted or invented. A field with no matching detail stays empty.
 */

export class ConversionError extends Error {
    constructor(message: string, public status = 400) {
        super(message);
        this.name = 'ConversionError';
    }
}

type ConvProduct = LeanProduct & { specLabels?: Record<string, string> };
type TemplateField = { name: string; description?: string };


/** Stable fingerprint of a product's details, to detect edits made after the AI read it. */
export function fingerprint(p: Pick<ConvProduct, 'specs' | 'attributeGroups' | 'attributes'>): string {
    const data = {
        specs: Object.entries(p.specs ?? {}).map(([k, v]) => [k, String(v ?? '')]),
        groups: (p.attributeGroups ?? []).map((g) => ({
            c: g.category ?? '',
            a: (g.attributes ?? []).map((a) => [a.name ?? '', a.value ?? '']),
        })),
        legacy: (p.attributes ?? []).map((a) => [a.name ?? '', a.value ?? '']),
    };
    return crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex');
}

async function loadTemplate(categoryId: mongoose.Types.ObjectId): Promise<TemplateField[]> {
    const template = await CategoryAttributeTemplate.findOne({ categoryId }).lean();
    const fields = (template?.attributes ?? []).filter((a) => a.name?.trim());
    if (!fields.length) throw new ConversionError('Add the standard list for this category first (step 2).', 400);
    return fields;
}

/** Products per AI request: fewer for providers with tight tokens-per-minute limits. */
const productsPerRequest = (active: ActiveAi) =>
    Math.max(1, Number(process.env.AI_PRODUCTS_PER_REQUEST) || Math.round(chunkSizeFor(active.provider) / 4) || 3);

// ---------------------------------------------------------------------------------------------
// AI prompt
// ---------------------------------------------------------------------------------------------

const SYSTEM_INSTRUCTION = `You match a computer-hardware product's existing details to a store's standard specification list.
For each product you get its title, brand and existing details (name + value; brands name things inconsistently).
For EVERY field in the standard list, say which ONE existing detail of that product holds that field's information.

Rules:
- You only choose a detail by its exact name. You never write, change or combine values — the value is copied as it is.
- Choose a detail only if its value is what the field means (look at the value, not just the name). The field's example
  shows what such a value usually looks like; the product's value may be written differently, that's fine.
- If no single existing detail holds that information, leave "source" empty. Don't use the title, don't work anything out.
- Use each existing detail for at most one field unless it really is the same information.
- "confidence": "low" when you are unsure; explain briefly in "note".
- Return every standard field for every product, with field names and productId exactly as given.`;

const JSON_SHAPE_HINT = `Respond with ONLY one JSON object — no prose, no markdown, no code fences — shaped exactly like:
{"products":[{"productId":"<id as given>","fields":[{"name":"<standard field name>","source":"<exact name of the existing detail, or empty>","confidence":"high|low","note":"<only if unsure>"}]}]}`;

const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        products: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    productId: { type: 'STRING' },
                    fields: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                name: { type: 'STRING' },
                                source: { type: 'STRING' },
                                confidence: { type: 'STRING', enum: ['high', 'low'] },
                                note: { type: 'STRING' },
                            },
                            required: ['name', 'source', 'confidence'],
                        },
                    },
                },
                required: ['productId', 'fields'],
            },
        },
    },
    required: ['products'],
};

type AiField = { name?: string; source?: unknown; confidence?: string; note?: string };
type AiAnswer = { products?: { productId?: string; fields?: AiField[] }[] };

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function buildPrompt(categoryName: string, template: TemplateField[], products: { id: string; p: ConvProduct; occs: Occurrence[] }[]) {
    return [
        `Product category: ${categoryName}`,
        '',
        'Standard list (for every field pick the existing detail that holds it; "example" shows a typical value):',
        JSON.stringify(template.map((t) => ({ name: t.name, example: t.description ?? '' }))),
        '',
        `Products (${products.length}):`,
        JSON.stringify(
            products.map(({ id, p, occs }) => ({
                productId: id,
                title: p.title ?? '',
                brand: p.brandId?.name ?? '',
                details: occs.map((o) => ({
                    name: o.name,
                    value: truncate(o.value.replace(/\s*\n\s*/g, ' / '), 400),
                    section: o.container === 'specs' ? 'Key specs' : o.groupName,
                })),
            }))
        ),
    ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Validate the AI's answer for one product against the product's real data
// ---------------------------------------------------------------------------------------------

/** The value exactly as stored on the product for a detail id (see occurrenceKey). */
export function rawValueOf(p: ConvProduct, id: string): string | undefined {
    const [kind, a, b] = id.split('|');
    if (kind === 's') {
        const v = p.specs?.[id.slice(2)];
        return v == null ? undefined : String(v);
    }
    if (kind === 'g') return p.attributeGroups?.[Number(a)]?.attributes?.[Number(b)]?.value ?? undefined;
    if (kind === 'l') return p.attributes?.[Number(a)]?.value ?? undefined;
    return undefined;
}

export function buildConversion(p: ConvProduct, template: TemplateField[], aiFields: AiField[] | undefined) {
    const occs = listOccurrences(p);
    const byName = new Map<string, Occurrence>();
    for (const o of occs) {
        const key = attributeMatchKey(o.name);
        if (key && !byName.has(key)) byName.set(key, o);
    }
    const standardSpecKeys = new Map(template.map((t) => [specKeyFor(t.name), t.name]));

    const picks = template.map((t) => {
        const ai = (aiFields ?? []).find((f) => attributeLooseKey(f.name) === attributeLooseKey(t.name));
        const sourceName = String(ai?.source ?? '').trim();
        // Only a real detail of this product can be chosen; anything else (title, made-up names) is ignored.
        const occ = sourceName ? byName.get(attributeMatchKey(sourceName)) : undefined;
        return { t, occ, low: String(ai?.confidence ?? '').toLowerCase() === 'low', note: ai?.note?.trim() || undefined };
    });
    const useCount = new Map<string, number>();
    for (const { occ } of picks) if (occ) useCount.set(occurrenceKey(occ), (useCount.get(occurrenceKey(occ)) ?? 0) + 1);

    const fields: IConversionField[] = picks.map(({ t, occ, low, note }) => {
        if (!occ) return { name: t.name, value: '', basis: 'missing', sources: [], check: false };
        const id = occurrenceKey(occ);
        return {
            name: t.name,
            value: rawValueOf(p, id) ?? occ.value,
            basis: 'copied',
            sources: [{ id, name: occ.name, value: occ.value }],
            note,
            // Unsure, or the same detail used for two fields — worth a look.
            check: low || (useCount.get(id) ?? 0) > 1,
        };
    });

    const existing: IConversionExisting[] = occs.map((o) => {
        const id = occurrenceKey(o);
        return {
            id,
            container: o.container,
            groupName: o.container === 'specs' ? undefined : o.groupName,
            name: o.name,
            value: o.value,
            usedFor: fields.filter((f) => f.sources.some((s) => s.id === id)).map((f) => f.name),
            replaced: o.container === 'specs' && standardSpecKeys.has(o.key ?? ''),
            keep: false,
        };
    });

    return { fields, existing, needsLook: fields.some((f) => f.check) };
}

// ---------------------------------------------------------------------------------------------
// Queue + AI processing
// ---------------------------------------------------------------------------------------------

/** Put the category's products in the queue for the AI (approved ones are left alone). */
export async function queueConversions(category: { _id: mongoose.Types.ObjectId }, opts: { redoAll?: boolean } = {}) {
    await loadTemplate(category._id);
    const treeIds = await getCategoryTreeIds(category._id);
    const products = await Product.find({ categoryIds: { $in: treeIds } }, 'title images brandId')
        .populate('brandId', 'name')
        .lean<ConvProduct[]>();
    const existing = new Map(
        (await ProductConversion.find({ categoryId: category._id }, 'productId status').lean()).map((c) => [String(c.productId), c.status])
    );

    const writes: mongoose.AnyBulkWriteOperation[] = [];
    for (const p of products) {
        const status = existing.get(String(p._id));
        if (status === 'approved') continue;
        if (!opts.redoAll && (status === 'pending' || status === 'skipped' || status === 'queued')) continue;
        writes.push({
            updateOne: {
                filter: { categoryId: category._id, productId: p._id },
                update: {
                    $set: {
                        categoryId: category._id,
                        productId: p._id,
                        productTitle: p.title ?? '',
                        brand: p.brandId?.name?.trim() || 'Unknown brand',
                        image: p.images?.[0],
                        status: 'queued',
                        fields: [],
                        existing: [],
                        needsLook: false,
                    },
                    $unset: { error: 1, skippedAt: 1 },
                },
                upsert: true,
            },
        });
    }
    if (writes.length) await ProductConversion.bulkWrite(writes, { ordered: false });
    const queued = await ProductConversion.countDocuments({ categoryId: category._id, status: 'queued' });
    return { products: products.length, queued };
}

/** Ask the AI about the given queued conversions (one request) and store the results for review. */
async function processConversions(
    category: { _id: mongoose.Types.ObjectId; name: string },
    docs: { _id: mongoose.Types.ObjectId; productId: mongoose.Types.ObjectId }[]
) {
    const active = await getActiveAi();
    if (!active.configured) throw new ConversionError(`${active.provider.label} is not set up — choose an AI model first.`, 400);
    const template = await loadTemplate(category._id);

    const products = await Product.find({ _id: { $in: docs.map((d) => d.productId) } }, 'title images brandId specs attributeGroups attributes')
        .populate('brandId', 'name')
        .lean<ConvProduct[]>();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const input = docs
        .map((d) => ({ id: String(d.productId), p: byId.get(String(d.productId)) }))
        .filter((x): x is { id: string; p: ConvProduct } => Boolean(x.p))
        .map((x) => ({ ...x, occs: listOccurrences(x.p) }));

    const answer = input.length
        ? await generateJson<AiAnswer>(active, {
              systemInstruction: SYSTEM_INSTRUCTION,
              prompt: buildPrompt(category.name, template, input),
              responseSchema: RESPONSE_SCHEMA,
              jsonShapeHint: JSON_SHAPE_HINT,
          })
        : { products: [] };
    const results = new Map((Array.isArray(answer.products) ? answer.products : []).map((r) => [String(r.productId ?? ''), r]));

    for (const d of docs) {
        const p = byId.get(String(d.productId));
        if (!p) {
            await ProductConversion.updateOne({ _id: d._id }, { $set: { status: 'failed', error: 'This product no longer exists.' } });
            continue;
        }
        const result = results.get(String(d.productId));
        if (!result || !Array.isArray(result.fields)) {
            await ProductConversion.updateOne(
                { _id: d._id },
                { $set: { status: 'failed', error: 'The AI returned nothing for this product. Ask the AI again.' } }
            );
            continue;
        }
        const conv = buildConversion(p, template, result.fields);
        await ProductConversion.updateOne(
            { _id: d._id },
            {
                $set: {
                    status: 'pending',
                    fields: conv.fields,
                    existing: conv.existing,
                    needsLook: conv.needsLook,
                    productTitle: p.title ?? '',
                    image: p.images?.[0],
                    aiModel: `${active.provider.id}:${active.model}`,
                    sourceFingerprint: fingerprint(p),
                },
                $unset: { error: 1 },
            }
        );
    }
}

/** Process the next batch of queued products (one AI request). Call repeatedly until `remaining` is 0. */
export async function processNextBatch(category: { _id: mongoose.Types.ObjectId; name: string }) {
    const active = await getActiveAi();
    const batch = await ProductConversion.find({ categoryId: category._id, status: 'queued' }, '_id productId')
        .sort({ _id: 1 })
        .limit(productsPerRequest(active))
        .lean();
    if (batch.length) await processConversions(category, batch);
    const remaining = await ProductConversion.countDocuments({ categoryId: category._id, status: 'queued' });
    return { processed: batch.length, remaining };
}

/** Ask the AI again for a single product. */
export async function redoConversion(id: string, category: { _id: mongoose.Types.ObjectId; name: string }) {
    const conv = await ProductConversion.findById(id);
    if (!conv) throw new ConversionError('This product is no longer in the list.', 404);
    if (conv.status === 'approved') throw new ConversionError('Undo the approved changes first.', 409);
    await processConversions(category, [{ _id: conv._id as mongoose.Types.ObjectId, productId: conv.productId }]);
}

// ---------------------------------------------------------------------------------------------
// Approve / leave unchanged / undo
// ---------------------------------------------------------------------------------------------

/** Featured spec keys (shop filters) follow the conversion: new keys added, unused old ones dropped. */
async function syncFilters(renames: { from: string; to: string }[], removedKeys: string[]) {
    await syncFeaturedKeys(renames);
    for (const key of removedKeys) {
        if (await Product.exists({ [`specs.${key}`]: { $exists: true } })) continue;
        const configs = await CategoryFeaturedSpecs.find({ featuredSpecKeys: key });
        for (const cfg of configs) {
            cfg.featuredSpecKeys = cfg.featuredSpecKeys.filter((k) => k !== key);
            await cfg.save();
            clearFeaturedSpecsCache(cfg.categoryKey);
        }
    }
}

/**
 * What the product's details become on approval (pure — no database). The standard fields become the
 * specifications in list order with display names; old details survive only when kept.
 */
export function planApproval(product: ConvProduct, fields: IConversionField[], existing: IConversionExisting[], keepIds: Set<string>) {
    const specEntries: [string, string][] = [];
    const specLabels: Record<string, string> = {};
    for (const f of fields) {
        if (!f.value) continue;
        const key = specKeyFor(f.name);
        specEntries.push([key, f.value]);
        specLabels[key] = f.name;
    }
    const usedKeys = new Set(specEntries.map(([k]) => k));
    for (const x of existing) {
        if (!keepIds.has(x.id) || x.replaced || x.container !== 'specs') continue;
        const key = x.id.slice(2);
        if (usedKeys.has(key)) throw new ConversionError(`"${x.name}" can't be kept: it has the same name as a standard field.`, 400);
        specEntries.push([key, String(product.specs?.[key] ?? x.value)]);
        usedKeys.add(key);
    }
    if (!specEntries.length) throw new ConversionError('Every standard field is empty — fill at least one, or leave the product unchanged.', 400);

    // Old details: only the kept ones stay, in their original sections and order.
    const attributeGroups = (product.attributeGroups ?? [])
        .map((g, gi) => ({ ...g, attributes: (g.attributes ?? []).filter((_, ai) => keepIds.has(`g|${gi}|${ai}`)) }))
        .filter((g) => g.attributes.length > 0);
    // The legacy list is an old hidden copy that the site shows (as "General") whenever a product has no
    // sections — so when the product has sections it must be cleared too, or removed details come back.
    const attributes = product.attributeGroups?.length
        ? []
        : (product.attributes ?? []).filter((_, ai) => keepIds.has(`l|${ai}`));

    return { specs: Object.fromEntries(specEntries), specLabels, attributeGroups, attributes, usedKeys };
}

export async function approveConversion(
    id: string,
    actorEmail: string | undefined,
    edits: { fields?: { name: string; sourceId?: string; value?: string }[]; keep?: string[] } = {}
) {
    const conv = await ProductConversion.findById(id);
    if (!conv) throw new ConversionError('This product is no longer in the list.', 404);
    if (conv.status === 'approved') throw new ConversionError('This product is already converted.', 409);
    if (conv.status !== 'pending' && conv.status !== 'skipped') throw new ConversionError('The AI hasn\'t prepared this product yet.', 409);

    const product = await Product.findById(conv.productId).lean<ConvProduct>();
    if (!product) throw new ConversionError('This product no longer exists.', 404);
    if (conv.sourceFingerprint && fingerprint(product) !== conv.sourceFingerprint) {
        throw new ConversionError('This product was edited after the AI read it. Use "Ask AI again" first.', 409);
    }

    const occs = new Map(listOccurrences(product).map((o) => [occurrenceKey(o), o]));
    const fields = (conv.toObject().fields as IConversionField[]).map((f) => ({ ...f }));
    for (const e of edits.fields ?? []) {
        const f = fields.find((x) => x.name === e.name);
        if (!f) continue;
        // A value typed by the admin is used as typed (only the AI is barred from writing values).
        if (e.value !== undefined) {
            const value = e.value.trim().slice(0, 1000);
            Object.assign(f, value ? { value, basis: 'typed', sources: [], check: false } : { value: '', basis: 'missing', sources: [], check: false });
            continue;
        }
        e.sourceId = e.sourceId ?? '';
        if (e.sourceId === (f.sources[0]?.id ?? '')) continue;
        if (!e.sourceId) {
            Object.assign(f, { value: '', basis: 'missing', sources: [], check: false });
            continue;
        }
        const occ = occs.get(e.sourceId);
        if (!occ) throw new ConversionError(`The detail chosen for "${f.name}" is no longer on this product.`, 409);
        Object.assign(f, {
            value: rawValueOf(product, e.sourceId) ?? occ.value,
            basis: 'copied',
            sources: [{ id: e.sourceId, name: occ.name, value: occ.value }],
            check: false, // the admin chose it
        });
    }
    const existing = (conv.toObject().existing as IConversionExisting[]).map((x) => ({
        ...x,
        usedFor: fields.filter((f) => f.sources.some((s) => s.id === x.id)).map((f) => f.name),
    }));
    const keepIds = new Set(edits.keep ?? existing.filter((x) => x.keep).map((x) => x.id));
    for (const x of existing) x.keep = keepIds.has(x.id) && !x.replaced;

    const { specs, specLabels, attributeGroups, attributes, usedKeys } = planApproval(product, fields, existing, keepIds);

    const before = {
        specs: product.specs ?? {},
        specLabels: product.specLabels ?? {},
        attributeGroups: product.attributeGroups ?? [],
        attributes: product.attributes ?? [],
    };
    await Product.updateOne({ _id: product._id }, { $set: { specs, specLabels, attributeGroups, attributes } });

    // Shop filters: a featured old key whose information moved into a standard field follows it.
    const renames: { from: string; to: string }[] = [];
    for (const f of fields) {
        if (!f.value) continue;
        for (const s of f.sources) {
            if (!s.id.startsWith('s|')) continue;
            const from = s.id.slice(2);
            const to = specKeyFor(f.name);
            if (from !== to && !usedKeys.has(from)) renames.push({ from, to });
        }
    }
    const removedKeys = Object.keys(product.specs ?? {}).filter((k) => !usedKeys.has(k));
    await syncFilters(renames, removedKeys);

    conv.set({
        status: 'approved',
        fields,
        existing,
        before,
        afterFingerprint: fingerprint({ specs, attributeGroups, attributes }),
        approvedAt: new Date(),
        approvedBy: actorEmail,
        needsLook: false,
    });
    conv.set('skippedAt', undefined);
    await conv.save();
    return { productId: String(product._id), title: conv.productTitle, before, after: { specs, attributeGroups, attributes } };
}

/**
 * Products approved before the fix above may still carry the old hidden copy, which shows up as "General".
 * Clear it on those products — only where the product hasn't been edited since approval (undo still restores it).
 */
export async function repairLegacyCopies(categoryId: mongoose.Types.ObjectId): Promise<number> {
    const approved = await ProductConversion.find({ categoryId, status: 'approved' }, 'productId before afterFingerprint');
    let fixed = 0;
    for (const conv of approved) {
        const before = conv.before as { attributeGroups?: unknown[] } | undefined;
        if (!before?.attributeGroups?.length) continue; // legacy-only products were handled by "Keep" at approval
        const product = await Product.findById(conv.productId, 'specs attributeGroups attributes').lean<ConvProduct>();
        if (!product?.attributes?.length) continue;
        if (conv.afterFingerprint && fingerprint(product) !== conv.afterFingerprint) continue; // edited since — leave it
        await Product.updateOne({ _id: product._id }, { $set: { attributes: [] } });
        conv.set('afterFingerprint', fingerprint({ ...product, attributes: [] }));
        await conv.save();
        fixed += 1;
    }
    return fixed;
}

export async function skipConversion(id: string) {
    const conv = await ProductConversion.findById(id);
    if (!conv) throw new ConversionError('This product is no longer in the list.', 404);
    if (conv.status === 'approved') throw new ConversionError('Undo the approved changes first.', 409);
    conv.set({ status: 'skipped', skippedAt: new Date() });
    await conv.save();
}

/** Undo an approved conversion: the product's previous details come back exactly as they were. */
export async function undoConversion(id: string) {
    const conv = await ProductConversion.findById(id);
    if (!conv) throw new ConversionError('This product is no longer in the list.', 404);
    if (conv.status !== 'approved' || !conv.before) throw new ConversionError('This product is not converted.', 409);

    const product = await Product.findById(conv.productId).lean<ConvProduct>();
    if (!product) throw new ConversionError('This product no longer exists.', 404);
    if (conv.afterFingerprint && fingerprint(product) !== conv.afterFingerprint) {
        throw new ConversionError('This product was edited after it was converted, so it can\'t be undone automatically. Edit it in the product editor instead.', 409);
    }

    const before = conv.before as { specs: Record<string, string>; specLabels: Record<string, string>; attributeGroups: unknown[]; attributes: unknown[] };
    const currentKeys = Object.keys(product.specs ?? {});
    await Product.updateOne(
        { _id: product._id },
        { $set: { specs: before.specs, specLabels: before.specLabels, attributeGroups: before.attributeGroups, attributes: before.attributes } }
    );

    const restoredKeys = new Set(Object.keys(before.specs ?? {}));
    const renames: { from: string; to: string }[] = [];
    const fields = conv.toObject().fields as IConversionField[];
    for (const f of fields) {
        if (!f.value) continue;
        for (const s of f.sources) {
            if (s.id.startsWith('s|') && s.id.slice(2) !== specKeyFor(f.name)) renames.push({ from: specKeyFor(f.name), to: s.id.slice(2) });
        }
    }
    await syncFilters(renames, currentKeys.filter((k) => !restoredKeys.has(k)));

    conv.set({ status: 'pending', revertedAt: new Date() });
    for (const key of ['before', 'afterFingerprint', 'approvedAt', 'approvedBy'] as const) conv.set(key, undefined);
    await conv.save();
    return { productId: String(product._id), title: conv.productTitle };
}

// ---------------------------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------------------------

export async function listConversions(categoryId: mongoose.Types.ObjectId) {
    const items = await ProductConversion.aggregate([
        { $match: { categoryId } },
        // Current SKUs straight from the product (main + variant + colour SKUs), so the list can be searched by SKU.
        {
            $lookup: {
                from: Product.collection.name,
                localField: 'productId',
                foreignField: '_id',
                pipeline: [{ $project: { sku: 1, 'variants.sku': 1, 'colorVariants.sku': 1 } }],
                as: 'product',
            },
        },
        {
            $project: {
                productId: 1,
                sku: { $arrayElemAt: ['$product.sku', 0] },
                variantSkus: {
                    $concatArrays: [
                        { $ifNull: [{ $arrayElemAt: ['$product.variants.sku', 0] }, []] },
                        { $ifNull: [{ $arrayElemAt: ['$product.colorVariants.sku', 0] }, []] },
                    ],
                },
                title: '$productTitle',
                brand: 1,
                image: 1,
                status: 1,
                needsLook: 1,
                error: 1,
                filled: { $size: { $filter: { input: '$fields', as: 'f', cond: { $ne: ['$$f.value', ''] } } } },
                fieldCount: { $size: '$fields' },
                removing: { $size: { $filter: { input: '$existing', as: 'x', cond: { $eq: ['$$x.keep', false] } } } },
            },
        },
        { $sort: { needsLook: -1, brand: 1, title: 1 } },
        { $limit: 3000 },
    ]);
    return items.map((i) => ({
        id: String(i._id),
        productId: String(i.productId),
        title: i.title as string,
        sku: (i.sku as string | undefined) || undefined,
        skus: [i.sku, ...((i.variantSkus as (string | null)[] | undefined) ?? [])].filter((x): x is string => typeof x === 'string' && x.trim() !== ''),
        brand: i.brand as string,
        image: i.image as string | undefined,
        status: i.status as 'queued' | 'pending' | 'approved' | 'skipped' | 'failed',
        needsLook: Boolean(i.needsLook),
        error: i.error as string | undefined,
        filled: i.filled as number,
        fieldCount: i.fieldCount as number,
        removing: i.removing as number,
    }));
}

export async function getConversionDetail(id: string) {
    const conv = await ProductConversion.findById(id).lean();
    if (!conv) throw new ConversionError('This product is no longer in the list.', 404);
    const [product, template] = await Promise.all([
        Product.findById(conv.productId, 'title slug images specs attributeGroups attributes').lean<ConvProduct>(),
        CategoryAttributeTemplate.findOne({ categoryId: conv.categoryId }).lean(),
    ]);
    const examples = new Map((template?.attributes ?? []).map((a) => [a.name, a.description ?? '']));

    let staleMessage: string | undefined;
    if (!product) staleMessage = 'This product no longer exists.';
    else if (conv.status === 'pending' && conv.sourceFingerprint && fingerprint(product) !== conv.sourceFingerprint) {
        staleMessage = 'This product was edited after the AI read it. Use "Ask AI again" to refresh.';
    }

    return {
        id: String(conv._id),
        productId: String(conv.productId),
        productSlug: product?.slug,
        title: product?.title ?? conv.productTitle,
        brand: conv.brand,
        image: product?.images?.[0] ?? conv.image,
        status: conv.status,
        needsLook: conv.needsLook,
        error: conv.error,
        aiModel: conv.aiModel,
        fields: (conv.fields ?? []).map((f) => ({ ...f, example: examples.get(f.name) ?? '' })),
        existing: conv.existing ?? [],
        approvedAt: conv.approvedAt,
        approvedBy: conv.approvedBy,
        stale: Boolean(staleMessage),
        staleMessage,
    };
}

/**
 * Values already used for each standard field across the category (approved products first, then the
 * AI's prepared ones) — offered as suggestions when the admin types a value, so products stay consistent.
 */
export async function usedFieldValues(categoryId: mongoose.Types.ObjectId) {
    const rows = await ProductConversion.aggregate<{ _id: string; values: { value: string; count: number }[] }>([
        { $match: { categoryId, status: { $in: ['approved', 'pending'] } } },
        { $unwind: '$fields' },
        { $match: { 'fields.value': { $nin: ['', null] } } },
        {
            $group: {
                _id: { name: '$fields.name', value: '$fields.value' },
                count: { $sum: 1 },
                approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            },
        },
        { $sort: { approved: -1, count: -1 } },
        { $group: { _id: '$_id.name', values: { $push: { value: '$_id.value', count: '$count' } } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.values.slice(0, 30)]));
}
