import mongoose from 'mongoose';
import Product from '../models/Product';
import '../models/Brand';
import { attributeMatchKey } from '../utils/attributeMatchKey';
import { getCategoryTreeIds } from '../utils/categoryTree';
import { parseSpecValue } from '../../../lib/compareSpecs';

/**
 * Phase 1 of attribute-name normalisation: a read-only inventory of every spec key and
 * attribute name used in a main category, with the *shape* of the values behind each name.
 * A name whose values fall into clearly different shapes (e.g. "Memory" = "128GB" on some
 * products and "DDR5 7200 MT/s …" on others) probably means different things and is flagged.
 * Nothing here writes to the database.
 */

type Source = 'spec' | 'attribute';

export interface InventoryOccurrence {
    productId: string;
    productTitle: string;
    brand: string;
    source: Source;
    group: string | null;
    name: string;
    value: string;
}

const FAMILY_LABELS: Record<string, string> = {
    bytes: 'Capacity (KB/MB/GB/TB)',
    throughput: 'Throughput (MB/s, Gbps)',
    freq: 'Frequency / speed (Hz, MHz, MT/s)',
    watts: 'Power (W)',
    mah: 'Battery (mAh)',
    wh: 'Energy (Wh)',
    volts: 'Voltage (V)',
    time: 'Time (ms, ns)',
    duration: 'Duration (months/years)',
    length: 'Length (mm, cm, in)',
    weight: 'Weight (g, kg)',
    db: 'Noise (dB)',
    rpm: 'Rotation (RPM)',
    cfm: 'Airflow (CFM)',
    fps: 'Frame rate (FPS)',
    hours: 'Hours',
    percent: 'Percentage',
    resolution_p: 'Resolution (p)',
    resolution_k: 'Resolution (K)',
    multiplied: 'N × M (kit / resolution)',
    '': 'Plain number',
};

/** Coarse "shape" of a value — two values with different shapes rarely describe the same thing. */
export function valueSignature(raw: string): { signature: string; label: string } {
    const value = raw.trim();
    const lines = value.split(/\r?\n|•/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 3) return { signature: 'list', label: 'Multi-line list' };
    if (/^(yes|no|supported|not supported|n\/a|none|included|not included)$/i.test(value)) {
        return { signature: 'yesno', label: 'Yes / No' };
    }
    const parsed = parseSpecValue(value);
    // "DDR5", "LGA1700", "Z790", "PCIe 4.0" — identifiers that merely contain digits.
    if (parsed?.family === '' && /^[A-Za-z]+[\s-]?\d/.test(value)) {
        return { signature: 'code', label: 'Code / model (e.g. DDR5, LGA1700)' };
    }
    if (parsed) {
        const label = FAMILY_LABELS[parsed.family] ?? `Number with unit “${parsed.family.replace(/^u:/, '')}”`;
        return { signature: `num:${parsed.family}`, label };
    }
    return { signature: 'text', label: 'Text' };
}

export interface InventoryName {
    key: string;
    name: string;
    variants: { name: string; count: number }[];
    sources: { spec: number; attribute: number };
    productCount: number;
    occurrenceCount: number;
    brands: { brand: string; count: number }[];
    groups: { group: string; count: number }[];
    signatures: {
        signature: string;
        label: string;
        count: number;
        brands: string[];
        samples: { value: string; productId: string; productTitle: string; brand: string }[];
    }[];
    flags: {
        /** Two or more value shapes each with a meaningful share of uses. */
        ambiguous: boolean;
        /** Different brands consistently use the name for differently-shaped values. */
        brandSpecific: boolean;
        /** Filed under more than one attribute group. */
        multiGroup: boolean;
    };
}

export interface CategoryInventory {
    categoryId: string;
    categoryName: string;
    productCount: number;
    occurrenceCount: number;
    names: InventoryName[];
}

type LeanProduct = {
    _id: mongoose.Types.ObjectId;
    title?: string;
    brandId?: { name?: string } | null;
    specs?: Record<string, string>;
    attributeGroups?: { category?: string; attributes?: { name?: string; value?: string }[] }[];
    attributes?: { name?: string; value?: string }[];
};

