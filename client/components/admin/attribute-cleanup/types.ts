import type { CanonicalAttribute, NamingRule, UnresolvedName } from "@/lib/attributeNamingRules";

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
    flags: { ambiguous: boolean; brandSpecific: boolean; multiGroup: boolean };
}

export interface Inventory {
    categoryId: string;
    categoryName: string;
    productCount: number;
    occurrenceCount: number;
    names: InventoryName[];
}

export interface NamingScheme {
    status: "draft" | "approved";
    canonical: CanonicalAttribute[];
    rules: NamingRule[];
    unresolved: UnresolvedName[];
    generation?: { model?: string; startedAt?: string; completedChunks: number; totalChunks: number };
    approvedAt?: string;
    approvedBy?: string;
    updatedAt?: string;
}
