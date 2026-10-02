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

export type AttributeAliasGroup = { canonical: string; aliases: string[] };

export type ResolvedAttribute = { key: string; label: string };

/** Build a resolver that maps any spec/attribute name to its merged (canonical) row. */
export function buildAttributeResolver(groups: AttributeAliasGroup[] | undefined) {
    const byAlias = new Map<string, ResolvedAttribute>();
    for (const group of groups ?? []) {
        const resolved = { key: `alias:${attributeMatchKey(group.canonical)}`, label: group.canonical };
        for (const alias of [group.canonical, ...group.aliases]) {
            const key = attributeMatchKey(alias);
            if (key && !byAlias.has(key)) byAlias.set(key, resolved);
        }
    }
    return (name: string): ResolvedAttribute => {
        const key = attributeMatchKey(name);
        return byAlias.get(key) ?? { key, label: name.replaceAll("_", " ").trim() };
    };
}
