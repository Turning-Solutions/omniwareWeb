/** Same rules as server `normalizeSpecKey` — keep client sort aligned with API facet keys. */
export function normalizeSpecKey(key: string): string {
    if (!key) return "";
    return key
        .replace(/[_\-/\\]+/g, " ")
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("_");
}
