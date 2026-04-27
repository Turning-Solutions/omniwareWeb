/**
 * Ensures the Audio / Cooling / Peripherals / Power category trees match the shop
 * filter layout in `client/components/DynamicFilterSidebar.tsx`, and optionally
 * reassigns products from parent-only or legacy slugs onto leaf categories.
 *
 * Default: ensure category documents + hierarchy only (no product writes).
 * With `--reclassify`: keyword-classify products tagged with any of these departments
 * and rewrite `categoryIds` (same pattern as `migrateStorageCategories.ts`).
 *
 * Run:  npx ts-node src/scripts/migrateFilterLayoutCategories.ts
 *       npx ts-node src/scripts/migrateFilterLayoutCategories.ts --reclassify
 * or:   npm run migrate:filter-layout
 *       npm run migrate:filter-layout -- --reclassify
 *
 * Re-running is safe (idempotent for categories; products only change when classification differs).
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Category from '../models/Category';
import Product from '../models/Product';
import { expandMongoSrvUri } from '../utils/expandMongoSrvUri';

function loadEnv(): void {
    const here = __dirname;
    const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(here, '../../.env'),
        path.resolve(here, '../../../client/.env'),
        path.resolve(here, '../../../.env'),
    ];
    for (const file of candidates) {
        if (fs.existsSync(file)) {
            dotenv.config({ path: file });
            console.log(`[migrate:filter-layout] Loaded env from ${file}`);
            if (process.env.MONGODB_URI) return;
        }
    }
    dotenv.config();
}
loadEnv();

type CatRef = { _id: mongoose.Types.ObjectId; slug: string; name: string };

async function connect(): Promise<void> {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not set.');
    }
    let connectUri = process.env.MONGODB_URI;
    if (process.env.MONGODB_URI_DIRECT?.trim()) {
        connectUri = process.env.MONGODB_URI_DIRECT.trim();
    } else if (/^mongodb\+srv:\/\//i.test(process.env.MONGODB_URI)) {
        connectUri = await expandMongoSrvUri(process.env.MONGODB_URI);
    }

    await mongoose.connect(connectUri);
    console.log(`[migrate:filter-layout] Connected to ${mongoose.connection.host}`);
}

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
        console.log(`[migrate:filter-layout]   + created "${name}" (${normalizedSlug})`);
    } else {
        const updates: Record<string, unknown> = {};
        if (doc.name !== name) updates.name = name;
        if (doc.slug !== normalizedSlug) updates.slug = normalizedSlug;
        if (String(doc.parentId ?? '') !== String(parentId ?? '')) updates.parentId = parentId;
        if (doc.isActive !== true) updates.isActive = true;
        if (Object.keys(updates).length > 0) {
            await Category.updateOne({ _id: doc._id }, { $set: updates });
            console.log(`[migrate:filter-layout]   ~ updated "${name}" (${normalizedSlug}) ->`, updates);
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

function textHasAny(text: string, needles: string[]): boolean {
    const n = normalize(text);
    return needles.some((needle) => n.includes(normalize(needle)));
}

/** Slugs treated as belonging to one of the four departments (for stripping from products). */
const DEPARTMENT_SLUG_FRAGMENTS = [
    'audio',
    'cooling',
    'cooler',
    'peripheral',
    'peripherals',
    'power',
    'headset',
    'headphones',
    'microphone',
    'speaker',
    'keyboard',
    'mouse',
    'mousepad',
    'controller',
    'combo',
    'ups',
    'aio',
    'nvme',
    'thermal',
    'fan',
    'paste',
];

type Dept = 'audio' | 'cooling' | 'peripherals' | 'power';

type LeafSlug =
    | 'headsets'
    | 'microphones'
    | 'speakers'
    | 'air-coolers'
    | 'aio-liquid-coolers'
    | 'case-fans'
    | 'laptop-cooling-pads'
    | 'thermal-paste'
    | 'keyboards'
    | 'mice'
    | 'mousepads'
    | 'controllers'
    | 'combos'
    | 'ups';

