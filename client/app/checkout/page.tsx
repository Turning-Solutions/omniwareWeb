"use client";

import { useCart } from "@/context/CartContext";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function CheckoutPage() {
    const { cartItems, clearCart } = useCart();
    const [success, setSuccess] = useState(false);

    const total = cartItems.reduce((acc, item) => acc + item.price * item.qty, 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In real app, send to backend
        setSuccess(true);
        clearCart();
    };

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <h1 className="text-3xl font-bold text-white mb-4">Order Placed Successfully!</h1>
                <p className="text-gray-400 mb-8">Thank you for your purchase. We will contact you shortly.</p>
                <Link href="/" className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90">
                    Back to Home
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 className="text-3xl font-bold text-white mb-8">Checkout</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="glass p-8 rounded-2xl">
                    <h2 className="text-xl font-bold text-white mb-6">Shipping Information</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="First Name" required className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full" />
                            <input type="text" placeholder="Last Name" required className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full" />
                        </div>
                        <input type="text" placeholder="Address" required className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full" />
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="City" required className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full" />
                            <input type="text" placeholder="Postal Code" required className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full" />
                        </div>
                        <input type="tel" placeholder="Phone Number" required className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full" />

                        <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 mt-8">
                            Place Order (LKR {total.toLocaleString()})
                        </button>
                    </form>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-white mb-6">Order Review</h2>
                    <div className="space-y-4">
                        {cartItems.map(item => (
                            <div key={item._id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                                <span className="text-gray-300">{item.title} x {item.qty}</span>
                                <span className="text-white font-medium">LKR {(item.price * item.qty).toLocaleString()}</span>
                            </div>
                        ))}
                        <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                            <span className="text-lg font-bold text-white">Total</span>
                            <span className="text-lg font-bold text-primary">LKR {total.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
