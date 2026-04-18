/**
 * One-shot migration: normalise the Storage category tree and reclassify
 * existing storage products into the proper leaves.
 *
 * Final tree produced / ensured:
 *
 *   Storage (slug: storage)
 *   ├── Internal (slug: internal-storage)
 *   │   ├── HDD (slug: hdd)
 *   │   ├── SATA SSD (slug: sata-ssd)
 *   │   └── NVMe SSD (Gen 3/4/5) (slug: nvme-ssd)
 *   └── External (slug: external-storage)
 *       ├── External HDD (slug: external-hdd)
 *       └── External SSD (slug: external-ssd)
 *
 * Run with:   npx ts-node src/scripts/migrateStorageCategories.ts
 * or:         npm run migrate:storage
 *
 * Re-running is safe — the script is idempotent.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Category from '../models/Category';
import Product from '../models/Product';

/**
 * Load `.env` from the first location that actually contains it.
 * The live app runs out of the Next.js `client/` folder, so its env file is
 * the canonical source of `MONGODB_URI` for this project.
 */
function loadEnv(): void {
    const here = __dirname;
    const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(here, '../../.env'),          // server/.env
        path.resolve(here, '../../../client/.env'), // client/.env  (live app)
        path.resolve(here, '../../../.env'),        // workspace/.env
    ];
    for (const file of candidates) {
        if (fs.existsSync(file)) {
            dotenv.config({ path: file });
            console.log(`[migrate:storage] Loaded env from ${file}`);
            if (process.env.MONGODB_URI) return;
        }
    }
    // Final fallback to default behaviour (may be a no-op)
    dotenv.config();
}
loadEnv();

type CatRef = { _id: mongoose.Types.ObjectId; slug: string; name: string };

async function connect(): Promise<void> {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not set. Create server/.env first.');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[migrate:storage] Connected to ${mongoose.connection.host}`);
}

/**
 * Locate-or-create a category by slug, enforcing the desired name and parent.
 * Any previously created row with a matching name but different slug is also
 * linked in, so old data isn't lost.
 */
async function ensureCategory(
    name: string,
    slug: string,
    parentId: mongoose.Types.ObjectId | null
): Promise<CatRef> {
    const normalizedSlug = slug.toLowerCase();

    let doc = await Category.findOne({ slug: normalizedSlug });
    if (!doc) {
        doc = await Category.findOne({
            name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        });
    }

    if (!doc) {
        doc = await Category.create({
            name,
            slug: normalizedSlug,
            parentId,
            isActive: true,
        });
        console.log(`[migrate:storage]   + created "${name}" (${normalizedSlug})`);
    } else {
        const updates: Record<string, unknown> = {};
        if (doc.name !== name) updates.name = name;
        if (doc.slug !== normalizedSlug) updates.slug = normalizedSlug;
        if (String(doc.parentId ?? '') !== String(parentId ?? '')) updates.parentId = parentId;
        if (doc.isActive !== true) updates.isActive = true;
        if (Object.keys(updates).length > 0) {
            await Category.updateOne({ _id: doc._id }, { $set: updates });
            console.log(`[migrate:storage]   ~ updated "${name}" (${normalizedSlug}) ->`, updates);
            doc = (await Category.findById(doc._id)) ?? doc;
        }
    }

    return {
        _id: doc._id as mongoose.Types.ObjectId,
        slug: doc.slug as string,
        name: doc.name as string,
    };
}

