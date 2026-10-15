import CategoryFeaturedSpecs from '../models/CategoryFeaturedSpecs';

/** Featured spec keys (the ones shown in the "Specifications" box) for a product's categories. */
export async function featuredSpecKeysForProduct(product: any): Promise<string[]> {
    const slugs: string[] = (product?.categoryIds ?? [])
        .map((c: any) => (c && typeof c === 'object' ? c.slug : undefined))
        .filter(Boolean);
    if (!slugs.length) return [];
    const configs = await CategoryFeaturedSpecs.find({ categoryKey: { $in: slugs } }).lean<{ featuredSpecKeys?: string[] }[]>();
    return [...new Set(configs.flatMap((c) => c.featuredSpecKeys ?? []))];
}
