const DEFAULT_WHATSAPP_PHONE = "94740523439";

function normalizePhone(raw?: string): string {
    if (!raw) return DEFAULT_WHATSAPP_PHONE;
    const cleaned = raw.replace(/[^\d]/g, "");
    return cleaned || DEFAULT_WHATSAPP_PHONE;
}

export function buildProductWhatsAppUrl(input: {
    productTitle: string;
    productPath: string;
    customPhone?: string;
    /** General question vs. placing a pre-order */
    intent?: "inquiry" | "pre_order";
    /** Included in the pre-order message when `intent` is `pre_order` */
    quantity?: number;
}) {
    const phone = normalizePhone(input.customPhone ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
    const productUrl =
        typeof window !== "undefined"
            ? `${window.location.origin}${input.productPath}`
            : input.productPath;

    const intent = input.intent ?? "inquiry";
    const message =
        intent === "pre_order"
            ? [
                  "Hi Omniware,",
                  `I would like to pre-order this product: ${input.productTitle}.`,
                  `Quantity: ${input.quantity != null && input.quantity > 0 ? input.quantity : 1}`,
                  `Product link: ${productUrl}`,
              ].join("\n")
            : [
                  "Hi Omniware,",
                  `I would like more details about this product: ${input.productTitle}.`,
                  `Product link: ${productUrl}`,
              ].join("\n");

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/** Message for carts that contain pre-order lines (checkout disabled online). Lists every line in the cart. */
export function buildCartPreOrderWhatsAppUrl(input: {
    items: { title: string; qty: number; isPreOrder?: boolean }[];
    customPhone?: string;
}) {
    const phone = normalizePhone(input.customPhone ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
    const lines = [
        "Hi Omniware,",
        "My cart includes pre-order item(s), so I would like to complete my order via WhatsApp. Here is my full cart:",
        ...input.items.map((i) => {
            const tag = i.isPreOrder ? " (pre-order)" : "";
            return `• ${i.title} × ${i.qty}${tag}`;
        }),
        "Please advise on payment and fulfillment.",
    ];
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}
