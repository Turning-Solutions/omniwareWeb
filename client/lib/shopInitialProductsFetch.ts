import { headers } from "next/headers";
import { QueryClient } from "@tanstack/react-query";
import {
    buildProductsQueryString,
    getProductFacetsQueryOptions,
    getProductsQueryOptions,
    normalizeCategoryForApi,
    type Facets,
    type ProductsResponse,
    type UseProductsOptions,
} from "@/hooks/useProducts";
import { SHOP_PRODUCTS_PER_PAGE } from "@/lib/shopConstants";

const PRODUCTS_REVALIDATE_SECONDS = 60;

export async function resolveServerApiBaseUrl(): Promise<string> {
    const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
    if (raw && /^https?:\/\//i.test(raw)) {
        return raw.replace(/\/+$/, "");
    }
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    if (host) {
        return `${proto}://${host}`.replace(/\/+$/, "");
    }
    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel) {
        return (vercel.startsWith("http") ? vercel : `https://${vercel}`).replace(/\/+$/, "");
    }
    const port = process.env.PORT ?? "3000";
    return `http://127.0.0.1:${port}`;
}

export async function fetchShopProductsJson(options: UseProductsOptions): Promise<ProductsResponse> {
    const base = await resolveServerApiBaseUrl();
    const query = buildProductsQueryString(options);
    const url = `${base}/api/v1/products?${query}`;
    const res = await fetch(url, {
        next: { revalidate: PRODUCTS_REVALIDATE_SECONDS },
        headers: { Accept: "application/json" },
    });
    if (!res.ok) {
        throw new Error(`GET products failed: ${res.status}`);
    }
    return res.json() as Promise<ProductsResponse>;
}

export function readProductsTotal(
    data: ProductsResponse & { pagination?: { total?: number } }
): number {
    if (typeof data.total === "number") return data.total;
    return data.pagination?.total ?? 0;
}

export async function fetchShopSearchResultTotal(options: UseProductsOptions): Promise<number> {
    const data = await fetchShopProductsJson({
        ...options,
        limit: 1,
        page: 1,
        includeFacets: false,
    });
    return readProductsTotal(data);
}

export async function prefetchShopProductsList(queryClient: QueryClient, options: UseProductsOptions) {
    await queryClient.prefetchQuery({
        ...getProductsQueryOptions(options),
        queryFn: () => fetchShopProductsJson(options),
        staleTime: 2 * 60 * 1000,
    });
}

export async function fetchShopFacetsJson(options: UseProductsOptions): Promise<{ facets: Facets }> {
    const base = await resolveServerApiBaseUrl();
    const params = new URLSearchParams();
    if (options.search) params.append("search", options.search);
    const subcategoryParts = options.subcategories
        ? String(options.subcategories)
              .split(",")
              .map((s) => normalizeCategoryForApi(s))
              .filter(Boolean)
        : [];
    const categoryParts: string[] =
        subcategoryParts.length > 0
            ? subcategoryParts
            : options.category
              ? [normalizeCategoryForApi(String(options.category))]
              : [];
    if (categoryParts.length > 0) {
        const unique = Array.from(new Set(categoryParts));
        params.append("category", unique.join(","));
    }
    if (options.brand) params.append("brand", options.brand);
    if (options.minPrice != null) params.append("minPrice", String(options.minPrice));
    if (options.maxPrice != null) params.append("maxPrice", String(options.maxPrice));
    if (options.availability) params.append("availability", options.availability);
    if (options.inStock) params.append("inStock", options.inStock);
    if (options.isFeatured != null) params.append("isFeatured", String(options.isFeatured));
    if (options.facetMode === "lite") params.append("mode", "lite");
    if (options.spec && typeof options.spec === "object") {
        for (const [key, value] of Object.entries(options.spec)) {
            if (value != null && value !== "") params.append(`spec[${key}]`, value);
        }
    }
    const query = params.toString();
    const url = `${base}/api/v1/products/facets${query ? `?${query}` : ""}`;
    const res = await fetch(url, {
        next: { revalidate: PRODUCTS_REVALIDATE_SECONDS },
        headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`GET facets failed: ${res.status}`);
    return (await res.json()) as { facets: Facets };
}

export async function prefetchShopFacets(queryClient: QueryClient, options: UseProductsOptions) {
    await queryClient.prefetchQuery({
        ...getProductFacetsQueryOptions(options),
        queryFn: () => fetchShopFacetsJson(options),
        staleTime: 2 * 60 * 1000,
    });
}

/** Options object must match `useProducts({ ...filters, limit, includeFacets })` for the default shop list. */
export function shopProductsListQueryOptionsForHydration(params: Partial<UseProductsOptions> = {}): UseProductsOptions {
    const page = params.page !== undefined && params.page >= 1 ? Math.floor(params.page) : 1;
    const o: UseProductsOptions = {
        search: typeof params.search === "string" ? params.search : "",
        sort: params.sort && String(params.sort).trim() ? String(params.sort).trim() : "newest",
        page,
        limit: SHOP_PRODUCTS_PER_PAGE,
        includeFacets: false,
    };
    if (params.category) {
        o.category = params.category;
    }
    if (params.subcategories?.trim()) {
        o.subcategories = params.subcategories.trim();
    }
    if (params.brand) {
        o.brand = params.brand;
    }
    if (params.minPrice != null && !Number.isNaN(Number(params.minPrice))) {
        o.minPrice = Number(params.minPrice);
    }
    if (params.maxPrice != null && !Number.isNaN(Number(params.maxPrice))) {
        o.maxPrice = Number(params.maxPrice);
    }
    if (params.availability) {
        o.availability = params.availability;
    }
    if (params.inStock) {
        o.inStock = params.inStock;
    }
    if (params.isFeatured != null) {
        o.isFeatured = params.isFeatured;
    }
    if (params.spec && typeof params.spec === "object") {
        o.spec = params.spec;
    }
    return o;
}
