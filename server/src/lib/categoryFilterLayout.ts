/**
 * Shop category filter layout — single source of truth for sidebar + API category matching.
 * Keep in sync with any duplicate under server/src/lib when changing layout.
 */
export type CategoryLayoutNode = {
    label: string;
    valueAliases?: string[];
    groupOnly?: boolean;
    passthrough?: boolean;
    children?: CategoryLayoutNode[];
};

export const CATEGORY_FILTER_LAYOUT: CategoryLayoutNode[] = [
    { label: "Processor", valueAliases: ["processor", "processors", "cpu", "cpus"] },
    { label: "Motherboard", valueAliases: ["motherboard", "motherboards", "mobo", "mobos"] },
    { label: "RAM", valueAliases: ["ram", "memory", "memories", "ddr4", "ddr5"] },
    {
        label: "Graphics Card",
        valueAliases: [
            "graphics-card", "graphics-cards", "graphic-card",
            "gpu", "gpus", "vga",
            "video-card", "video-cards",
        ],
    },
    { label: "Power Supply", valueAliases: ["power-supply", "power-supplies", "psu", "psus"] },

    {
        label: "Storage",
        valueAliases: ["storage", "storages"],
        children: [
            {
                label: "Internal",
                groupOnly: true,
                children: [
                    {
                        label: "HDD",
                        valueAliases: [
                            "hdd", "hdds", "internal-hdd",
                            "hard-disk", "hard-disks",
                            "hard-drive", "hard-drives",
                        ],
                    },
                    {
                        label: "SATA SSD",
                        valueAliases: [
                            "sata-ssd", "sata-ssds", "sata",
                        ],
                    },
                    {
                        label: "NVMe SSD (Gen 3/4/5)",
                        valueAliases: [
                            "nvme-ssd", "nvme-ssds",
                            "nvme", "nvmes",
                            "m2-nvme", "m2-ssd", "m2", "m-2", "m-2-nvme",
                            "m2-nvme-ssd", "m.2", "m.2-nvme", "m.2-ssd",
                            "nvme-ssd-gen-3-4-5",
                            "nvme-ssd-gen3", "nvme-ssd-gen4", "nvme-ssd-gen5",
                            "gen3-nvme", "gen4-nvme", "gen5-nvme",
                            "ssd", "ssds",
                            "solid-state-drive", "solid-state-drives",
                            "internal-ssd", "internal-ssds",
                        ],
                    },
                ],
            },
            {
                label: "External",
                groupOnly: true,
                children: [
                    {
                        label: "External HDD",
                        valueAliases: [
                            "external-hdd", "external-hdds",
                            "external-hard-disk", "external-hard-drive",
                            "external-hard-drives",
                        ],
                    },
                    {
                        label: "External SSD",
                        valueAliases: [
                            "external-ssd", "external-ssds",
                            "portable-ssd",
                        ],
                    },
                ],
            },
        ],
    },

    {
        label: "Cooling",
        valueAliases: ["cooling", "coolers"],
        children: [
            {
                label: "Air Coolers",
                valueAliases: ["air-coolers", "air-cooler", "cpu-air-cooler", "cpu-cooler"],
            },
            {
                label: "AIO Liquid Coolers",
                valueAliases: [
                    "aio-liquid-coolers", "aio-coolers", "aio",
                    "liquid-cooler", "liquid-cooling", "water-cooler",
                ],
            },
            {
                label: "Case Fans",
                valueAliases: ["case-fans", "case-fan", "fan", "fans", "rgb-fan"],
            },
            {
                label: "Laptop Cooling Pads",
                valueAliases: [
                    "laptop-cooling-pads", "laptop-cooling-pad",
                    "cooling-pad", "cooling-pads",
                ],
            },
            {
                label: "Thermal Paste",
                valueAliases: [
                    "thermal-paste", "thermal-compound",
                    "thermal-grease", "thermal-interface",
                ],
            },
        ],
    },

    {
        label: "PC Cases",
        valueAliases: [
            "pc-cases", "pc-case", "cases",
            "chassis", "cabinet", "tower",
        ],
    },

    {
        label: "Audio",
        valueAliases: ["audio"],
        children: [
            {
                label: "Headsets",
                valueAliases: ["headsets", "headset", "headphones", "headphone", "earphones"],
            },
            {
                label: "Microphones",
                valueAliases: ["microphones", "microphone", "mic", "mics"],
            },
            {
                label: "Speakers",
                valueAliases: ["speakers", "speaker"],
            },
        ],
    },

    {
        label: "Peripherals",
        valueAliases: ["peripherals", "peripheral"],
        children: [
            {
                label: "Keyboards",
                valueAliases: ["keyboards", "keyboard", "mechanical-keyboard"],
            },
            {
                label: "Mice",
                valueAliases: ["mice", "mouse", "gaming-mouse"],
            },
            {
                label: "Mousepads",
                valueAliases: ["mousepads", "mousepad", "mouse-pad", "mouse-pads"],
            },
            {
                label: "Controllers",
                valueAliases: ["controllers", "controller", "gamepad", "gamepads"],
            },
            {
                label: "Combos",
                valueAliases: [
                    "combos", "combo", "combo-sets",
                    "peripheral-combo", "keyboard-mouse-combo",
                ],
            },
        ],
    },

    {
        label: "Power",
        valueAliases: ["power"],
        children: [
            {
                label: "UPS",
                valueAliases: [
                    "ups", "uninterruptible-power-supply",
                    "battery-backup",
                ],
            },
        ],
    },
];

