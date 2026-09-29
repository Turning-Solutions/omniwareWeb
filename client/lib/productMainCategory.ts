import type { Product } from "@/hooks/useProducts";
import type { CategoryTreeItem } from "@/hooks/useCategoryTree";

export type MainCategory = { id: string; name: string; slug?: string };

type CategoryRef = string | { _id?: unknown; name?: string; slug?: string; parentId?: unknown } | null | undefined;

function refId(ref: CategoryRef): string {
    if (!ref) return "";
    if (typeof ref === "string") return ref;
    return ref._id != null ? String(ref._id) : "";
}

/**
 * Category refs on a product. Detail responses populate `categoryIds`; list
 * responses keep raw ids in `categoryIds` and the full docs in `categories`.
 */
function getProductCategoryRefs(product: Product): CategoryRef[] {
    const extra = (product as unknown as { categories?: CategoryRef[] }).categories ?? [];
    return [...((product.categoryIds as CategoryRef[] | undefined) ?? []), ...extra];
}

/** Top-level ancestor of the product's categories — products are only comparable within one. */
export function resolveMainCategory(product: Product, tree: CategoryTreeItem[] | undefined): MainCategory | null {
    const refs = getProductCategoryRefs(product);
    const byId = new Map((tree ?? []).map((c) => [String(c._id), c]));

    for (const ref of refs) {
        let node = byId.get(refId(ref));
        const seen = new Set<string>();
        while (node?.parentId && byId.has(String(node.parentId)) && !seen.has(String(node._id))) {
            seen.add(String(node._id));
            node = byId.get(String(node.parentId));
        }
        if (node) return { id: String(node._id), name: node.name, slug: node.slug };
    }

    // Tree not loaded (or category missing from it) — fall back to the product's first category.
    const first = refs.find((ref) => refId(ref));
    if (!first) return null;
    return {
        id: refId(first),
        name: typeof first === "object" && first?.name ? first.name : "this category",
        slug: typeof first === "object" ? first?.slug : undefined,
    };
}
