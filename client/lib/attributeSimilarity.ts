import { attributeMatchKey } from "@/lib/attributeMatchKey";

/** Words that don't change what an attribute is about ("Memory Support" ≈ "Memory"). */
const FILLER_WORDS = new Set(["the", "of", "and", "for", "with", "info", "information", "details", "spec", "specs"]);

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
    const shared = ta.filter((w) => setB.has(w)).length;
    const union = new Set([...ta, ...tb]).size;
    const jaccard = union ? shared / union : 0;

    const longer = Math.max(compactA.length, compactB.length);
    const spelling = longer ? 1 - levenshtein(compactA, compactB) / longer : 0;
    if (spelling >= 0.85) return { score: spelling, reason: "Similar spelling" };

    const smaller = setA.size <= setB.size ? setA : setB;
    const larger = smaller === setA ? setB : setA;
    if (smaller.size > 0 && [...smaller].every((w) => larger.has(w))) {
        return { score: 0.75, reason: "One name contains the other" };
    }

    if (jaccard >= 0.5) return { score: jaccard, reason: "Shares most words" };
    return { score: Math.max(jaccard, spelling * 0.6), reason: "" };
}

export const SUGGESTION_THRESHOLD = 0.7;

/**
 * Cluster names that look alike (union-find over pairwise similarity).
 * Returns only clusters with two or more names.
 */
export function clusterSimilarNames(names: string[], threshold = SUGGESTION_THRESHOLD) {
    const parent = names.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const links: { i: number; reason: string }[] = [];

    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const { score, reason } = attributeSimilarity(names[i], names[j]);
            if (score < threshold) continue;
            links.push({ i, reason });
            const ri = find(i);
            const rj = find(j);
            if (ri !== rj) parent[rj] = ri;
        }
    }

    const clusters = new Map<number, number[]>();
    names.forEach((_, i) => {
        const root = find(i);
        if (!clusters.has(root)) clusters.set(root, []);
        clusters.get(root)!.push(i);
    });

    return Array.from(clusters.entries())
        .filter(([, members]) => members.length > 1)
        .map(([root, members]) => ({
            names: members.map((i) => names[i]),
            reason: links.find((link) => find(link.i) === root)?.reason || "Similar names",
        }));
}
