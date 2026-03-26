type OrderWhatsappPayload = {
    customerName: string;
    customerPhone?: string;
    orderId: string;
    status: string;
};

const STATUS_LABELS: Record<string, string> = {
    waiting_confirmation: 'Waiting for confirmation',
    confirmed: 'Confirmed',
    rejected: 'Rejected',
    preparing: 'Preparing',
    ready_for_pickup: 'Ready for pickup',
    out_for_delivery: 'Out for delivery',
    delivered: 'Delivered',
    pending: 'Pending',
    paid: 'Paid',
    shipped: 'Shipped',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
};

function statusLabel(status: string): string {
    return STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

function shortOrderRef(orderId: string): string {
    return orderId.slice(-8).toUpperCase();
}

function normalizePhoneToE164(raw?: string): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const keepPlusDigits = trimmed.replace(/[^\d+]/g, '');

    if (keepPlusDigits.startsWith('+')) {
        const normalized = `+${keepPlusDigits.slice(1).replace(/\D/g, '')}`;
        return normalized.length >= 8 ? normalized : null;
    }

    const digits = keepPlusDigits.replace(/\D/g, '');
    if (!digits) return null;

    // Sri Lanka local format: 07XXXXXXXX -> +947XXXXXXXX
    if (digits.startsWith('0') && digits.length >= 10) {
        return `+94${digits.slice(1)}`;
    }
    // Sri Lanka format without trunk prefix: 7XXXXXXXX -> +947XXXXXXXX
    if (digits.length === 9 && digits.startsWith('7')) {
        return `+94${digits}`;
    }

    // Fallback: assume international number without leading +
    return `+${digits}`;
}

function whatsappEnabled(): boolean {
    return process.env.WHATSAPP_ENABLED === 'true';
}

function getWhatsappConfig() {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    if (!phoneNumberId || !accessToken) return null;
    return { phoneNumberId, accessToken };
}

async function sendTemplateMessage(
    to: string,
    templateName: string,
    bodyValues: string[]
): Promise<void> {
    const cfg = getWhatsappConfig();
    if (!cfg) return;

    const endpoint = `https://graph.facebook.com/v22.0/${cfg.phoneNumberId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: 'en' },
            components: [
                {
                    type: 'body',
                    parameters: bodyValues.map((text) => ({
                        type: 'text',
                        text,
                    })),
                },
            ],
        },
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${cfg.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`WhatsApp API error (${response.status}): ${text}`);
    }
}

export async function sendOrderPlacedWhatsApp(payload: OrderWhatsappPayload): Promise<void> {
    if (!whatsappEnabled()) return;
    const template = process.env.WHATSAPP_TEMPLATE_ORDER_PLACED?.trim();
    if (!template) return;

    const to = normalizePhoneToE164(payload.customerPhone);
    if (!to) return;

    try {
        await sendTemplateMessage(to, template, [
            payload.customerName || 'Customer',
            shortOrderRef(payload.orderId),
            statusLabel(payload.status),
        ]);
    } catch (err) {
        console.error('[whatsapp] sendOrderPlacedWhatsApp failed:', err);
    }
}

export async function sendOrderStatusUpdatedWhatsApp(payload: OrderWhatsappPayload): Promise<void> {
    if (!whatsappEnabled()) return;
    const template = process.env.WHATSAPP_TEMPLATE_ORDER_STATUS?.trim();
    if (!template) return;

    const to = normalizePhoneToE164(payload.customerPhone);
    if (!to) return;

    try {
        await sendTemplateMessage(to, template, [
            payload.customerName || 'Customer',
            shortOrderRef(payload.orderId),
            statusLabel(payload.status),
        ]);
    } catch (err) {
        console.error('[whatsapp] sendOrderStatusUpdatedWhatsApp failed:', err);
    }
}
