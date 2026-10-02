/**
 * Loose key used to decide whether two spec/attribute names are "the same" for
 * comparison: case-, punctuation- and separator-insensitive ("Ram_Type", "RAM type:"
 * and "ram-type" all become "ram type"). Keep in sync with server `utils/attributeMatchKey.ts`.
 */
export const attributeMatchKey = (name: string | null | undefined): string =>
    String(name ?? "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

/**
 * Even looser key: ignores bracketed notes and plurals, so "Terabytes Written (TBW)",
 * "Terabyte Written" and "terabytes-written" all collapse to "terabyte written".
 */
export const attributeLooseKey = (name: string | null | undefined): string => {
    const withoutBrackets = String(name ?? "").replace(/\([^)]*\)/g, " ");
    const key = attributeMatchKey(withoutBrackets) || attributeMatchKey(name);
    return key
        .split(" ")
        .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
        .join(" ");
};

export type AttributeAliasGroup = { canonical: string; aliases: string[] };

export type ResolvedAttribute = { key: string; label: string };

/** Build a resolver that maps any spec/attribute name to its merged (canonical) row. */
export function buildAttributeResolver(groups: AttributeAliasGroup[] | undefined) {
    const byAlias = new Map<string, ResolvedAttribute>();
    const byLooseAlias = new Map<string, ResolvedAttribute>();
    for (const group of groups ?? []) {
        const resolved = { key: `alias:${attributeLooseKey(group.canonical)}`, label: group.canonical };
        for (const alias of [group.canonical, ...group.aliases]) {
            const key = attributeMatchKey(alias);
            if (key && !byAlias.has(key)) byAlias.set(key, resolved);
            const loose = attributeLooseKey(alias);
            if (loose && !byLooseAlias.has(loose)) byLooseAlias.set(loose, resolved);
        }
    }
    // Unmapped names still merge when they only differ by plural / bracketed note.
    return (name: string): ResolvedAttribute =>
        byAlias.get(attributeMatchKey(name)) ??
        byLooseAlias.get(attributeLooseKey(name)) ?? {
            key: attributeLooseKey(name),
            label: name.replaceAll("_", " ").trim(),
        };
}
