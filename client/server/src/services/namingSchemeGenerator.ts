import mongoose from 'mongoose';
import AttributeNamingScheme from '../models/AttributeNamingScheme';
import { buildCategoryInventory, type InventoryName } from './attributeInventory';
import { generateJson, geminiModel } from './gemini';
import {
    canonicalIdFromName,
    type CanonicalAttribute,
    type NamingRule,
    type UnresolvedName,
} from '../../../lib/attributeNamingRules';
import { attributeLooseKey } from '../../../lib/attributeMatchKey';

export const DEFAULT_CHUNK_SIZE = 30;

const SYSTEM_INSTRUCTION = `You standardise ATTRIBUTE NAMES for a computer hardware store. Different manufacturers
name the same specification differently, and sometimes use the same name for different things.

You will receive, for one product category, a list of raw attribute names. For each name you get its spellings,
the brands that use it, the groups it is filed under, and its "value shapes": clusters of its values by format
(e.g. "num:bytes" = capacities like 128GB, "num:freq" = MHz/MT/s, "code" = DDR5/LGA1700, "list" = multi-line lists,
"text", "yesno"), each with sample values and the brands that use that shape.

Your job: define canonical attribute names and rules mapping raw names to them.

Rules you must follow:
- You only decide NAMES. Never rewrite, convert or comment on values.
- Canonical names: clear Title Case English, no units (e.g. "Max Memory Capacity", not "Max Memory (GB)").
  Prefer the clearest existing wording used by the brands.
- Different wordings that mean the same thing must map to the same canonical attribute.
- If one raw name is used with different meanings (look at the value shapes and samples!), create SEPARATE rules
  with "signatures" conditions so each meaning maps to its own canonical name.
- Use "brands" conditions only when value shapes cannot tell the meanings apart but brands consistently differ.
- Do NOT merge things that differ: e.g. USB 2.0 vs USB 3.2 ports, read vs write speed, front vs rear connectors,
  max vs supported values, different connector types.
- canonicalId null means "keep the original name" (it is already clear and unique). Use it freely.
- If you are not sure what a name means, put it in "unresolved" with a short note instead of guessing.
- Every raw name in the input must appear in at least one rule or in "unresolved".
- Reuse canonical attributes from the "existing canonical attributes" list whenever they fit; only add new ones when needed.
- "reason": one short sentence a store admin can understand.`;

const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        canonical: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    id: { type: 'STRING' },
                    name: { type: 'STRING' },
                    description: { type: 'STRING' },
                },
                required: ['id', 'name', 'description'],
            },
        },
        rules: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    key: { type: 'STRING' },
                    canonicalId: { type: 'STRING', nullable: true },
                    signatures: { type: 'ARRAY', items: { type: 'STRING' } },
                    brands: { type: 'ARRAY', items: { type: 'STRING' } },
                    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
                    reason: { type: 'STRING' },
                },
                required: ['key', 'confidence', 'reason'],
            },
        },
        unresolved: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: { key: { type: 'STRING' }, note: { type: 'STRING' } },
                required: ['key', 'note'],
            },
        },
    },
    required: ['canonical', 'rules', 'unresolved'],
};

type AiResponse = {
    canonical: { id: string; name: string; description?: string }[];
    rules: { key: string; canonicalId?: string | null; signatures?: string[]; brands?: string[]; confidence: NamingRule['confidence']; reason?: string }[];
    unresolved: { key: string; note: string }[];
};

const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

function describeName(n: InventoryName) {
    return {
        key: n.key,
        spellings: n.variants.slice(0, 5).map((v) => `${v.name} (${v.count})`),
        products: n.productCount,
        brands: n.brands.slice(0, 10).map((b) => b.brand),
        groups: n.groups.slice(0, 5).map((g) => g.group),
        usedAsShopFilter: n.sources.spec > 0,
        possiblyMixedMeanings: n.flags.ambiguous || n.flags.brandSpecific || undefined,
        shapes: n.signatures.map((s) => ({
            signature: s.signature,
            label: s.label,
            uses: s.count,
            brands: s.brands.slice(0, 8),
            samples: s.samples.slice(0, 3).map((x) => truncate(x.value.replace(/\s*\n\s*/g, ' / '), 140)),
        })),
    };
}

function buildPrompt(categoryName: string, names: InventoryName[], existing: CanonicalAttribute[]) {
    return [
        `Product category: ${categoryName}`,
        '',
        'Existing canonical attributes (reuse their ids when they fit):',
        existing.length ? JSON.stringify(existing.map(({ id, name, description }) => ({ id, name, description }))) : '(none yet)',
        '',
        `Raw attribute names to map (${names.length}):`,
        JSON.stringify(names.map(describeName)),
    ].join('\n');
}