function classifyProduct(
    title: string,
    specs: Record<string, string>,
    categoryNames: string[]
): { dept: Dept; leaf: LeafSlug | null } | null {
    const blob = [title, ...Object.values(specs ?? {}), ...categoryNames].join(' | ');

    // ── Cooling (check before peripherals: "fan" overlaps) ─────────────
    if (
        textHasAny(blob, ['cooling', 'cooler', 'aio', 'thermal', 'fan', 'paste', 'radiator', 'heatsink']) ||
        categoryNames.some((n) => textHasAny(n, ['cooling', 'cooler', 'fan', 'thermal']))
    ) {
        if (textHasAny(blob, ['thermal paste', 'thermal compound', 'thermal grease', 'tim ', ' tim'])) {
            return { dept: 'cooling', leaf: 'thermal-paste' };
        }
        if (textHasAny(blob, ['cooling pad', 'laptop cooler', 'laptop cooling'])) {
            return { dept: 'cooling', leaf: 'laptop-cooling-pads' };
        }
        if (
            textHasAny(blob, [
                'aio',
                'liquid cooler',
                'water cooler',
                ' aio ',
                '240mm',
                '280mm',
                '360mm',
                '420mm',
            ]) ||
            categoryNames.some((n) => textHasAny(n, ['aio', 'liquid']))
        ) {
            return { dept: 'cooling', leaf: 'aio-liquid-coolers' };
        }
        if (
            textHasAny(blob, ['case fan', 'rgb fan', '120mm', '140mm', 'pwm fan']) ||
            categoryNames.some((n) => textHasAny(n, ['case fan', 'fan']))
        ) {
            return { dept: 'cooling', leaf: 'case-fans' };
        }
        if (
            textHasAny(blob, ['air cooler', 'cpu cooler', 'tower cooler', 'heat pipe']) &&
            !textHasAny(blob, ['aio', 'liquid'])
        ) {
            return { dept: 'cooling', leaf: 'air-coolers' };
        }
        return { dept: 'cooling', leaf: null };
    }

    // ── Power ───────────────────────────────────────────────────────────
    if (
        textHasAny(blob, ['ups', 'uninterruptible', 'battery backup', 'avr ']) ||
        categoryNames.some((n) => textHasAny(n, ['ups', 'power']))
    ) {
        return { dept: 'power', leaf: 'ups' };
    }

    // ── Audio ───────────────────────────────────────────────────────────
    if (
        textHasAny(blob, ['headset', 'headphone', 'earphone', 'earbud', 'iem ']) ||
        categoryNames.some((n) => textHasAny(n, ['audio', 'headset', 'headphone']))
    ) {
        if (textHasAny(blob, ['microphone', 'mic ', ' condenser', 'dynamic mic', 'usb mic'])) {
            return { dept: 'audio', leaf: 'microphones' };
        }
        if (textHasAny(blob, ['speaker', 'soundbar', 'subwoofer'])) {
            return { dept: 'audio', leaf: 'speakers' };
        }
        if (textHasAny(blob, ['headset', 'headphone', 'earphone', 'earbud'])) {
            return { dept: 'audio', leaf: 'headsets' };
        }
        return { dept: 'audio', leaf: null };
    }
    if (textHasAny(blob, ['microphone', 'mic ', 'condenser mic', 'usb mic'])) {
        return { dept: 'audio', leaf: 'microphones' };
    }
    if (textHasAny(blob, ['speaker', 'soundbar'])) {
        return { dept: 'audio', leaf: 'speakers' };
    }

    // ── Peripherals ─────────────────────────────────────────────────────
    if (
        textHasAny(blob, [
            'keyboard',
            'mouse',
            'mousepad',
            'mouse pad',
            'gamepad',
            'controller',
            'combo',
            'desk mat',
        ]) ||
        categoryNames.some((n) => textHasAny(n, ['peripheral', 'keyboard', 'mouse']))
    ) {
        if (textHasAny(blob, ['combo', 'keyboard and mouse', 'keyboard & mouse', 'bundle'])) {
            return { dept: 'peripherals', leaf: 'combos' };
        }
        if (textHasAny(blob, ['mousepad', 'mouse pad', 'desk mat'])) {
            return { dept: 'peripherals', leaf: 'mousepads' };
        }
        if (textHasAny(blob, ['keyboard'])) {
            return { dept: 'peripherals', leaf: 'keyboards' };
        }
        if (textHasAny(blob, ['mouse', 'mice', 'gaming mouse'])) {
            return { dept: 'peripherals', leaf: 'mice' };
        }
        if (textHasAny(blob, ['controller', 'gamepad'])) {
            return { dept: 'peripherals', leaf: 'controllers' };
        }
        return { dept: 'peripherals', leaf: null };
    }

    return null;
}

function categoryLooksDepartmentRelated(slug: string, name: string): boolean {
    const blob = `${slug} ${name}`;
    return DEPARTMENT_SLUG_FRAGMENTS.some((frag) => normalize(blob).includes(normalize(frag)));
}

