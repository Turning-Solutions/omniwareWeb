"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Product } from "@/hooks/useProducts";

export default function ProductCard({ product }: { product: Product }) {
    return (
        <div className="group relative bg-white/5 rounded-xl overflow-hidden hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10">
            <div className="aspect-square relative overflow-hidden bg-white/5">
                <img
                    src={product.images?.[0] || "/placeholder.svg"}
                    alt={product.title}
                    className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                />
                <button
                    className="absolute bottom-4 right-4 p-3 bg-primary text-black rounded-full shadow-lg opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:bg-white"
                    title="Add to Cart"
                >
                    <ShoppingCart className="h-5 w-5" />
                </button>
            </div>

            <div className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-gray-400 mb-1">
                            {typeof product.brand === 'object' && product.brand !== null
                                ? (product.brand as any).name
                                : product.brand}
                        </p>
                        <h3 className="font-medium text-white line-clamp-2 min-h-[3rem]">
                            <Link href={`/product/${product.slug || product._id}`}>
                                <span aria-hidden="true" className="absolute inset-0" />
                                {product.title}
                            </Link>
                        </h3>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <p className="text-lg font-bold text-white">
                        LKR {product.price.toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
}
