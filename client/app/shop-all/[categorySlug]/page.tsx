import type { Metadata } from "next";
import CategoryShopLanding from "@/app/shop/CategoryShopLanding";
import {
    activeCategorySlugParams,
    buildCategoryShopMetadata,
    normalizeCategorySlug,
} from "@/app/shop/categoryShopMetadata";
import { parseShopFiltersFromRouter } from "@/lib/shopUrlFilters";

/**
 * Prerendered category listing — the internal rewrite target for
 * `/shop/{slug}` when the request carries no filter params (see `proxy.ts`).
 *
 * Deliberately touches no request-time API (no `searchParams`), which is what
 * lets it prerender and be served from the edge. The dynamic `/shop/[categorySlug]`
 * handles every filtered URL. Metadata is the genuine `/shop/{slug}` metadata,
 * canonical included, because this HTML is what gets served at `/shop/{slug}`.
 */
export const revalidate = 60;

interface CategoryLandingProps {
    params: Promise<{ categorySlug: string }>;
}

export async function generateMetadata({ params }: CategoryLandingProps): Promise<Metadata> {
    const { categorySlug } = await params;
    return buildCategoryShopMetadata(categorySlug);
}

export async function generateStaticParams() {
    return activeCategorySlugParams();
}

export default async function CategoryShopAllPage({ params }: CategoryLandingProps) {
    const { categorySlug } = await params;
    const normalizedSlug = normalizeCategorySlug(categorySlug);
    const filters = parseShopFiltersFromRouter(`/shop/${encodeURIComponent(normalizedSlug)}`, {});

    return <CategoryShopLanding normalizedSlug={normalizedSlug} filters={filters} />;
}
