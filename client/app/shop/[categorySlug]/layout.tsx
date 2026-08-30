import { notFound } from "next/navigation";
import { categoryExists } from "../categoryShopMetadata";

interface CategoryShopLayoutProps {
    children: React.ReactNode;
    params: Promise<{ categorySlug: string }>;
}

/**
 * Guards the dynamic (filtered) category route — the twin of
 * `shop-all/[categorySlug]/layout.tsx` for requests that carry filter params
 * and so skip the `proxy.ts` rewrite. Same reasoning: a nonexistent category
 * slug should 404, not render an empty "0 products" listing as a normal 200.
 */
export default async function CategoryShopLayout({ children, params }: CategoryShopLayoutProps) {
    const { categorySlug } = await params;
    if (!(await categoryExists(categorySlug))) notFound();
    return <>{children}</>;
}
