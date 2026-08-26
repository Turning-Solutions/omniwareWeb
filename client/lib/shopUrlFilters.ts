import type { UseProductsOptions } from "@/hooks/useProducts";

const DEFAULT_SORT = "newest";

const CONTROLLED_KEYS = new Set([
    "sub",
    "subcategories",
    "search",
    "q",
    "sort",
    "page",
    "brand",
    "minPrice",
    "maxPrice",
    "availability",
    "inStock",
    "isFeatured",
]);

export function isControlledShopQueryKey(key: string): boolean {
    if (CONTROLLED_KEYS.has(key)) return true;
    return key.startsWith("spec[");
}

/**
 * True when the URL carries any param the shop listing actually consumes, so a
 * request with none of them renders the plain, identical-for-everyone landing.
 * `s` is checked separately: `parseShopFiltersFromLocation` reads it as a legacy
 * search alias, but it is deliberately NOT in CONTROLLED_KEYS (that set also
 * drives which params `serializeShopListingUrl` strips when rewriting the URL).
 */
export function hasShopListingParams(sp: URLSearchParams): boolean {
    for (const key of sp.keys()) {
        if (isControlledShopQueryKey(key) || key === "s") return true;
    }
    return false;
}

/** Next.js `searchParams` record → flat URLSearchParams (supports repeated keys). */
export function nextSearchParamsRecordToURLSearchParams(
    sp: Record<string, string | string[] | undefined>
): URLSearchParams {
    const u = new URLSearchParams();
    for (const [key, raw] of Object.entries(sp)) {
        if (raw === undefined) continue;
        const values = Array.isArray(raw) ? raw : [raw];
        for (const item of values) {
            const s = item != null ? String(item) : "";
            if (s !== "") u.append(key, s);
        }
    }
    return u;
}

function normalizeSortFromUrl(s: string): string {
    return s.trim().toLowerCase().replace(/_/g, "-");
}

function parseBooleanish(v: string | null): boolean | undefined {
    if (v == null || v === "") return undefined;
    const x = v.trim().toLowerCase();
    if (x === "true" || x === "1") return true;
    if (x === "false" || x === "0") return false;
    return undefined;
}

/** Main category slug from `/shop/{slug}` (not `/shop` alone). */
export function shopCategorySlugFromPathname(pathname: string): string | undefined {
    const path = (pathname.replace(/\/+$/, "") || "/").split("?")[0]!;
    const m = /^\/shop\/([^/]+)$/.exec(path);
    if (!m?.[1]) return undefined;
    try {
        return decodeURIComponent(m[1]).trim().toLowerCase();
    } catch {
        return m[1].trim().toLowerCase();
    }
}

/** Match `DynamicFilterSidebar` / product API narrowing — excluding sort + page (used for facet mode). */
export function hasShopFacetNarrowing(filters: Partial<UseProductsOptions>): boolean {
    if (typeof filters.category === "string" && filters.category.trim()) return true;
    if (typeof filters.subcategories === "string" && filters.subcategories.trim()) return true;
    if (typeof filters.brand === "string" && filters.brand.trim()) return true;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) return true;
    if (typeof filters.search === "string" && filters.search.trim()) return true;
    if (filters.availability) return true;
    if (filters.inStock === "true") return true;
    if (
        filters.isFeatured === true ||
        filters.isFeatured === false ||
        filters.isFeatured === "true" ||
        filters.isFeatured === "false"
    )
        return true;
    if (filters.spec && typeof filters.spec === "object" && Object.keys(filters.spec).length > 0) return true;
    return false;
}

export function parseShopFiltersFromLocation(pathname: string, sp: URLSearchParams): Partial<UseProductsOptions> {
    const out: Partial<UseProductsOptions> = {};

    const pathCat = shopCategorySlugFromPathname(pathname);
    if (pathCat) {
        out.category = pathCat;
    }

    const sub = sp.get("sub") ?? sp.get("subcategories");
    if (sub?.trim()) {
        out.subcategories = sub.trim().toLowerCase();
    }

    const search = sp.get("search") ?? sp.get("q") ?? sp.get("s");
    if (search?.trim()) {
        out.search = search.trim();
    }

    const sort = sp.get("sort");
    if (sort?.trim()) {
        out.sort = normalizeSortFromUrl(sort);
    }

    const pageRaw = sp.get("page");
    if (pageRaw) {
        const p = parseInt(pageRaw, 10);
        if (!Number.isNaN(p) && p >= 1) out.page = p;
    }

    const brand = sp.get("brand");
    if (brand?.trim()) {
        out.brand = brand.trim();
    }

    const minP = sp.get("minPrice");
    if (minP !== null && minP !== "") {
        const n = Number(minP);
        if (!Number.isNaN(n)) out.minPrice = n;
    }
    const maxP = sp.get("maxPrice");
    if (maxP !== null && maxP !== "") {
        const n = Number(maxP);
        if (!Number.isNaN(n)) out.maxPrice = n;
    }

    const avail = sp.get("availability");
    if (avail?.trim()) {
        out.availability = avail.trim();
    }

    const stock = sp.get("inStock");
    if (stock?.trim()) {
        out.inStock = stock.trim();
    }

    const feat = parseBooleanish(sp.get("isFeatured"));
    if (feat !== undefined) {
        out.isFeatured = feat;
    }

    const spec: Record<string, string> = {};
    for (const [k, v] of sp.entries()) {
        const m = /^spec\[(.+)\]$/.exec(k);
        if (!m?.[1] || !v) continue;
        const sk = m[1];
        spec[sk] = spec[sk] ? `${spec[sk]},${v}` : v;
    }
    if (Object.keys(spec).length > 0) {
        out.spec = spec;
    }

    return out;
}