export function slugifyCategoryLabel(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function primaryCategorySlug(node: CategoryLayoutNode): string {
    const first = node.valueAliases?.find((a) => a.trim());
    if (first) return first.toLowerCase().trim();
    return slugifyCategoryLabel(node.label);
}

function matchesSlug(node: CategoryLayoutNode, slug: string): boolean {
    const s = slug.toLowerCase().trim();
    if (node.valueAliases?.some((a) => a.toLowerCase().trim() === s)) return true;
    if (slugifyCategoryLabel(node.label) === s) return true;
    if (primaryCategorySlug(node) === s) return true;
    return false;
}

function collectSubtreeSlugs(node: CategoryLayoutNode): string[] {
    const out: string[] = [];
    const add = (x: string) => {
        const t = x.toLowerCase().trim();
        if (t) out.push(t);
    };
    for (const a of node.valueAliases ?? []) add(a);
    add(slugifyCategoryLabel(node.label));
    add(primaryCategorySlug(node));
    if (node.children) {
        for (const ch of node.children) {
            out.push(...collectSubtreeSlugs(ch));
        }
    }
    return Array.from(new Set(out));
}

function findLayoutParentNodeWithChildrenBySlug(slug: string): CategoryLayoutNode | null {
    function walk(nodes: CategoryLayoutNode[]): CategoryLayoutNode | null {
        for (const n of nodes) {
            if (n.children && n.children.length > 0 && matchesSlug(n, slug)) return n;
            const sub = walk(n.children ?? []);
            if (sub) return sub;
        }
        return null;
    }
    return walk(CATEGORY_FILTER_LAYOUT);
}

/**
 * When the URL filter uses a layout department slug (e.g. `audio`, `peripherals`), products are
 * usually tagged with leaf category IDs. If Category.parentId links are missing, expanding only
 * from the parent row's DB document misses those leaves. We union all layout alias slugs under
 * that department so Category.find + expandCategoryTreeIds match the same products the sidebar
 * rolls up in counts.
 */
export function expandLayoutSlugForCategoryFilter(slug: string): string[] | null {
    const n = findLayoutParentNodeWithChildrenBySlug(slug);
    if (!n) return null;
    return collectSubtreeSlugs(n);
}
