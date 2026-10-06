import mongoose from 'mongoose';
import Product from '../models/Product';
import '../models/Brand';
import CategoryFeaturedSpecs from '../models/CategoryFeaturedSpecs';
import AttributeNamingScheme from '../models/AttributeNamingScheme';
import AttributeRenameProposal, { type IProposalChange } from '../models/AttributeRenameProposal';
import { getCategoryTreeIds } from '../utils/categoryTree';
import { normalizeSpecKey } from '../utils/normalizeSpecKey';
import { attributeMatchKey } from '../utils/attributeMatchKey';
import { valueSignature } from './attributeInventory';
import { matchNamingRule, type NamingRule } from '../../../lib/attributeNamingRules';
import { clearFeaturedSpecsCache } from '../controllers/productController';

/**
 * Phase 3 + 4 of attribute-name normalisation: turn the approved naming scheme into per-product rename
 * proposals, then apply / undo them one product at a time. ONLY NAMES CHANGE — every value stays exactly
 * as it is, and a change is refused if the product no longer matches what was suggested.
 */

export class ProposalError extends Error {
    constructor(message: string, public status = 400) {
        super(message);
        this.name = 'ProposalError';
    }
}

/** Spec keys are stored Title_Case_With_Underscores; Mongo map keys can't contain "." or "$". */
export const specKeyFor = (name: string): string => normalizeSpecKey(name).replace(/[.$]/g, '');

type LeanProduct = {
    _id: mongoose.Types.ObjectId;
    title?: string;
    slug?: string;
    images?: string[];
    brandId?: { name?: string } | null;
    specs?: Record<string, string>;
    attributeGroups?: { category?: string; attributes?: { name?: string; value?: string }[] }[];
    attributes?: { name?: string; value?: string }[];
};

interface Occurrence {
    container: IProposalChange['container'];
    groupIndex?: number;
    groupName?: string;
    attrIndex?: number;
    /** Current display name. */
    name: string;
    /** Current raw spec key (specs only). */
    key?: string;
    value: string;
}

/** Every named detail on a product, in the same way the inventory reads them (empty ones skipped). */
function listOccurrences(p: LeanProduct): Occurrence[] {
    const out: Occurrence[] = [];
    for (const [rawKey, rawValue] of Object.entries(p.specs ?? {})) {
        const value = String(rawValue ?? '').trim();
        if (!rawKey || !value) continue;
        out.push({ container: 'specs', name: rawKey.replace(/_/g, ' '), key: rawKey, value });
    }
    if (p.attributeGroups?.length) {
        p.attributeGroups.forEach((g, groupIndex) =>
            (g.attributes ?? []).forEach((a, attrIndex) => {
                const name = a?.name?.trim();
                const value = a?.value?.trim();
                if (!name || !value) return;
                out.push({ container: 'attributeGroups', groupIndex, groupName: (g.category || 'General').trim(), attrIndex, name, value });
            })
        );
    } else if (p.attributes?.length) {
        p.attributes.forEach((a, attrIndex) => {
            const name = a?.name?.trim();
            const value = a?.value?.trim();
            if (!name || !value) return;
            out.push({ container: 'attributes', groupName: 'General', attrIndex, name, value });
        });
    }
    return out;
}

const occurrenceKey = (o: Pick<Occurrence, 'container' | 'key' | 'groupIndex' | 'attrIndex'>) =>
    o.container === 'specs' ? `s|${o.key}` : o.container === 'attributeGroups' ? `g|${o.groupIndex}|${o.attrIndex}` : `l|${o.attrIndex}`;

/** Two details of one product ending up with the same name (spec keys and attributes are separate namespaces). */
function findCollisions(items: { container: Occurrence['container']; finalName: string; changed: boolean }[]): string[] {
    const groups = new Map<string, { names: Set<string>; count: number; changed: boolean }>();
    for (const it of items) {
        const key = `${it.container === 'specs' ? 's' : 'a'}|${attributeMatchKey(it.finalName)}`;
        const g = groups.get(key) ?? { names: new Set<string>(), count: 0, changed: false };
        g.names.add(it.finalName);
        g.count += 1;
        g.changed = g.changed || it.changed;
        groups.set(key, g);
    }
    return Array.from(groups.values())
        .filter((g) => g.count >= 2 && g.changed)
        .map((g) => Array.from(g.names)[0]);
}

