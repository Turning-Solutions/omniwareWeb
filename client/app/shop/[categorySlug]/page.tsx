"use client";

import { Suspense, use } from "react";
import { ShopContent } from "../page";

interface CategoryShopPageProps {
    params: Promise<{
        categorySlug: string;
    }>;
}

export default function CategoryShopPage({ params }: CategoryShopPageProps) {
    const { categorySlug } = use(params);

    return (
        <div className="min-h-screen bg-base pt-20 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Suspense fallback={<div className="text-main text-center pt-20">Loading Category...</div>}>
                    <ShopContent
                        basePath={`/shop/${categorySlug}`}
                        initialFilters={{ category: categorySlug }}
                    />
                </Suspense>
            </div>
        </div>
    );
}

