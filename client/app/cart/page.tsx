"use client";

import { useCart } from "@/context/CartContext";
import Link from "next/link";
import Image from "next/image";
import { Trash2, ArrowRight } from "lucide-react";

export default function CartPage() {
    const { cartItems, removeFromCart } = useCart();

    const total = cartItems.reduce((acc, item) => acc + item.price * item.qty, 0);

    if (cartItems.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
                <h1 className="text-3xl font-bold text-white mb-4">Your Cart is Empty</h1>
                <p className="text-gray-400 mb-8">Looks like you haven&apos;t added any components yet.</p>
                <Link href="/shop" className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90">
                    Go Shopping
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 className="text-3xl font-bold text-white mb-8">Shopping Cart</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    {cartItems.map((item) => (
                        <div key={item._id} className="glass p-4 rounded-xl flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="h-20 w-20 bg-white/5 rounded-lg overflow-hidden flex items-center justify-center relative">
                                    {item.image ? (
                                        <Image
                                            src={item.image}
                                            alt={item.title}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <span className="text-xs text-gray-500">No Img</span>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{item.title}</h3>
                                    <p className="text-sm text-gray-400">LKR {item.price.toLocaleString()} x {item.qty}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => removeFromCart(item._id)}
                                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="lg:col-span-1">
                    <div className="glass p-6 rounded-xl space-y-4 sticky top-24">
                        <h3 className="text-xl font-bold text-white">Order Summary</h3>
                        <div className="flex justify-between text-gray-400">
                            <span>Subtotal</span>
                            <span>LKR {total.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                            <span>Shipping</span>
                            <span>Calculated at checkout</span>
                        </div>
                        <div className="border-t border-white/10 pt-4 flex justify-between text-white font-bold text-lg">
                            <span>Total</span>
                            <span>LKR {total.toLocaleString()}</span>
                        </div>
                        <Link
                            href="/checkout"
                            className="w-full bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 mt-4"
                        >
                            Proceed to Checkout <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