function normalize(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Slugs / name fragments that mark a category (or product) as storage-ish. */
const STORAGE_KEYWORDS = [
    'storage', 'storages',
    'ssd', 'ssds', 'solid state', 'solid-state',
    'hdd', 'hdds', 'hard disk', 'hard drive',
    'nvme', 'm.2', 'm2',
    'portable drive',
];

const EXTERNAL_KEYWORDS = ['external', 'portable'];
const HDD_KEYWORDS = ['hdd', 'hard disk', 'hard drive', 'mechanical drive'];
const NVME_KEYWORDS = ['nvme', 'm.2', 'm2', 'pcie', 'pci-e'];
const SSD_KEYWORDS = ['ssd', 'solid state'];

function textHasAny(text: string, needles: string[]): boolean {
    const n = normalize(text);
    return needles.some((needle) => n.includes(normalize(needle)));
}

type StorageClass =
    | { bucket: 'internal' | 'external'; kind: 'hdd' | 'sata-ssd' | 'nvme-ssd' | 'external-hdd' | 'external-ssd' | null };

/**
 * Classify a single product into a storage leaf using its existing categories,
 * title and specs. Returns null when the product isn't storage-related at all.
 */
function classifyProduct(
    title: string,
    specs: Record<string, string>,
    categoryNames: string[]
): StorageClass | null {
    const blob = [title, ...Object.values(specs ?? {}), ...categoryNames].join(' | ');
    const isStorage =
        textHasAny(blob, STORAGE_KEYWORDS) ||
        categoryNames.some((n) => textHasAny(n, STORAGE_KEYWORDS));
    if (!isStorage) return null;

    const isExternal =
        textHasAny(blob, EXTERNAL_KEYWORDS) ||
        categoryNames.some((n) => textHasAny(n, EXTERNAL_KEYWORDS));

    const isNvme = textHasAny(blob, NVME_KEYWORDS);
    const isHdd = textHasAny(blob, HDD_KEYWORDS);
    const isSsd = textHasAny(blob, SSD_KEYWORDS) || isNvme;

    if (isExternal) {
        if (isHdd) return { bucket: 'external', kind: 'external-hdd' };
        if (isSsd) return { bucket: 'external', kind: 'external-ssd' };
        return { bucket: 'external', kind: null };
    }

    if (isNvme) return { bucket: 'internal', kind: 'nvme-ssd' };
    if (isHdd) return { bucket: 'internal', kind: 'hdd' };
    if (isSsd) return { bucket: 'internal', kind: 'sata-ssd' };

    return { bucket: 'internal', kind: null };
}

async function main(): Promise<void> {
    await connect();

    // ─── 1. Ensure the canonical category tree ─────────────────────────────
    console.log('[migrate:storage] Ensuring category hierarchy…');
    const storage = await ensureCategory('Storage', 'storage', null);
    const internal = await ensureCategory('Internal', 'internal-storage', storage._id);
    const external = await ensureCategory('External', 'external-storage', storage._id);

    const hdd = await ensureCategory('HDD', 'hdd', internal._id);
    const sataSsd = await ensureCategory('SATA SSD', 'sata-ssd', internal._id);
    const nvmeSsd = await ensureCategory('NVMe SSD (Gen 3/4/5)', 'nvme-ssd', internal._id);

    const externalHdd = await ensureCategory('External HDD', 'external-hdd', external._id);
    const externalSsd = await ensureCategory('External SSD', 'external-ssd', external._id);

    const leafByKind: Record<NonNullable<StorageClass['kind']>, CatRef> = {
        'hdd': hdd,
        'sata-ssd': sataSsd,
        'nvme-ssd': nvmeSsd,
        'external-hdd': externalHdd,
        'external-ssd': externalSsd,
    };
    const bucketFallback: Record<StorageClass['bucket'], CatRef> = {
        internal,
        external,
    };

    // ─── 2. Collect every storage-related category id (old + new) ──────────
    const allCategories = await Category.find({}).lean();
    const storageCategoryIds = new Set<string>();
    for (const c of allCategories) {
        const blob = `${c.name ?? ''} ${c.slug ?? ''}`;
        if (textHasAny(blob, STORAGE_KEYWORDS)) {
            storageCategoryIds.add(String(c._id));
        }
    }
    // Also guarantee new leaves and groups are treated as storage-owned
    [storage, internal, external, hdd, sataSsd, nvmeSsd, externalHdd, externalSsd].forEach((c) =>
        storageCategoryIds.add(String(c._id))
    );
    const newCanonicalIds = new Set<string>(
        [
            storage,
            internal,
            external,
            hdd,
            sataSsd,
            nvmeSsd,
            externalHdd,
            externalSsd,
        ].map((c) => String(c._id))
    );

    // Build a lookup of id -> category name so we can classify by existing tags
    const nameById = new Map<string, string>();
    for (const c of allCategories) {
        nameById.set(String(c._id), `${c.name ?? ''} (${c.slug ?? ''})`);
    }

    // ─── 3. Walk each product and reclassify ───────────────────────────────
    const cursor = Product.find({}).cursor();
    let scanned = 0;
    let touched = 0;
    const bucketCounts: Record<string, number> = {};

    for await (const raw of cursor) {
        const product = raw as unknown as {
            _id: mongoose.Types.ObjectId;
            title: string;
            specs?: Map<string, string> | Record<string, string>;
            categoryIds?: mongoose.Types.ObjectId[];
            save: () => Promise<unknown>;
        };
        scanned += 1;

        const originalIds = (product.categoryIds ?? []).map((id) => String(id));
        const originalNames = originalIds
            .map((id) => nameById.get(id) ?? '')
            .filter(Boolean);

        const hasStorageTag = originalIds.some((id) => storageCategoryIds.has(id));
        const specsObj: Record<string, string> =
            product.specs instanceof Map
                ? Object.fromEntries(product.specs.entries())
                : (product.specs ?? {});

        const classification = classifyProduct(product.title ?? '', specsObj, originalNames);
        // Only touch products that are storage by tag OR clearly storage by text
        if (!hasStorageTag && !classification) continue;

        const targetLeaf =
            classification && classification.kind
                ? leafByKind[classification.kind]
                : classification
                ? bucketFallback[classification.bucket]
                : internal; // has storage tag but no confident bucket -> Internal

        // Rebuild categoryIds:
        //   • drop every existing storage-related id (canonical or legacy)
        //   • keep any non-storage categories it also belongs to
        //   • add the chosen storage leaf id
        const nextIds = new Set<string>();
        for (const id of originalIds) {
            if (!storageCategoryIds.has(id)) nextIds.add(id);
        }
        nextIds.add(String(targetLeaf._id));

        // Order-independent comparison
        const before = [...new Set(originalIds)].sort().join(',');
        const after = [...nextIds].sort().join(',');
        if (before === after) continue;

        product.categoryIds = [...nextIds].map(
            (s) => new mongoose.Types.ObjectId(s)
        ) as unknown as mongoose.Types.ObjectId[];
        await product.save();
        touched += 1;
        bucketCounts[targetLeaf.slug] = (bucketCounts[targetLeaf.slug] ?? 0) + 1;
    }

    console.log(`[migrate:storage] Scanned ${scanned} products, updated ${touched}.`);
    console.log('[migrate:storage] Placement summary:', bucketCounts);

    // ─── 4. Deactivate stale legacy storage categories (optional cleanup) ──
    // Everything that is storage-themed but not one of the new canonical ids
    // gets flagged isActive=false so it no longer pollutes the sidebar.
    const staleIds: mongoose.Types.ObjectId[] = [];
    for (const id of storageCategoryIds) {
        if (!newCanonicalIds.has(id)) {
            staleIds.push(new mongoose.Types.ObjectId(id));
        }
    }
    if (staleIds.length > 0) {
        const res = await Category.updateMany(
            { _id: { $in: staleIds } },
            { $set: { isActive: false } }
        );
        console.log(
            `[migrate:storage] Deactivated ${res.modifiedCount} legacy storage categories.`
        );
    }

    await mongoose.disconnect();
    console.log('[migrate:storage] Done.');
}

main().catch(async (err) => {
    console.error('[migrate:storage] FAILED:', err);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore disconnect errors during failure
    }
    process.exit(1);
});