/** Validate the model's answer against the inventory and merge it into the scheme's lists. */
export function mergeAiResponse(
    ai: AiResponse,
    chunk: InventoryName[],
    canonical: CanonicalAttribute[],
    rules: NamingRule[],
    unresolved: UnresolvedName[]
) {
    const chunkByKey = new Map(chunk.map((n) => [n.key, n]));

    // Canonical attributes: dedupe by loose name so chunks converge on one entry.
    const idByLoose = new Map(canonical.map((c) => [attributeLooseKey(c.name), c.id]));
    const knownIds = new Set(canonical.map((c) => c.id));
    const aiIdToId = new Map<string, string>();
    for (const c of ai.canonical ?? []) {
        const name = c.name?.trim();
        if (!name) continue;
        const loose = attributeLooseKey(name);
        let id = idByLoose.get(loose) ?? (knownIds.has(c.id) ? c.id : undefined);
        if (!id) {
            id = canonicalIdFromName(name);
            let n = 2;
            while (knownIds.has(id)) id = `${canonicalIdFromName(name)}-${n++}`;
            canonical.push({ id, name, description: c.description?.trim() || undefined });
            knownIds.add(id);
            idByLoose.set(loose, id);
        }
        aiIdToId.set(c.id, id);
    }

    const resolveCanonical = (raw: string | null | undefined): string | null | undefined => {
        if (raw == null || raw === '') return null;
        if (knownIds.has(raw)) return raw;
        return aiIdToId.get(raw); // undefined = invalid reference
    };

    const covered = new Set<string>();
    const nextUnresolved = new Map(unresolved.filter((u) => !chunkByKey.has(u.key)).map((u) => [u.key, u]));
    const keptRules = rules.filter((r) => !chunkByKey.has(r.key));

    for (const r of ai.rules ?? []) {
        const name = chunkByKey.get(r.key);
        if (!name) continue;
        const canonicalId = resolveCanonical(r.canonicalId);
        if (canonicalId === undefined) {
            nextUnresolved.set(r.key, { key: r.key, note: `AI referenced an unknown canonical name (${r.canonicalId}).` });
            continue;
        }
        const validSigs = new Set(name.signatures.map((s) => s.signature));
        const validBrands = name.brands.map((b) => b.brand);
        const signatures = (r.signatures ?? []).filter((s) => validSigs.has(s));
        const brands = (r.brands ?? [])
            .map((b) => validBrands.find((vb) => vb.toLowerCase() === b.trim().toLowerCase()))
            .filter((b): b is string => Boolean(b));
        // A condition that referenced only unknown shapes/brands would silently widen the rule — drop it instead.
        if ((r.signatures?.length && !signatures.length) || (r.brands?.length && !brands.length)) continue;
        keptRules.push({
            key: r.key,
            canonicalId,
            signatures: signatures.length ? signatures : undefined,
            brands: brands.length ? brands : undefined,
            confidence: r.confidence ?? 'medium',
            reason: r.reason?.trim() || undefined,
            source: 'ai',
        });
        covered.add(r.key);
    }

    for (const u of ai.unresolved ?? []) {
        if (chunkByKey.has(u.key)) nextUnresolved.set(u.key, { key: u.key, note: u.note?.trim() || 'Unclear meaning.' });
    }
    for (const key of chunkByKey.keys()) {
        if (!covered.has(key) && !nextUnresolved.has(key)) {
            nextUnresolved.set(key, { key, note: 'The AI returned no rule for this name.' });
        }
    }

    return { canonical, rules: keptRules, unresolved: Array.from(nextUnresolved.values()) };
}

/**
 * Generate one chunk of the naming scheme. The admin UI calls this for chunk 0..N-1 in turn,
 * keeping each request short; later chunks reuse canonical names created by earlier ones.
 */
export async function generateSchemeChunk({
    category,
    chunkIndex,
    chunkSize = DEFAULT_CHUNK_SIZE,
}: {
    category: { _id: mongoose.Types.ObjectId; name: string };
    chunkIndex: number;
    chunkSize?: number;
}) {
    const inventory = await buildCategoryInventory(category);
    const names = [...inventory.names].sort((a, b) => a.key.localeCompare(b.key));
    const totalChunks = Math.max(1, Math.ceil(names.length / chunkSize));
    if (chunkIndex < 0 || chunkIndex >= totalChunks) throw new Error(`Chunk ${chunkIndex} is out of range (0-${totalChunks - 1}).`);
    const chunk = names.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize);

    let scheme = await AttributeNamingScheme.findOne({ categoryId: category._id });
    if (!scheme) {
        scheme = new AttributeNamingScheme({ categoryId: category._id });
    }
    if (chunkIndex === 0) {
        // Fresh run: start a new draft.
        scheme.set({
            status: 'draft',
            canonical: [],
            rules: [],
            unresolved: [],
            approvedAt: undefined,
            approvedBy: undefined,
            generation: { model: geminiModel(), startedAt: new Date(), completedChunks: 0, totalChunks },
        });
    }

    const current = scheme.toObject() as {
        canonical: CanonicalAttribute[];
        rules: NamingRule[];
        unresolved: UnresolvedName[];
    };
    const existingCanonical = current.canonical.map(({ id, name, description }) => ({ id, name, description }));
    const ai = await generateJson<AiResponse>({
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt: buildPrompt(category.name, chunk, existingCanonical),
        responseSchema: RESPONSE_SCHEMA,
    });

    const merged = mergeAiResponse(
        ai,
        chunk,
        existingCanonical,
        current.rules,
        current.unresolved.map(({ key, note }) => ({ key, note }))
    );

    scheme.set({
        status: 'draft',
        canonical: merged.canonical,
        rules: merged.rules,
        unresolved: merged.unresolved,
        generation: {
            model: geminiModel(),
            startedAt: scheme.generation?.startedAt ?? new Date(),
            completedChunks: chunkIndex + 1,
            totalChunks,
        },
    });
    await scheme.save();

    return { chunkIndex, totalChunks, done: chunkIndex + 1 >= totalChunks, scheme: scheme.toObject() };
}
