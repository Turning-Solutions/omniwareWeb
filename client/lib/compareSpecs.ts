/**
 * Helpers for the product comparison view: parse free-text spec values into
 * comparable numbers and decide which product "wins" each spec row.
 *
 * Specs are admin-entered strings ("32GB (2 x 16GB)", "CL30", "6000 MHz", "3 Years"),
 * so this is deliberately conservative — a row is only highlighted when every
 * value parses into the same unit family and the spec has a clear better direction.
 */

export type SpecDirection = "higher" | "lower" | "none";

type ParsedSpecValue = {
    value: number;
    /** Unit family (e.g. "bytes", "freq"); values are only compared within one family. */
    family: string;
};

type UnitInfo = { family: string; factor: number };

const UNITS: Record<string, UnitInfo> = {
    // Storage / memory (base: GB)
    kb: { family: "bytes", factor: 1 / (1024 * 1024) },
    mb: { family: "bytes", factor: 1 / 1024 },
    gb: { family: "bytes", factor: 1 },
    tb: { family: "bytes", factor: 1024 },
    // Throughput (base: MB/s)
    "mb/s": { family: "throughput", factor: 1 },
    "mbps": { family: "throughput", factor: 1 / 8 },
    "gb/s": { family: "throughput", factor: 1024 },
    "gbps": { family: "throughput", factor: 1024 / 8 },
    // Frequency (base: MHz)
    hz: { family: "freq", factor: 1 / 1_000_000 },
    khz: { family: "freq", factor: 1 / 1000 },
    mhz: { family: "freq", factor: 1 },
    ghz: { family: "freq", factor: 1000 },
    "mt/s": { family: "freq", factor: 1 },
    mts: { family: "freq", factor: 1 },
    // Power / energy
    w: { family: "watts", factor: 1 },
    kw: { family: "watts", factor: 1000 },
    mah: { family: "mah", factor: 1 },
    wh: { family: "wh", factor: 1 },
    v: { family: "volts", factor: 1 },
    mv: { family: "volts", factor: 1 / 1000 },
    // Time (base: ms)
    ns: { family: "time", factor: 1 / 1_000_000 },
    us: { family: "time", factor: 1 / 1000 },
    ms: { family: "time", factor: 1 },
    // Durations (base: months)
    month: { family: "duration", factor: 1 },
    months: { family: "duration", factor: 1 },
    mo: { family: "duration", factor: 1 },
    year: { family: "duration", factor: 12 },
    years: { family: "duration", factor: 12 },
    yr: { family: "duration", factor: 12 },
    yrs: { family: "duration", factor: 12 },
    // Length (base: mm)
    mm: { family: "length", factor: 1 },
    cm: { family: "length", factor: 10 },
    in: { family: "length", factor: 25.4 },
    inch: { family: "length", factor: 25.4 },
    inches: { family: "length", factor: 25.4 },
    '"': { family: "length", factor: 25.4 },
    // Weight (base: g)
    g: { family: "weight", factor: 1 },
    kg: { family: "weight", factor: 1000 },
    // Misc
    db: { family: "db", factor: 1 },
    dba: { family: "db", factor: 1 },
    rpm: { family: "rpm", factor: 1 },
    cfm: { family: "cfm", factor: 1 },
    fps: { family: "fps", factor: 1 },
    hrs: { family: "hours", factor: 1 },
    hours: { family: "hours", factor: 1 },
    "%": { family: "percent", factor: 1 },
    p: { family: "resolution_p", factor: 1 },
    k: { family: "resolution_k", factor: 1 },
};

/** Specs where a smaller number is better. */
const LOWER_IS_BETTER_KEY_RE =
    /latency|\bcas\b|\bcl\b|timing|weight|noise|loudness|response[\s_]*time|input[\s_]*lag|\btdp\b|power[\s_]*(consumption|draw)|voltage|price|delay|thickness/i;
const LOWER_IS_BETTER_FAMILIES = new Set(["time", "db"]);

