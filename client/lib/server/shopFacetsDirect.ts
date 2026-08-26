import "server-only";
import type { Request, Response } from "express";
import { ensureDb } from "@/server/src/config/db";
import { getProductFacets } from "@/server/src/controllers/productController";
import { buildProductFacetsQueryString, type UseProductsOptions } from "@/hooks/useProducts";

// Register populated models before the controller runs its lookups.
import "@/server/src/models/Brand";
import "@/server/src/models/Category";

/**
 * Runs the facets controller in-process, for the same reason the product list
 * does (see `shopProductsDirect`): on Vercel serverless, SSR fetching our own
 * public URL adds a whole extra function invocation + cold start to TTFB.
 */
export async function fetchShopFacetsDirect(options: UseProductsOptions): Promise<unknown> {
    await ensureDb();

    const query: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(buildProductFacetsQueryString(options))) {
        query[key] = value;
    }

    let statusCode = 200;
    let payload: unknown = null;

    // `path` is read by the controller's cache gating (it skips /admin requests).
    const req = { query, headers: {}, params: {}, path: "/facets" } as unknown as Request;
    const res = {
        set() {
            return this;
        },
        status(code: number) {
            statusCode = code;
            return this;
        },
        json(body: unknown) {
            payload = body;
            return this;
        },
    } as unknown as Response;

    await getProductFacets(req, res);

    if (statusCode >= 400 || payload == null) {
        throw new Error(`getProductFacets direct call failed with status ${statusCode}`);
    }

    // Mongoose returns ObjectId/Date instances; dehydration across the RSC
    // boundary only accepts plain JSON values.
    return JSON.parse(JSON.stringify(payload));
}
