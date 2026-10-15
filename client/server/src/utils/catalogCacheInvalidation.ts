import type { Schema } from 'mongoose';
import { bumpCatalogVersion } from './cache';

/**
 * Mongoose plugin: any write to a catalog collection (products, categories,
 * brands, featured specs) bumps the cache version so every cached list, facet
 * and lookup response is invalidated at once. Hooks are awaited so the bump
 * lands before the admin request responds (serverless can freeze after).
 */
export function catalogCacheInvalidation(schema: Schema): void {
    const bump = async () => {
        await bumpCatalogVersion();
    };
    schema.post('save', bump);
    schema.post('insertMany', bump);
    for (const op of [
        'updateOne',
        'updateMany',
        'findOneAndUpdate',
        'findOneAndReplace',
        'findOneAndDelete',
        'deleteOne',
        'deleteMany',
        'replaceOne',
    ] as const) {
        schema.post(op, bump);
    }
}
