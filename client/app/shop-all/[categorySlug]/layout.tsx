import { notFound } from "next/navigation";
import { categoryExists } from "@/app/shop/categoryShopMetadata";

interface CategoryShopAllLayoutProps {
    children: React.ReactNode;
    params: Promise<{ categorySlug: string }>;
}

/**
 * Guards the prerendered category landing — what `/shop/{slug}` actually
 * serves for unfiltered requests (see `proxy.ts`). Without this, any made-up
 * slug rendered as a normal 200 "0 products" page, indistinguishable from a
 * real empty category. Checking here, in a layout rather than the page,
 * keeps it safe even if a `loading.tsx` is ever added to this segment (see
 * the equivalent product-page fix for why that ordering matters).
 */
export default async function CategoryShopAllLayout({ children, params }: CategoryShopAllLayoutProps) {
    const { categorySlug } = await params;
    if (!(await categoryExists(categorySlug))) notFound();
    return <>{children}</>;
}
