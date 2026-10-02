import { attributeMatchKey } from "@/lib/attributeMatchKey";

/** Words that don't change what an attribute is about ("Memory Support" ≈ "Memory"). */
const FILLER_WORDS = new Set(["the", "of", "and", "for", "with", "info", "information", "details", "spec", "specs"]);

/** Words that can be appended to a name without changing what it describes. */
const GENERIC_EXTRA_WORDS = new Set([
    "type", "support", "supported", "version", "standard", "model", "feature", "name", "value", "detail",
]);

const singular = (word: string) =>
    word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;

function tokens(key: string): string[] {
    return key.split(" ").filter(Boolean).map(singular);
}

function meaningfulTokens(key: string): string[] {
    const t = tokens(key).filter((w) => !FILLER_WORDS.has(w));
    return t.length ? t : tokens(key);
}

function initials(words: string[]): string {
    return words.map((w) => w[0]).join("");
}

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
            diag = tmp;
        }
    }
    return prev[b.length];
}

export type SimilarityResult = { score: number; reason: string };

/** How likely two attribute names describe the same thing (0–1) and why. */
export function attributeSimilarity(nameA: string, nameB: string): SimilarityResult {
    const a = attributeMatchKey(nameA);
    const b = attributeMatchKey(nameB);
    if (!a || !b) return { score: 0, reason: "" };
    if (a === b) return { score: 1, reason: "Same name" };

    const compactA = a.replace(/ /g, "");
    const compactB = b.replace(/ /g, "");
    if (compactA === compactB) return { score: 0.95, reason: "Same name, different spacing" };

    const ta = meaningfulTokens(a);
    const tb = meaningfulTokens(b);
    if (ta.join(" ") === tb.join(" ")) return { score: 0.95, reason: "Same words" };

    // Different numbers mean different things ("USB 2.0 Ports" vs "USB 3.2 Ports").
    const digitsA = a.match(/\d+/g)?.join(" ") ?? "";
    const digitsB = b.match(/\d+/g)?.join(" ") ?? "";
    if (digitsA !== digitsB) return { score: 0, reason: "" };

    // "OS" vs "Operating System", "TDP" vs "Thermal Design Power"
    const allA = tokens(a);
    const allB = tokens(b);
    if (allA.length === 1 && allB.length > 1 && (compactA === initials(allB) || compactA === initials(tb))) {
        return { score: 0.9, reason: "Abbreviation" };
    }
    if (allB.length === 1 && allA.length > 1 && (compactB === initials(allA) || compactB === initials(ta))) {
        return { score: 0.9, reason: "Abbreviation" };
    }

    const setA = new Set(ta);
    const setB = new Set(tb);
    const shared = [...setA].filter((w) => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    const jaccard = union ? shared / union : 0;

    const longer = Math.max(compactA.length, compactB.length);
    const spelling = longer ? 1 - levenshtein(compactA, compactB) / longer : 0;
    // Typos only: same number of words, nearly the same letters ("Bluetooh" vs "Bluetooth").
    if (ta.length === tb.length && spelling >= 0.85) return { score: spelling, reason: "Similar spelling" };

    // "Socket" vs "Socket Type": only when the extra words don't change the meaning —
    // "Audio" vs "Audio Jacks" or "Connector" vs "Fan Connectors" are different things.
    const smaller = setA.size <= setB.size ? setA : setB;
    const larger = smaller === setA ? setB : setA;
    if (smaller.size > 0 && [...smaller].every((w) => larger.has(w))) {
        const extra = [...larger].filter((w) => !smaller.has(w));
        if (extra.every((w) => GENERIC_EXTRA_WORDS.has(w))) {
            return { score: 0.8, reason: "Same name with a generic extra word" };
        }
        // Below the suggestion threshold, but still flagged "Similar" when picking names manually.
        return { score: 0.6, reason: "One name contains the other" };
    }

    // Needs real overlap: "USB 2.0 Header" vs "USB 2.0 Ports" share words but aren't the same.
    if (jaccard >= 0.75) return { score: jaccard, reason: "Shares most words" };
    return { score: Math.max(jaccard, spelling * 0.6), reason: "" };
}

export const SUGGESTION_THRESHOLD = 0.7;

/**
 * Group names that look alike. Complete linkage: a name only joins a group when it is
 * similar to *every* name already in it, so loose pairs can't chain unrelated names together.
 * Returns only groups with two or more names.
 */
export function clusterSimilarNames(names: string[], threshold = SUGGESTION_THRESHOLD) {
    const n = names.length;
    const scores = new Map<string, SimilarityResult>();
    const pairKey = (i: number, j: number) => (i < j ? `${i}:${j}` : `${j}:${i}`);
    const pairs: { i: number; j: number; score: number }[] = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const result = attributeSimilarity(names[i], names[j]);
            if (result.score < threshold) continue;
            scores.set(pairKey(i, j), result);
            pairs.push({ i, j, score: result.score });
        }
    }
    pairs.sort((x, y) => y.score - x.score);

    const clusterOf = names.map((_, i) => i);
    const members = new Map<number, number[]>(names.map((_, i) => [i, [i]]));
    for (const { i, j } of pairs) {
        const ci = clusterOf[i];
        const cj = clusterOf[j];
        if (ci === cj) continue;
        const a = members.get(ci)!;
        const b = members.get(cj)!;
        const allSimilar = a.every((x) => b.every((y) => scores.has(pairKey(x, y))));
        if (!allSimilar) continue;
        for (const y of b) clusterOf[y] = ci;
        members.set(ci, [...a, ...b]);
        members.delete(cj);
    }

    return Array.from(members.values())
        .filter((group) => group.length > 1)
        .map((group) => ({
            names: group.map((i) => names[i]),
            reason: scores.get(pairKey(group[0], group[1]))?.reason || "Similar names",
        }));
}
