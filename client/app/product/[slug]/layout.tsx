import { notFound, permanentRedirect } from "next/navigation";
import { fetchProductBySlugDirect } from "@/lib/server/homeData";

interface ProductLayoutProps {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}

/**
 * `loading.tsx` in this segment wraps `page.tsx` in a Suspense boundary, which
 * means Next.js starts streaming a 200 response before the page's own async
 * notFound()/permanentRedirect() calls resolve — the status can never change
 * after that point, so missing products were silently served as 200 "soft
 * 404s" (confirmed in production; a major cause of poor product-page
 * indexing). This layout renders outside that boundary, so the check below
 * resolves — and can still set a real 404/308 status — before any bytes ship.
 */
export default async function ProductLayout({ children, params }: ProductLayoutProps) {
    const { slug } = await params;
    const product = await fetchProductBySlugDirect(slug);

    if (!product) notFound();
    if (product.slug && slug !== product.slug) {
        permanentRedirect(`/product/${encodeURIComponent(product.slug)}`);
    }

    return <>{children}</>;
}
