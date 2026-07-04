import "server-only";
import type { Request, Response } from "express";
import { ensureDb } from "@/server/src/config/db";
import { getProducts } from "@/server/src/controllers/productController";
import {
    buildProductsQueryString,
    type ProductsResponse,
    type UseProductsOptions,
} from "@/hooks/useProducts";

// Register populated models before the controller runs its lookups.
import "@/server/src/models/Brand";
import "@/server/src/models/Category";

/**
 * Runs the products list controller in-process (no HTTP loopback, no headers()).
 * SSR of shop/category/home listings must not depend on fetching our own
 * public URL — that self-fetch is slow and unreliable on serverless hosts and
 * previously caused shop pages to render without any product links.
 */
export async function fetchShopProductsDirect(options: UseProductsOptions): Promise<ProductsResponse> {
    await ensureDb();

    // Reuse the exact client query-string builder so the controller sees the
    // same flat query keys (including spec[Key]=value) as an HTTP request.
    const query: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(buildProductsQueryString(options))) {
        query[key] = value;
    }

    let statusCode = 200;
    let payload: unknown = null;

    const req = { query, headers: {}, params: {} } as unknown as Request;
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

    await getProducts(req, res);

    if (statusCode >= 400 || payload == null) {
        throw new Error(`getProducts direct call failed with status ${statusCode}`);
    }

    // Mongoose aggregates return ObjectId/Date instances; React Query dehydration
    // crosses the RSC boundary, which only accepts plain JSON values.
    return JSON.parse(JSON.stringify(payload)) as ProductsResponse;
}
