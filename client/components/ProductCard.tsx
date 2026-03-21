"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Product } from "@/hooks/useProducts";

export default function ProductCard({ product }: { product: Product }) {
    return (
        <div className="group relative overflow-hidden rounded-2xl border border-[#5E5E5E]/30 bg-[#1a1a1a]/90 transition-colors hover:border-[#D12B28]/40 hover:bg-[#242424]/90">
            <div className="aspect-square relative overflow-hidden bg-[#121212]/80">
                <img
                    src={product.images?.[0] || "/placeholder.svg"}
                    alt={product.title}
                    className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                />
                <button
                    className="absolute bottom-4 right-4 p-3 rounded-full bg-[#D12B28] text-[#F1F1F1] shadow-lg shadow-[#D12B28]/25 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 translate-y-4 hover:bg-[#E53A36]"
                    title="Add to Cart"
                >
                    <ShoppingCart className="h-5 w-5" />
                </button>
            </div>

            <div className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-[#8E8E8E] mb-1">
                            {typeof product.brand === 'object' && product.brand !== null
                                ? (product.brand as any).name
                                : product.brand}
                        </p>
                        <h3 className="font-medium text-[#F1F1F1] line-clamp-2 min-h-[3rem]">
                            <Link href={`/product/${product.slug || product._id}`}>
                                <span aria-hidden="true" className="absolute inset-0" />
                                {product.title}
                            </Link>
                        </h3>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <p className="text-lg font-bold text-[#F1F1F1]">
                        LKR {product.price.toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
}