export function computeChanges(p: LeanProduct, rules: NamingRule[], canonicalName: Map<string, string>) {
    const brand = p.brandId?.name?.trim() || 'Unknown brand';
    const occs = listOccurrences(p);
    const changes: IProposalChange[] = [];
    const items: { container: Occurrence['container']; finalName: string; changed: boolean }[] = [];

    for (const o of occs) {
        const match = matchNamingRule(rules, attributeMatchKey(o.name), valueSignature(o.value).signature, brand);
        let changed = false;
        let finalName = o.container === 'specs' ? (o.key ?? o.name).replace(/_/g, ' ') : o.name;
        if (match.status === 'matched' && match.canonicalId) {
            const newName = canonicalName.get(match.canonicalId);
            if (newName) {
                const different = o.container === 'specs' ? specKeyFor(newName) !== o.key : newName.trim() !== o.name;
                if (different) {
                    changed = true;
                    finalName = o.container === 'specs' ? specKeyFor(newName).replace(/_/g, ' ') : newName.trim();
                    changes.push({
                        container: o.container,
                        groupIndex: o.groupIndex,
                        groupName: o.groupName,
                        attrIndex: o.attrIndex,
                        oldName: o.name,
                        oldKey: o.key,
                        newName: newName.trim(),
                        value: o.value,
                        confidence: match.rule.confidence,
                        reason: match.rule.reason,
                        canonicalId: match.canonicalId,
                    });
                }
            }
        }
        items.push({ container: o.container, finalName, changed });
    }
    return { changes, collisions: findCollisions(items) };
}

/** Build (or rebuild) the rename proposals for every product in a main category from its approved scheme. */
export async function buildProposals(category: { _id: mongoose.Types.ObjectId }) {
    const scheme = await AttributeNamingScheme.findOne({ categoryId: category._id }).lean();
    if (!scheme || scheme.status !== 'approved') {
        throw new ProposalError('Confirm the names in step 2 first — changes are built from the confirmed names.', 400);
    }
    const canonicalName = new Map(scheme.canonical.map((c) => [c.id, c.name]));
    const rules = scheme.rules as unknown as NamingRule[];

    const treeIds = await getCategoryTreeIds(category._id);
    const products = await Product.find({ categoryIds: { $in: treeIds } }, 'title images brandId specs attributeGroups attributes')
        .populate('brandId', 'name')
        .lean<LeanProduct[]>();
    const existing = new Map(
        (await AttributeRenameProposal.find({ categoryId: category._id }, 'productId status').lean()).map((e) => [String(e.productId), e.status])
    );

    const writes: mongoose.AnyBulkWriteOperation[] = [];
    let withChanges = 0;
    let needsLook = 0;
    let totalChanges = 0;
    const nothingToDo: mongoose.Types.ObjectId[] = [];

    for (const p of products) {
        // Already applied: leave it (its history is needed for "undo").
        if (existing.get(String(p._id)) === 'accepted') continue;
        const { changes, collisions } = computeChanges(p, rules, canonicalName);
        if (changes.length === 0) {
            if (existing.has(String(p._id))) nothingToDo.push(p._id);
            continue;
        }
        const look = collisions.length > 0 || changes.some((c) => c.confidence === 'low');
        withChanges += 1;
        totalChanges += changes.length;
        if (look) needsLook += 1;
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
                        status: 'pending',
                        changes,
                        collisions,
                        needsLook: look,
                    },
                    $unset: { rejectedAt: 1, revertedAt: 1 },
                },
                upsert: true,
            },
        });
    }
    if (nothingToDo.length) {
        writes.push({ deleteMany: { filter: { categoryId: category._id, productId: { $in: nothingToDo }, status: { $ne: 'accepted' } } } });
    }
    if (writes.length) await AttributeRenameProposal.bulkWrite(writes, { ordered: false });

    return { productsScanned: products.length, productsToReview: withChanges, needsLook, totalChanges };
}

type PlannedChange = IProposalChange;

/**
 * Work out the exact database update for applying (forward) or undoing (backward) a proposal, refusing
 * if the product no longer looks like it did when the suggestion was made.
 */
