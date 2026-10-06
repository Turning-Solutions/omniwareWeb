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

/** What the browser may know about the active AI provider (never any key). */
export interface ActiveAi {
    providerId: string;
    providerLabel: string;
    model: string;
    configured: boolean;
    keySet: boolean;
    keyEnv: string;
    minGapSeconds: number;
    chunkSize: number;
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

export interface ReviewItem {
    id: string;
    productId: string;
    title: string;
    brand: string;
    image?: string;
    status: "pending" | "accepted" | "rejected";
    needsLook: boolean;
    changeCount: number;
}

export interface ReviewChange {
    container: "specs" | "attributeGroups" | "attributes";
    groupName?: string;
    oldName: string;
    newName: string;
    value: string;
    confidence: "high" | "medium" | "low";
    reason?: string;
}

export interface ReviewDetail {
    id: string;
    productId: string;
    productSlug?: string;
    title: string;
    brand: string;
    image?: string;
    status: "pending" | "accepted" | "rejected";
    needsLook: boolean;
    collisions: string[];
    changes: ReviewChange[];
    acceptedAt?: string;
    acceptedBy?: string;
    stale: boolean;
    staleMessage?: string;
    canonicalNames: string[];
}
