"use client";

import { useCart } from "@/context/CartContext";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle, CreditCard, Landmark, Store, Truck, CarTaxiFront } from "lucide-react";

const WEBX_IPG_CONVENIENCE_FEE_RATE = 0.035; // 3.50%

type PaymentMethod = "card_webx" | "bank_transfer";
type ShippingMethod = "store_pickup" | "courier" | "third_party";

function formatLkr(n: number) {
    return `LKR ${Math.round(n).toLocaleString()}`;
}

export default function CheckoutPage() {
    const { cartItems, clearCart } = useCart();
    const [success, setSuccess] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card_webx");
    const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("courier");

    const subtotal = useMemo(
        () => cartItems.reduce((acc, item) => acc + item.price * item.qty, 0),
        [cartItems]
    );

    const convenienceFee =
        paymentMethod === "card_webx" ? Math.round(subtotal * WEBX_IPG_CONVENIENCE_FEE_RATE * 100) / 100 : 0;

    const shippingLabel = useMemo(() => {
        switch (shippingMethod) {
            case "store_pickup":
                return "Store pickup";
            case "courier":
                return "Courier";
            case "third_party":
                return "Third-party (Uber / PickMe)";
            default:
                return "";
        }
    }, [shippingMethod]);

    /** Amount we add to the order total for shipping (business rules can replace later). */
    const shippingFee = shippingMethod === "store_pickup" ? 0 : 0;

    const grandTotal = subtotal + shippingFee + convenienceFee;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSuccess(true);
        clearCart();
    };

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <h1 className="text-3xl font-bold text-white mb-4">Order Placed Successfully!</h1>
                <p className="text-gray-400 mb-8 max-w-md">
                    Thank you for your purchase. We will contact you shortly
                    {paymentMethod === "bank_transfer" ? " with bank transfer instructions." : "."}
                </p>
                <Link href="/" className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90">
                    Back to Home
                </Link>
            </div>
        );
    }

    if (cartItems.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
                <h1 className="text-3xl font-bold text-white mb-4">Nothing to checkout</h1>
                <p className="text-gray-400 mb-8">Your cart is empty. Add items before checking out.</p>
                <Link href="/cart" className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90">
                    View cart
                </Link>
            </div>
        );
    }

    const addressRequired = shippingMethod === "courier" || shippingMethod === "third_party";

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 className="text-3xl font-bold text-white mb-8">Checkout</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                    <div className="glass p-8 rounded-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Shipping / delivery</h2>
                        <p className="text-sm text-gray-400 mb-4">How would you like to receive your order?</p>
                        <div className="space-y-3">
                            <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-black/20 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5">
                                <input
                                    type="radio"
                                    name="shipping"
                                    className="mt-1"
                                    checked={shippingMethod === "store_pickup"}
                                    onChange={() => setShippingMethod("store_pickup")}
                                />
                                <div className="flex gap-3 min-w-0">
                                    <Store className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-medium text-white block">Store pickup</span>
                                        <span className="text-sm text-gray-400">Collect from our location — no delivery charge.</span>
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-black/20 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5">
                                <input
                                    type="radio"
                                    name="shipping"
                                    className="mt-1"
                                    checked={shippingMethod === "courier"}
                                    onChange={() => setShippingMethod("courier")}
                                />
                                <div className="flex gap-3 min-w-0">
                                    <Truck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-medium text-white block">Courier</span>
                                        <span className="text-sm text-gray-400">We ship to your address via our courier partner.</span>
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-black/20 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5">
                                <input
                                    type="radio"
                                    name="shipping"
                                    className="mt-1"
                                    checked={shippingMethod === "third_party"}
                                    onChange={() => setShippingMethod("third_party")}
                                />
                                <div className="flex gap-3 min-w-0">
                                    <CarTaxiFront className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-medium text-white block">Third-party delivery (Uber / PickMe)</span>
                                        <span className="text-sm text-gray-400">
                                            You arrange pickup; use the address or notes below so we can hand off your order.
                                        </span>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="glass p-8 rounded-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Payment</h2>
                        <p className="text-sm text-gray-400 mb-4">Choose how you would like to pay.</p>
                        <div className="space-y-3">
                            <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-black/20 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5">
                                <input
                                    type="radio"
                                    name="payment"
                                    className="mt-1"
                                    checked={paymentMethod === "card_webx"}
                                    onChange={() => setPaymentMethod("card_webx")}
                                />
                                <div className="flex gap-3 min-w-0">
                                    <CreditCard className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-medium text-white block">Card — WEBX IPG</span>
                                        <span className="text-sm text-gray-400">
                                            Pay securely by card through our payment gateway. A product convenience fee of{" "}
                                            <span className="text-white/90 font-medium">3.50%</span> applies to the order subtotal.
                                        </span>
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-black/20 cursor-pointer hover:border-primary/40 has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5">
                                <input
                                    type="radio"
                                    name="payment"
                                    className="mt-1"
                                    checked={paymentMethod === "bank_transfer"}
                                    onChange={() => setPaymentMethod("bank_transfer")}
                                />
                                <div className="flex gap-3 min-w-0">
                                    <Landmark className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-medium text-white block">Bank transfer</span>
                                        <span className="text-sm text-gray-400">
                                            Pay by bank transfer. No card convenience fee. We will send account details and reference
                                            instructions after you place the order.
                                        </span>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="glass p-8 rounded-2xl">
                        <h2 className="text-xl font-bold text-white mb-6">Contact & details</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="First Name" required className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500" />
                                <input type="text" placeholder="Last Name" required className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500" />
                            </div>
                            <input
                                type="text"
                                placeholder={
                                    shippingMethod === "third_party"
                                        ? "Address or handover notes (required)"
                                        : "Address"
                                }
                                required={addressRequired}
                                className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500"
                            />
                            {!addressRequired && (
                                <p className="text-xs text-gray-500 -mt-2">Address optional for store pickup.</p>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="City" className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500" />
                                <input type="text" placeholder="Postal Code" className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500" />
                            </div>
                            <input type="tel" placeholder="Phone Number" required className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500" />

                            <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 mt-8">
                                Place order ({formatLkr(grandTotal)})
                            </button>
                        </form>
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-white mb-6">Order review</h2>
                    <div className="space-y-4">
                        {cartItems.map((item) => (
                            <div key={item._id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                                <span className="text-gray-300">
                                    {item.title} × {item.qty}
                                </span>
                                <span className="text-white font-medium">{formatLkr(item.price * item.qty)}</span>
                            </div>
                        ))}
                        <div className="border-t border-white/10 pt-4 space-y-3 text-sm">
                            <div className="flex justify-between text-gray-400">
                                <span>Subtotal</span>
                                <span className="text-white">{formatLkr(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-gray-400">
                                <span>Shipping ({shippingLabel})</span>
                                <span className="text-white">{shippingFee === 0 ? formatLkr(0) : formatLkr(shippingFee)}</span>
                            </div>
                            {shippingMethod === "courier" && (
                                <p className="text-xs text-gray-500">Courier charges may be adjusted when we confirm your order.</p>
                            )}
                            {paymentMethod === "card_webx" && (
                                <div className="flex justify-between text-gray-400">
                                    <span>Product convenience fee (WEBX IPG, 3.50%)</span>
                                    <span className="text-white">{formatLkr(convenienceFee)}</span>
                                </div>
                            )}
                            {paymentMethod === "bank_transfer" && (
                                <p className="text-xs text-gray-500">No card convenience fee on bank transfer.</p>
                            )}
                            <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                                <span className="text-lg font-bold text-white">Total</span>
                                <span className="text-lg font-bold text-primary">{formatLkr(grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