/** Every spec/attribute occurrence for products in the category tree. */
export async function collectOccurrences(rootCategoryId: mongoose.Types.ObjectId): Promise<{
    productCount: number;
    occurrences: InventoryOccurrence[];
}> {
    const categoryIds = await getCategoryTreeIds(rootCategoryId);
    const products = await Product.find({ categoryIds: { $in: categoryIds } }, 'title brandId specs attributeGroups attributes')
        .populate('brandId', 'name')
        .lean<LeanProduct[]>();

    const occurrences: InventoryOccurrence[] = [];
    for (const p of products) {
        const base = {
            productId: String(p._id),
            productTitle: p.title ?? '',
            brand: p.brandId?.name?.trim() || 'Unknown brand',
        };
        for (const [name, value] of Object.entries(p.specs ?? {})) {
            if (!name || value == null || String(value).trim() === '') continue;
            occurrences.push({ ...base, source: 'spec', group: null, name: name.replace(/_/g, ' '), value: String(value) });
        }
        const groups = p.attributeGroups?.length
            ? p.attributeGroups
            : p.attributes?.length
                ? [{ category: 'General', attributes: p.attributes }]
                : [];
        for (const g of groups) {
            for (const attr of g.attributes ?? []) {
                if (!attr?.name?.trim() || !attr.value?.trim()) continue;
                occurrences.push({
                    ...base,
                    source: 'attribute',
                    group: (g.category || 'General').trim(),
                    name: attr.name.trim(),
                    value: attr.value,
                });
            }
        }
    }
    return { productCount: products.length, occurrences };
}

const countBy = <T>(items: T[], key: (item: T) => string) => {
    const map = new Map<string, number>();
    for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
    return map;
};

const sortedCounts = (map: Map<string, number>) =>
    Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

export function summarizeName(key: string, occ: InventoryOccurrence[]): InventoryName {
    const withSig = occ.map((o) => ({ ...o, ...valueSignature(o.value) }));

    const bySignature = new Map<string, typeof withSig>();
    for (const o of withSig) {
        if (!bySignature.has(o.signature)) bySignature.set(o.signature, []);
        bySignature.get(o.signature)!.push(o);
    }
    const signatures = Array.from(bySignature.entries())
        .map(([signature, items]) => {
            const seenValues = new Set<string>();
            const samples: InventoryName['signatures'][number]['samples'] = [];
            for (const item of items) {
                const v = item.value.trim();
                if (seenValues.has(v) || samples.length >= 5) continue;
                seenValues.add(v);
                samples.push({
                    value: v.length > 160 ? `${v.slice(0, 157)}…` : v,
                    productId: item.productId,
                    productTitle: item.productTitle,
                    brand: item.brand,
                });
            }
            return {
                signature,
                label: items[0].label,
                count: items.length,
                brands: Array.from(new Set(items.map((i) => i.brand))).sort(),
                samples,
            };
        })
        .sort((a, b) => b.count - a.count);

    // Ambiguous: at least two shapes that each cover a real share of the uses (not one-off typos).
    const significant = signatures.filter((s) => s.count >= 2 && s.count / occ.length >= 0.15);
    const ambiguous = significant.length >= 2;

    // Brand-specific: brands with 2+ uses whose dominant shape differs.
    const dominantByBrand = new Map<string, string>();
    for (const [brand, count] of countBy(withSig, (o) => o.brand)) {
        if (count < 2) continue;
        const shapes = sortedCounts(countBy(withSig.filter((o) => o.brand === brand), (o) => o.signature));
        dominantByBrand.set(brand, shapes[0][0]);
    }
    const brandSpecific = new Set(dominantByBrand.values()).size >= 2;

    const groups = sortedCounts(countBy(occ.filter((o) => o.group), (o) => o.group!));

    return {
        key,
        name: sortedCounts(countBy(occ, (o) => o.name))[0][0],
        variants: sortedCounts(countBy(occ, (o) => o.name)).map(([name, count]) => ({ name, count })),
        sources: {
            spec: occ.filter((o) => o.source === 'spec').length,
            attribute: occ.filter((o) => o.source === 'attribute').length,
        },
        productCount: new Set(occ.map((o) => o.productId)).size,
        occurrenceCount: occ.length,
        brands: sortedCounts(countBy(occ, (o) => o.brand)).map(([brand, count]) => ({ brand, count })),
        groups: groups.map(([group, count]) => ({ group, count })),
        signatures,
        flags: { ambiguous, brandSpecific, multiGroup: groups.length >= 2 },
    };
}

export async function buildCategoryInventory(category: { _id: mongoose.Types.ObjectId; name: string }): Promise<CategoryInventory> {
    const { productCount, occurrences } = await collectOccurrences(category._id);

    const byKey = new Map<string, InventoryOccurrence[]>();
    for (const o of occurrences) {
        const key = attributeMatchKey(o.name);
        if (!key) continue;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(o);
    }

    const names = Array.from(byKey.entries())
        .map(([key, occ]) => summarizeName(key, occ))
        .sort((a, b) => {
            const risk = (n: InventoryName) => (n.flags.ambiguous ? 2 : 0) + (n.flags.brandSpecific ? 1 : 0);
            return risk(b) - risk(a) || b.productCount - a.productCount || a.name.localeCompare(b.name);
        });

    return {
        categoryId: String(category._id),
        categoryName: category.name,
        productCount,
        occurrenceCount: occurrences.length,
        names,
    };
}