export function parseShopFiltersFromRouter(
    pathname: string,
    sp: Record<string, string | string[] | undefined>
): Partial<UseProductsOptions> {
    return parseShopFiltersFromLocation(pathname, nextSearchParamsRecordToURLSearchParams(sp));
}

function listingQueryStringFromFilters(filters: Record<string, unknown>): URLSearchParams {
    const next = new URLSearchParams();

    const cat =
        typeof filters.category === "string" && filters.category.trim()
            ? filters.category.trim().toLowerCase()
            : "";
    const subRaw = typeof filters.subcategories === "string" ? filters.subcategories : "";
    const subFirst = subRaw.split(",").filter(Boolean)[0]?.trim().toLowerCase() ?? "";
    if (subFirst && cat) {
        next.set("sub", subFirst);
    }

    const search = typeof filters.search === "string" ? filters.search.trim() : "";
    if (search) {
        next.set("search", search);
    }

    const rawSort =
        typeof filters.sort === "string" && filters.sort.trim() ? filters.sort.trim().toLowerCase() : DEFAULT_SORT;
    const sort = rawSort.replace(/_/g, "-");
    if (sort !== DEFAULT_SORT) {
        next.set("sort", sort);
    }

    const pageRaw = filters.page;
    const pageNum = typeof pageRaw === "number" && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
    if (pageNum > 1) {
        next.set("page", String(pageNum));
    }

    const brand = typeof filters.brand === "string" ? filters.brand.trim() : "";
    if (brand) {
        next.set("brand", brand);
    }

    if (filters.minPrice !== undefined && filters.minPrice !== null && !Number.isNaN(Number(filters.minPrice))) {
        next.set("minPrice", String(Number(filters.minPrice)));
    }
    if (filters.maxPrice !== undefined && filters.maxPrice !== null && !Number.isNaN(Number(filters.maxPrice))) {
        next.set("maxPrice", String(Number(filters.maxPrice)));
    }

    const availability = typeof filters.availability === "string" ? filters.availability.trim() : "";
    if (availability) {
        next.set("availability", availability);
    }

    const inStock = typeof filters.inStock === "string" ? filters.inStock.trim() : "";
    if (inStock) {
        next.set("inStock", inStock);
    }

    const bf = filters.isFeatured;
    if (typeof bf === "boolean") {
        next.set("isFeatured", bf ? "true" : "false");
    } else if (bf === "true" || bf === "false") {
        next.set("isFeatured", bf);
    }

    const specObj = filters.spec;
    if (specObj && typeof specObj === "object") {
        for (const [key, value] of Object.entries(specObj as Record<string, string>)) {
            if (value != null && String(value) !== "") {
                next.append(`spec[${key}]`, String(value));
            }
        }
    }

    return next;
}

function normalizePathAndQueryForCompare(pathAndQuery: string): string {
    const u = new URL(pathAndQuery, "http://url.normalize");
    const entries = [...u.searchParams.entries()].sort(([aK, aV], [bK, bV]) => {
        const c = aK.localeCompare(bK);
        return c !== 0 ? c : aV.localeCompare(bV);
    });
    const sorted = new URLSearchParams(entries);
    const qs = sorted.toString();
    return `${u.pathname}${qs ? `?${qs}` : ""}`;
}

export function shopListingUrlsEquivalent(a: string, b: string): boolean {
    return normalizePathAndQueryForCompare(a) === normalizePathAndQueryForCompare(b);
}

/**
 * Serialized shop listing URL (pathname + query), preserving non-listing params (e.g. utm_*).
 * `currentHref` should be absolute (e.g. `window.location.href`).
 */
export function serializeShopListingUrl(filters: Record<string, unknown>, currentHref: string): string {
    const cur = new URL(currentHref);
    const cat =
        typeof filters.category === "string" && filters.category.trim()
            ? filters.category.trim().toLowerCase()
            : "";
    const pathname = cat ? `/shop/${encodeURIComponent(cat)}` : "/shop";

    const built = listingQueryStringFromFilters(filters);
    const merged = new URLSearchParams();
    for (const [k, v] of built.entries()) merged.append(k, v);
    for (const [k, v] of cur.searchParams.entries()) {
        if (isControlledShopQueryKey(k)) continue;
        merged.append(k, v);
    }

    const qs = merged.toString();
    return qs ? `${pathname}?${qs}` : pathname;
}