export function planChanges(product: LeanProduct, changes: PlannedChange[], direction: 'forward' | 'backward') {
    const occs = listOccurrences(product);
    const byKey = new Map(occs.map((o) => [occurrenceKey(o), o]));
    const specEntries = Object.entries(product.specs ?? {});
    const set: Record<string, unknown> = {};
    const specRenames: { from: string; to: string }[] = [];
    const finals = new Map<string, string>();
    const changedKeys = new Set<string>();
    let specsTouched = false;

    for (const c of changes) {
        const currentKey =
            c.container === 'specs'
                ? `s|${direction === 'forward' ? c.oldKey : specKeyFor(c.newName)}`
                : c.container === 'attributeGroups'
                  ? `g|${c.groupIndex}|${c.attrIndex}`
                  : `l|${c.attrIndex}`;
        const occ = byKey.get(currentKey);
        const expectedName = direction === 'forward' ? c.oldName : c.newName;
        const stale = new ProposalError(
            `"${c.oldName}" has changed on this product since the suggestion was made. Prepare the changes again.`,
            409
        );
        if (!occ || occ.value !== c.value.trim()) throw stale;
        if (c.container !== 'specs' && occ.name !== expectedName.trim()) throw stale;

        if (c.container === 'specs') {
            const targetKey = direction === 'forward' ? specKeyFor(c.newName) : (c.oldKey ?? '');
            if (!targetKey) throw new ProposalError(`"${c.newName}" can't be used as a name.`, 400);
            const idx = specEntries.findIndex(([k]) => k === occ.key);
            if (idx < 0) throw stale;
            specEntries[idx][0] = targetKey;
            specsTouched = true;
            specRenames.push({ from: occ.key as string, to: targetKey });
            finals.set(currentKey, targetKey.replace(/_/g, ' '));
        } else {
            const target = (direction === 'forward' ? c.newName : c.oldName).trim();
            if (!target) throw new ProposalError('A name can\'t be empty.', 400);
            set[c.container === 'attributeGroups' ? `attributeGroups.${c.groupIndex}.attributes.${c.attrIndex}.name` : `attributes.${c.attrIndex}.name`] = target;
            finals.set(currentKey, target);
        }
        changedKeys.add(currentKey);
    }

    const collisions = findCollisions(
        occs.map((o) => {
            const k = occurrenceKey(o);
            return { container: o.container, finalName: finals.get(k) ?? o.name, changed: changedKeys.has(k) };
        })
    );
    if (collisions.length) {
        throw new ProposalError(`Two details would end up with the same name (“${collisions.join('”, “')}”). Rename one of them first.`, 400);
    }
    if (specsTouched) set.specs = Object.fromEntries(specEntries);
    return { set, specRenames };
}

/**
 * Keep the shop's filter configuration in step with renamed spec keys: the new key is added next to the
 * old one right away, and the old one is dropped once no product uses it any more.
 */
async function syncFeaturedKeys(renames: { from: string; to: string }[]) {
    for (const { from, to } of renames) {
        if (from === to) continue;
        const configs = await CategoryFeaturedSpecs.find({ featuredSpecKeys: from });
        const stillUsed = (await Product.countDocuments({ [`specs.${from}`]: { $exists: true } })) > 0;
        for (const cfg of configs) {
            const keys = [...cfg.featuredSpecKeys];
            if (!keys.includes(to)) keys.splice(keys.indexOf(from) + 1, 0, to);
            const next = stillUsed ? keys : keys.filter((k) => k !== from);
            cfg.featuredSpecKeys = next;
            await cfg.save();
            clearFeaturedSpecsCache(cfg.categoryKey);
        }
    }
}

const MAX_NAME_LENGTH = 120;

export async function acceptProposal(id: string, actorEmail: string | undefined, edits: { index: number; newName: string }[] = []) {
    const proposal = await AttributeRenameProposal.findById(id);
    if (!proposal) throw new ProposalError('This suggestion no longer exists.', 404);
    if (proposal.status === 'accepted') throw new ProposalError('These changes were already applied.', 409);

    let changes = proposal.changes.map((c) => ({ ...(c as unknown as { toObject: () => PlannedChange }).toObject() }));
    for (const e of edits) {
        const target = changes[e.index];
        if (!target) continue;
        const name = e.newName.trim();
        if (!name || name.length > MAX_NAME_LENGTH) throw new ProposalError(`Names must be 1–${MAX_NAME_LENGTH} characters.`, 400);
        target.newName = name;
    }
    // An edit back to the original name simply means "don't rename this one".
    changes = changes.filter((c) => (c.container === 'specs' ? specKeyFor(c.newName) !== c.oldKey : c.newName.trim() !== c.oldName));
    if (changes.length === 0) throw new ProposalError('Nothing to change here — use "Leave unchanged" instead.', 400);

    const product = await Product.findById(proposal.productId).lean<LeanProduct>();
    if (!product) throw new ProposalError('This product no longer exists.', 404);

    const { set, specRenames } = planChanges(product, changes, 'forward');
    await Product.updateOne({ _id: product._id }, { $set: set });

    proposal.set({ changes, status: 'accepted', acceptedAt: new Date(), acceptedBy: actorEmail });
    proposal.set('rejectedAt', undefined);
    await proposal.save();
    await syncFeaturedKeys(specRenames);
    return { productId: String(product._id), title: proposal.productTitle, changes, specRenamed: specRenames.length > 0 };
}

export async function rejectProposal(id: string) {
    const proposal = await AttributeRenameProposal.findById(id);
    if (!proposal) throw new ProposalError('This suggestion no longer exists.', 404);
    if (proposal.status === 'accepted') throw new ProposalError('These changes are already applied — undo them first.', 409);
    proposal.set({ status: 'rejected', rejectedAt: new Date() });
    await proposal.save();
}

