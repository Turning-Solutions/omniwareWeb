/**
 * Loose key used to decide whether two spec/attribute names are "the same" for
 * comparison: case-, punctuation- and separator-insensitive ("Ram_Type", "RAM type:"
 * and "ram-type" all become "ram type"). Keep in sync with client `lib/attributeMatchKey.ts`.
 */
export const attributeMatchKey = (name: string | null | undefined): string =>
    String(name ?? '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
