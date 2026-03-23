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
}) {
    const phone = normalizePhone(input.customPhone ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
    const productUrl =
        typeof window !== "undefined"
            ? `${window.location.origin}${input.productPath}`
            : input.productPath;

    const message = [
        "Hi Omniware,",
        `I would like more details about this product: ${input.productTitle}.`,
        `Product link: ${productUrl}`,
    ].join("\n");

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
