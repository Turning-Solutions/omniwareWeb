"use client";

import { useCart } from "@/context/CartContext";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle, CreditCard, Landmark, Store, Truck, CarTaxiFront } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

const WEBX_IPG_CONVENIENCE_FEE_RATE = 0.035; // 3.50%

type PaymentMethod = "card_webx" | "bank_transfer";
type ShippingMethod = "store_pickup" | "courier" | "third_party";
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

const BANK_TRANSFER_DETAILS = {
    accountNo: "8009591390",
    accountName: "N W D C SANDAMAL",
    bankBranch: "Commercial Bank Attidiya",
};

function formatLkr(n: number) {
    return `LKR ${Math.round(n).toLocaleString()}`;
}

export default function CheckoutPage() {
    const { cartItems, clearCart } = useCart();
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptUrl, setReceiptUrl] = useState("");
    const [receiptMeta, setReceiptMeta] = useState<{
        publicId: string;
        resourceType: "image" | "raw";
        bytes: number;
        format: string;
    } | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card_webx");
    const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("courier");
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        postalCode: "",
        country: "Sri Lanka",
    });

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

            if (!fullName || !formData.email.trim()) {
                toast.error("Name and email are required.");
                return;
            }

            const shippingAddress =
                shippingMethod === "store_pickup"
                    ? {
                        address: "Store pickup",
                        city: "N/A",
                        postalCode: "N/A",
                        country: formData.country.trim() || "Sri Lanka",
                    }
                    : {
                        address: formData.address.trim(),
                        city: formData.city.trim(),
                        postalCode: formData.postalCode.trim(),
                        country: formData.country.trim() || "Sri Lanka",
                    };

            if (
                shippingMethod !== "store_pickup" &&
                (!shippingAddress.address || !shippingAddress.city || !shippingAddress.postalCode)
            ) {
                toast.error("Please complete delivery address details.");
                return;
            }

            let finalReceiptUrl = receiptUrl;
            let uploadedReceiptMeta:
                | { publicId: string; resourceType: "image" | "raw"; bytes: number; format: string }
                | null = receiptMeta;
            if (paymentMethod === "bank_transfer") {
                if (!receiptFile && !finalReceiptUrl) {
                    toast.error("Please upload your bank transfer receipt.");
                    return;
                }

                if (!finalReceiptUrl && receiptFile) {
                    if (receiptFile.size > MAX_RECEIPT_BYTES) {
                        toast.error("Receipt must be 10MB or smaller.");
                        return;
                    }
                    const isPdf = receiptFile.type === "application/pdf";
                    const isImage = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(receiptFile.type);
                    if (!isPdf && !isImage) {
                        toast.error("Only PDF or image files are allowed.");
                        return;
                    }

                    setUploadingReceipt(true);
                    const signRes = await api.post("/orders/receipt-upload-signature", {
                        fileType: receiptFile.type,
                    });
                    const signData = signRes.data as {
                        apiKey: string;
                        timestamp: number;
                        signature: string;
                        folder: string;
                        publicId: string;
                        resourceType: "image" | "raw";
                        uploadUrl: string;
                    };

                    const form = new FormData();
                    form.append("file", receiptFile);
                    form.append("api_key", signData.apiKey);
                    form.append("timestamp", String(signData.timestamp));
                    form.append("signature", signData.signature);
                    form.append("folder", signData.folder);
                    form.append("public_id", signData.publicId);

                    const cloudRes = await fetch(signData.uploadUrl, {
                        method: "POST",
                        body: form,
                    });
                    if (!cloudRes.ok) {
                        toast.error("Receipt upload failed. Please try again.");
                        return;
                    }
                    const cloudData = (await cloudRes.json()) as {
                        secure_url?: string;
                        public_id?: string;
                        resource_type?: "image" | "raw";
                        bytes?: number;
                        format?: string;
                    };
                    finalReceiptUrl = cloudData.secure_url || "";
                    if (!finalReceiptUrl) {
                        toast.error("Receipt upload failed. Please try again.");
                        return;
                    }
                    uploadedReceiptMeta = {
                        publicId: cloudData.public_id || signData.publicId,
                        resourceType: cloudData.resource_type || signData.resourceType,
                        bytes: Number(cloudData.bytes || 0),
                        format: String(cloudData.format || ""),
                    };
                    setReceiptUrl(finalReceiptUrl);
                    setReceiptMeta(uploadedReceiptMeta);
                }
            }

            await api.post("/orders", {
                customer: {
                    name: fullName,
                    email: formData.email.trim(),
                    phone: formData.phone.trim(),
                },
                orderItems: cartItems.map((item) => ({
                    name: item.title,
                    qty: item.qty,
                    image: item.image || "/placeholder-product.png",
                    price: item.price,
                    product: item._id,
                })),
                shippingAddress,
                paymentMethod,
                itemsPrice: subtotal,
                taxPrice: 0,
                shippingPrice: shippingFee,
                totalPrice: grandTotal,
                ...(paymentMethod === "bank_transfer"
                    ? {
                        bankTransferReceipt: {
                            url: finalReceiptUrl,
                            publicId: uploadedReceiptMeta?.publicId,
                            resourceType: uploadedReceiptMeta?.resourceType,
                            bytes: uploadedReceiptMeta?.bytes,
                            format: uploadedReceiptMeta?.format,
                        },
                    }
                    : {}),
            });

            setSuccess(true);
            clearCart();
            toast.success("Order placed. Check your email for confirmation.");
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Failed to place order.";
            toast.error(message);
        } finally {
            setUploadingReceipt(false);
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <h1 className="text-3xl font-bold text-white mb-4">Order Placed Successfully!</h1>
                <p className="text-gray-400 mb-8 max-w-md">
                    Thank you for your purchase. Please check your email for the order confirmation from sales@omniware.lk. We will contact you shortly
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
                                            You arrange pickup, and the customer pays the courier amount (Uber / PickMe fee).
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
                        {paymentMethod === "bank_transfer" && (
                            <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-4 space-y-3">
                                <p className="text-sm text-white/90">
                                    Please transfer the amount to the following bank account and upload your receipt before placing the order.
                                </p>
                                <div className="text-sm space-y-1">
                                    <p className="text-gray-300"><span className="text-white font-medium">Account No:</span> {BANK_TRANSFER_DETAILS.accountNo}</p>
                                    <p className="text-gray-300"><span className="text-white font-medium">Account Name:</span> {BANK_TRANSFER_DETAILS.accountName}</p>
                                    <p className="text-gray-300"><span className="text-white font-medium">Bank / Branch:</span> {BANK_TRANSFER_DETAILS.bankBranch}</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm text-white font-medium">Upload transfer receipt</label>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf,application/pdf"
                                        required={paymentMethod === "bank_transfer"}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0] || null;
                                            setReceiptFile(file);
                                            setReceiptUrl("");
                                            setReceiptMeta(null);
                                        }}
                                        className="block w-full text-sm text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white hover:file:bg-primary/90"
                                    />
                                    {receiptFile && <p className="text-xs text-gray-400">Selected: {receiptFile.name}</p>}
                                    <p className="text-xs text-gray-500">Accepted file types: PDF or image.</p>
                                    {receiptUrl && <p className="text-xs text-green-400">Receipt uploaded and attached.</p>}
                                    {uploadingReceipt && <p className="text-xs text-gray-400">Uploading receipt...</p>}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="glass p-8 rounded-2xl">
                        <h2 className="text-xl font-bold text-white mb-6">Contact & details</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    placeholder="First Name"
                                    required
                                    value={formData.firstName}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                                    className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Last Name"
                                    required
                                    value={formData.lastName}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                                    className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500"
                                />
                            </div>
                            <input
                                type="email"
                                placeholder="Email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500"
                            />
                            <input
                                type="text"
                                placeholder={
                                    shippingMethod === "third_party"
                                        ? "Address or handover notes (required)"
                                        : "Address"
                                }
                                required={addressRequired}
                                value={formData.address}
                                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                                className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500"
                            />
                            {!addressRequired && (
                                <p className="text-xs text-gray-500 -mt-2">Address optional for store pickup.</p>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    placeholder="City"
                                    required={addressRequired}
                                    value={formData.city}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                                    className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Postal Code"
                                    required={addressRequired}
                                    value={formData.postalCode}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
                                    className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500"
                                />
                            </div>
                            <input
                                type="text"
                                placeholder="Country"
                                required
                                value={formData.country}
                                onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                                className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500"
                            />
                            <input
                                type="tel"
                                placeholder="Phone Number"
                                required
                                value={formData.phone}
                                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                                className="bg-black/20 border border-white/10 rounded-lg p-3 text-white w-full placeholder:text-gray-500"
                            />

                            <button
                                type="submit"
                                disabled={submitting || uploadingReceipt}
                                className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 mt-8 disabled:opacity-70"
                            >
                                {submitting || uploadingReceipt ? "Placing Order..." : `Place order (${formatLkr(grandTotal)})`}
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
