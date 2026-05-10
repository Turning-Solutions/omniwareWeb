"use client";

import { Suspense } from "react";
import { ShopContent, ShopSkeleton } from "../ShopContent";
import type { UseProductsOptions } from "@/hooks/useProducts";

interface CategoryShopPageClientProps {
    normalizedSlug: string;
    initialFilters: Partial<UseProductsOptions>;
}

export default function CategoryShopPageClient({ normalizedSlug, initialFilters }: CategoryShopPageClientProps) {
    return (
        <div className="min-h-screen bg-[#121212] pb-16 pt-6 sm:pt-10">
            <div
                className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_85%_55%_at_50%_-25%,rgba(209,43,40,0.16),transparent_55%)]"
                aria-hidden
            />
            <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
                <Suspense fallback={<ShopSkeleton />}>
                    <ShopContent
                        basePath={`/shop/${normalizedSlug}`}
                        initialFilters={initialFilters}
                        heading="Shop"
                        subheading="Products in this category. Refine with filters on the left."
                    />
                </Suspense>
            </div>
        </div>
    );
}