/** Undo an accepted proposal: the names go back exactly as they were. */
export async function revertProposal(id: string) {
    const proposal = await AttributeRenameProposal.findById(id);
    if (!proposal) throw new ProposalError('This suggestion no longer exists.', 404);
    if (proposal.status !== 'accepted') throw new ProposalError('These changes are not applied.', 409);

    const changes = proposal.changes.map((c) => ({ ...(c as unknown as { toObject: () => PlannedChange }).toObject() }));
    const product = await Product.findById(proposal.productId).lean<LeanProduct>();
    if (!product) throw new ProposalError('This product no longer exists.', 404);

    const { set, specRenames } = planChanges(product, changes, 'backward');
    await Product.updateOne({ _id: product._id }, { $set: set });

    proposal.set({ status: 'pending', revertedAt: new Date() });
    proposal.set('acceptedAt', undefined);
    proposal.set('acceptedBy', undefined);
    await proposal.save();
    await syncFeaturedKeys(specRenames);
    return { productId: String(product._id), title: proposal.productTitle, changes, specRenamed: specRenames.length > 0 };
}

/** Accept up to `limit` waiting proposals that have nothing unusual about them. */
export async function acceptSafeProposals(categoryId: mongoose.Types.ObjectId, actorEmail: string | undefined, opts: { brand?: string; limit?: number } = {}) {
    const filter: Record<string, unknown> = { categoryId, status: 'pending', needsLook: false };
    if (opts.brand) filter.brand = opts.brand;
    const batch = await AttributeRenameProposal.find(filter, '_id productTitle').limit(opts.limit ?? 40).lean();
    const accepted: Awaited<ReturnType<typeof acceptProposal>>[] = [];
    const failed: { id: string; title: string; message: string }[] = [];
    for (const item of batch) {
        try {
            accepted.push(await acceptProposal(String(item._id), actorEmail));
        } catch (error) {
            failed.push({ id: String(item._id), title: item.productTitle, message: (error as Error).message });
            // Don't retry the same failing item forever: park it for a manual look.
            await AttributeRenameProposal.updateOne({ _id: item._id }, { $set: { needsLook: true } });
        }
    }
    const remaining = await AttributeRenameProposal.countDocuments(filter);
    return { accepted, failed, remaining };
}

export async function listProposals(categoryId: mongoose.Types.ObjectId) {
    const items = await AttributeRenameProposal.aggregate([
        { $match: { categoryId } },
        {
            $project: {
                productId: 1,
                title: '$productTitle',
                brand: 1,
                image: 1,
                status: 1,
                needsLook: 1,
                changeCount: { $size: '$changes' },
            },
        },
        { $sort: { needsLook: -1, brand: 1, title: 1 } },
        { $limit: 3000 },
    ]);
    return items.map((i) => ({
        id: String(i._id),
        productId: String(i.productId),
        title: i.title as string,
        brand: i.brand as string,
        image: i.image as string | undefined,
        status: i.status as 'pending' | 'accepted' | 'rejected',
        needsLook: Boolean(i.needsLook),
        changeCount: i.changeCount as number,
    }));
}

export async function getProposalDetail(id: string) {
    const proposal = await AttributeRenameProposal.findById(id).lean();
    if (!proposal) throw new ProposalError('This suggestion no longer exists.', 404);
    const [product, scheme] = await Promise.all([
        Product.findById(proposal.productId, 'title slug images specs attributeGroups attributes brandId').populate('brandId', 'name').lean<LeanProduct>(),
        AttributeNamingScheme.findOne({ categoryId: proposal.categoryId }, 'canonical').lean(),
    ]);

    let staleMessage: string | undefined;
    if (!product) {
        staleMessage = 'This product no longer exists.';
    } else if (proposal.status !== 'accepted') {
        try {
            planChanges(product, proposal.changes as unknown as PlannedChange[], 'forward');
        } catch (error) {
            if (error instanceof ProposalError) staleMessage = error.message;
            else throw error;
        }
    }

    const canonicalNames = (scheme?.canonical ?? [])
        .slice()
        .sort((a, b) => Number(Boolean(b.standard)) - Number(Boolean(a.standard)) || a.name.localeCompare(b.name))
        .map((c) => c.name);

    return {
        id: String(proposal._id),
        productId: String(proposal.productId),
        productSlug: product?.slug,
        title: product?.title ?? proposal.productTitle,
        brand: proposal.brand,
        image: product?.images?.[0] ?? proposal.image,
        status: proposal.status,
        needsLook: proposal.needsLook,
        collisions: proposal.collisions,
        changes: proposal.changes,
        acceptedAt: proposal.acceptedAt,
        acceptedBy: proposal.acceptedBy,
        stale: Boolean(staleMessage),
        staleMessage,
        canonicalNames,
    };
}
