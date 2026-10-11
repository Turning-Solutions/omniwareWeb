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

export type ConversionStatus = "queued" | "pending" | "approved" | "skipped" | "failed";

export interface ConversionItem {
    id: string;
    productId: string;
    title: string;
    /** Main SKU, shown in the list. */
    sku?: string;
    /** Main + variant + colour SKUs, for searching. */
    skus: string[];
    brand: string;
    image?: string;
    status: ConversionStatus;
    needsLook: boolean;
    error?: string;
    /** Standard fields with a value. */
    filled: number;
    fieldCount: number;
    /** Old details that will be removed. */
    removing: number;
}

export interface ConversionField {
    name: string;
    value: string;
    basis: "copied" | "typed" | "reformatted" | "inferred" | "missing";
    sources: { id: string; name: string; value: string }[];
    note?: string;
    check: boolean;
    example?: string;
}

export interface ConversionExisting {
    id: string;
    container: "specs" | "attributeGroups" | "attributes";
    groupName?: string;
    name: string;
    value: string;
    usedFor: string[];
    replaced: boolean;
    keep: boolean;
}

export interface ConversionDetail {
    id: string;
    productId: string;
    productSlug?: string;
    title: string;
    brand: string;
    image?: string;
    status: ConversionStatus;
    needsLook: boolean;
    error?: string;
    aiModel?: string;
    fields: ConversionField[];
    existing: ConversionExisting[];
    approvedAt?: string;
    approvedBy?: string;
    stale: boolean;
    staleMessage?: string;
}
