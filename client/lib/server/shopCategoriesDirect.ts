import "server-only";
import type { Request, Response } from "express";
import { ensureDb } from "@/server/src/config/db";
import { getCategories } from "@/server/src/controllers/productController";

// Register populated models before the controller runs its lookups.
import "@/server/src/models/Brand";
import "@/server/src/models/Category";

/**
 * Runs the categories controller in-process, for the same reason the product
 * list and facets do (see `shopProductsDirect` / `shopFacetsDirect`): on
 * Vercel serverless, SSR fetching our own public URL adds a whole extra
 * function invocation + cold start to TTFB.
 */
export async function fetchShopCategoryTreeDirect(): Promise<unknown> {
    await ensureDb();

    let statusCode = 200;
    let payload: unknown = null;

    const req = { query: {}, headers: {}, params: {}, path: "/categories" } as unknown as Request;
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

    await getCategories(req, res);

    if (statusCode >= 400 || payload == null) {
        throw new Error(`getCategories direct call failed with status ${statusCode}`);
    }

    // Mongoose returns ObjectId/Date instances; dehydration across the RSC
    // boundary only accepts plain JSON values.
    return JSON.parse(JSON.stringify(payload));
}
