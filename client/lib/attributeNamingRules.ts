/**
 * Naming scheme rules for attribute-name normalisation (shared by the API and the admin UI).
 *
 * A rule says: occurrences of raw name `key` (attributeMatchKey form) — optionally only those
 * whose value has one of `signatures` (value shape, see server attributeInventory) and/or whose
 * product brand is one of `brands` — should be renamed to canonical attribute `canonicalId`,
 * or keep their original name when `canonicalId` is null. Values are never changed.
 */

export type RuleConfidence = "high" | "medium" | "low";

export interface CanonicalAttribute {
    id: string;
    name: string;
    description?: string;
}

export interface NamingRule {
    key: string;
    canonicalId: string | null;
    signatures?: string[];
    brands?: string[];
    confidence: RuleConfidence;
    reason?: string;
    source: "ai" | "admin";
}

export interface UnresolvedName {
    key: string;
    note: string;
}

export type RuleMatch =
    | { status: "matched"; canonicalId: string | null; rule: NamingRule }
    | { status: "conflict"; rules: NamingRule[] }
    | { status: "none" };

export const canonicalIdFromName = (name: string): string =>
    name
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "attribute";

const sameBrand = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function specificity(rule: NamingRule): number {
    return (rule.brands?.length ? 2 : 0) + (rule.signatures?.length ? 1 : 0);
}

/** The rule that applies to one occurrence. The most specific matching rule wins; ties that disagree are a conflict. */
export function matchNamingRule(rules: NamingRule[], key: string, signature: string, brand: string): RuleMatch {
    const candidates = rules.filter(
        (r) =>
            r.key === key &&
            (!r.signatures?.length || r.signatures.includes(signature)) &&
            (!r.brands?.length || r.brands.some((b) => sameBrand(b, brand)))
    );
    if (candidates.length === 0) return { status: "none" };
    const top = Math.max(...candidates.map(specificity));
    const best = candidates.filter((r) => specificity(r) === top);
    const targets = new Set(best.map((r) => r.canonicalId ?? ""));
    if (targets.size > 1) return { status: "conflict", rules: best };
    return { status: "matched", canonicalId: best[0].canonicalId, rule: best[0] };
}

/** Review-table value for one cell: a canonical id, KEEP, UNSET (no rule) or CONFLICT. */
export const KEEP = "__keep__";
export const UNSET = "__unset__";
export const CONFLICT = "__conflict__";

export interface ShapeRow {
    signature: string;
    /** Target for the whole shape when not split by brand. */
    target: string;
    /** Per-brand targets when the shape is split by brand. */
    brandTargets: Record<string, string> | null;
    reason?: string;
    confidence?: RuleConfidence;
}

const matchToTarget = (m: RuleMatch) =>
    m.status === "none" ? UNSET : m.status === "conflict" ? CONFLICT : m.canonicalId ?? KEEP;

/** Turn a name's rules into one row per value shape (split into brands only where rules differ by brand). */
export function rulesToRows(
    key: string,
    shapes: { signature: string; brands: string[] }[],
    rules: NamingRule[]
): ShapeRow[] {
    return shapes.map((shape) => {
        const perBrand = shape.brands.map((brand) => ({ brand, match: matchNamingRule(rules, key, shape.signature, brand) }));
        const targets = new Set(perBrand.map((p) => matchToTarget(p.match)));
        const firstMatched = perBrand.find((p) => p.match.status === "matched")?.match as
            | Extract<RuleMatch, { status: "matched" }>
            | undefined;
        const meta = { reason: firstMatched?.rule.reason, confidence: firstMatched?.rule.confidence };
        if (targets.size <= 1) {
            return { signature: shape.signature, target: [...targets][0] ?? UNSET, brandTargets: null, ...meta };
        }
        return {
            signature: shape.signature,
            target: UNSET,
            brandTargets: Object.fromEntries(perBrand.map((p) => [p.brand, matchToTarget(p.match)])),
            ...meta,
        };
    });
}

/** Rebuild a name's rules from its edited rows (admin edits become high-confidence admin rules). */
export function rowsToRules(key: string, rows: ShapeRow[], previous: NamingRule[]): NamingRule[] {
    const keyReason = previous.find((r) => r.key === key && r.reason)?.reason;
    const toCanonical = (target: string) => (target === KEEP ? null : target);
    const valid = (target: string) => target !== UNSET && target !== CONFLICT;

    // Everything unsplit and pointing the same way → one unconditional rule.
    const unsplit = rows.every((r) => !r.brandTargets);
    const targets = new Set(rows.map((r) => r.target));
    if (unsplit && targets.size === 1 && valid(rows[0]?.target ?? UNSET)) {
        return [{ key, canonicalId: toCanonical(rows[0].target), confidence: "high", reason: rows[0].reason ?? keyReason, source: "admin" }];
    }

    const rules: NamingRule[] = [];
    for (const row of rows) {
        if (row.brandTargets) {
            for (const [brand, target] of Object.entries(row.brandTargets)) {
                if (!valid(target)) continue;
                rules.push({
                    key,
                    canonicalId: toCanonical(target),
                    signatures: [row.signature],
                    brands: [brand],
                    confidence: "high",
                    reason: row.reason ?? keyReason,
                    source: "admin",
                });
            }
        } else if (valid(row.target)) {
            rules.push({
                key,
                canonicalId: toCanonical(row.target),
                signatures: [row.signature],
                confidence: "high",
                reason: row.reason ?? keyReason,
                source: "admin",
            });
        }
    }
    return rules;
}