async function main(): Promise<void> {
    const reclassify = process.argv.includes('--reclassify');
    await connect();

    console.log('[migrate:filter-layout] Ensuring category hierarchy…');
    const audio = await ensureCategory('Audio', 'audio', null);
    const headsets = await ensureCategory('Headsets', 'headsets', audio._id);
    const microphones = await ensureCategory('Microphones', 'microphones', audio._id);
    const speakers = await ensureCategory('Speakers', 'speakers', audio._id);

    const cooling = await ensureCategory('Cooling', 'cooling', null);
    const airCoolers = await ensureCategory('Air Coolers', 'air-coolers', cooling._id);
    const aioCoolers = await ensureCategory('AIO Liquid Coolers', 'aio-liquid-coolers', cooling._id);
    const caseFans = await ensureCategory('Case Fans', 'case-fans', cooling._id);
    const laptopPads = await ensureCategory('Laptop Cooling Pads', 'laptop-cooling-pads', cooling._id);
    const thermalPaste = await ensureCategory('Thermal Paste', 'thermal-paste', cooling._id);

    const peripherals = await ensureCategory('Peripherals', 'peripherals', null);
    const keyboards = await ensureCategory('Keyboards', 'keyboards', peripherals._id);
    const mice = await ensureCategory('Mice', 'mice', peripherals._id);
    const mousepads = await ensureCategory('Mousepads', 'mousepads', peripherals._id);
    const controllers = await ensureCategory('Controllers', 'controllers', peripherals._id);
    const combos = await ensureCategory('Combos', 'combos', peripherals._id);

    const power = await ensureCategory('Power', 'power', null);
    const ups = await ensureCategory('UPS', 'ups', power._id);

    const leafBySlug: Record<LeafSlug, CatRef> = {
        headsets,
        microphones,
        speakers,
        'air-coolers': airCoolers,
        'aio-liquid-coolers': aioCoolers,
        'case-fans': caseFans,
        'laptop-cooling-pads': laptopPads,
        'thermal-paste': thermalPaste,
        keyboards,
        mice,
        mousepads,
        controllers,
        combos,
        ups,
    };

    const parentByDept: Record<Dept, CatRef> = {
        audio,
        cooling,
        peripherals,
        power,
    };

    const canonicalIds = new Set<string>(
        [
            audio,
            headsets,
            microphones,
            speakers,
            cooling,
            airCoolers,
            aioCoolers,
            caseFans,
            laptopPads,
            thermalPaste,
            peripherals,
            keyboards,
            mice,
            mousepads,
            controllers,
            combos,
            power,
            ups,
        ].map((c) => String(c._id))
    );

    if (!reclassify) {
        console.log('[migrate:filter-layout] Done (categories only). Pass --reclassify to update products.');
        await mongoose.disconnect();
        return;
    }

    const allCategories = await Category.find({}).lean();
    const departmentCategoryIds = new Set<string>();
    for (const c of allCategories) {
        const slug = String(c.slug ?? '');
        const name = String(c.name ?? '');
        if (canonicalIds.has(String(c._id)) || categoryLooksDepartmentRelated(slug, name)) {
            departmentCategoryIds.add(String(c._id));
        }
    }

    const nameById = new Map<string, string>();
    for (const c of allCategories) {
        nameById.set(String(c._id), `${c.name ?? ''} (${c.slug ?? ''})`);
    }

    const cursor = Product.find({}).cursor();
    let scanned = 0;
    let touched = 0;
    const placementCounts: Record<string, number> = {};

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
        const originalNames = originalIds.map((id) => nameById.get(id) ?? '').filter(Boolean);

        const hasDeptTag = originalIds.some((id) => departmentCategoryIds.has(id));
        const specsObj: Record<string, string> =
            product.specs instanceof Map
                ? Object.fromEntries(product.specs.entries())
                : (product.specs ?? {});

        const classification = classifyProduct(product.title ?? '', specsObj, originalNames);
        if (!classification) {
            if (!hasDeptTag) continue;
            // Department-tagged in DB but no keyword match — leave categoryIds unchanged.
            continue;
        }

        const target = classification.leaf
            ? leafBySlug[classification.leaf]
            : parentByDept[classification.dept];

        const nextIds = new Set<string>();
        for (const id of originalIds) {
            if (!departmentCategoryIds.has(id)) nextIds.add(id);
        }
        nextIds.add(String(target._id));

        const before = [...new Set(originalIds)].sort().join(',');
        const after = [...nextIds].sort().join(',');
        if (before === after) continue;

        product.categoryIds = [...nextIds].map(
            (s) => new mongoose.Types.ObjectId(s)
        ) as unknown as mongoose.Types.ObjectId[];
        await product.save();
        touched += 1;
        placementCounts[target.slug] = (placementCounts[target.slug] ?? 0) + 1;
    }

    console.log(`[migrate:filter-layout] Scanned ${scanned} products, updated ${touched}.`);
    console.log('[migrate:filter-layout] Placement summary:', placementCounts);

    await mongoose.disconnect();
    console.log('[migrate:filter-layout] Done.');
}

main().catch(async (err) => {
    console.error('[migrate:filter-layout] FAILED:', err);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});