/** Specs that describe an identity/fit rather than a quality — never highlighted. */
const NEUTRAL_KEY_RE =
    /model|part[\s_]*(no|number|#)|\bsku\b|\bmpn\b|\bean\b|\bupc\b|series|colou?r|\byear\b|release|dimension|height|width|depth|length|socket|chipset|form[\s_]*factor|\btype\b|interface|connector|material|compatib|\bos\b|operating[\s_]*system/i;

const NUMBER_RE = /(\d+(?:[.,]\d+)?)\s*([a-z%"]+(?:\/s)?)?/i;
const MULTIPLY_RE = /^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*([a-z%"]+(?:\/s)?)?/i;

function toNumber(raw: string): number {
    // "1,000" -> 1000, "1,5" -> 1.5
    if (/^\d{1,3}(,\d{3})+$/.test(raw)) return Number(raw.replace(/,/g, ""));
    return Number(raw.replace(",", "."));
}

function unitInfo(unit: string | undefined): UnitInfo {
    if (!unit) return { family: "", factor: 1 };
    const u = unit.toLowerCase();
    return UNITS[u] ?? { family: `u:${u}`, factor: 1 };
}

/** Parse a spec string into a comparable number, or null if it has no usable number. */
export function parseSpecValue(raw: string | null | undefined): ParsedSpecValue | null {
    if (raw == null) return null;
    const text = String(raw).trim();
    if (!text) return null;

    const lower = text.toLowerCase();
    if (/^(yes|supported|included|available)$/.test(lower)) return { value: 1, family: "bool" };
    if (/^(no|none|not supported|n\/a)$/.test(lower)) return { value: 0, family: "bool" };
    if (/lifetime/.test(lower)) return { value: Number.POSITIVE_INFINITY, family: "duration" };

    const numMatch = NUMBER_RE.exec(text);
    if (!numMatch || numMatch.index == null) return null;

    // "2 x 16GB" (kit) or "2560 x 1440" (resolution) — multiply both sides.
    const rest = text.slice(numMatch.index);
    const mul = MULTIPLY_RE.exec(rest);
    if (mul) {
        const { family, factor } = unitInfo(mul[3]);
        const value = Number(mul[1]) * Number(mul[2]) * factor;
        if (Number.isFinite(value)) return { value, family: family || "multiplied" };
    }

    const value = toNumber(numMatch[1]);
    if (!Number.isFinite(value)) return null;
    const { family, factor } = unitInfo(numMatch[2]);
    return { value: value * factor, family };
}

export function getSpecDirection(label: string, family?: string): SpecDirection {
    const key = label.replace(/_/g, " ");
    if (LOWER_IS_BETTER_KEY_RE.test(key)) return "lower";
    if (NEUTRAL_KEY_RE.test(key)) return "none";
    if (family && LOWER_IS_BETTER_FAMILIES.has(family)) return "lower";
    return "higher";
}

function normalizeForEquality(value: string | null | undefined): string {
    return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** True when not every product has the same value for this row (missing counts as different). */
export function valuesDiffer(values: (string | null | undefined)[]): boolean {
    if (values.length < 2) return false;
    const first = normalizeForEquality(values[0]);
    return values.some((v) => normalizeForEquality(v) !== first);
}

/**
 * Indexes of the products holding the best value for this row. Empty when the row
 * can't be judged (non-numeric, mixed units, neutral spec, or all values equal).
 */
export function getBestValueIndexes(
    label: string,
    values: (string | null | undefined)[],
    directionOverride?: SpecDirection
): Set<number> {
    const best = new Set<number>();
    const present = values
        .map((raw, index) => ({ raw, index }))
        .filter(({ raw }) => raw != null && String(raw).trim() !== "");
    if (present.length < 2) return best;

    const parsed = present.map(({ raw, index }) => ({ index, parsed: parseSpecValue(raw) }));
    if (parsed.some((p) => p.parsed == null)) return best;

    const family = parsed[0].parsed!.family;
    if (parsed.some((p) => p.parsed!.family !== family)) return best;

    const direction = directionOverride ?? getSpecDirection(label, family);
    if (direction === "none") return best;

    const nums = parsed.map((p) => p.parsed!.value);
    const target = direction === "higher" ? Math.max(...nums) : Math.min(...nums);
    if (nums.every((n) => n === target)) return best;

    for (const p of parsed) {
        if (p.parsed!.value === target) best.add(p.index);
    }
    return best;
}
