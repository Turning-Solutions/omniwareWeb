import nodemailer from 'nodemailer';
import { Resend } from 'resend';

/**
 * Contact form — pick ONE setup:
 *
 * **Easiest — Resend (HTTPS API, one key)**
 *   RESEND_API_KEY=re_...
 *   CONTACT_MAIL_TO=you@domain.com        (inbox)
 *   MAIL_FROM optional — omit or use Omniware <onboarding@resend.dev> for quick tests.
 *   Do NOT use @gmail.com / @yahoo.com etc. as MAIL_FROM; Resend cannot send “from” those domains.
 *   Production: verify omniware.lk (or your domain) in Resend → MAIL_FROM=Omniware <hello@omniware.lk>
 *
 * **Classic SMTP (Gmail, cPanel, SendGrid SMTP, etc.)**
 *   SMTP_HOST, SMTP_USER, SMTP_PASS
 *   Optional: SMTP_PORT (587), SMTP_SECURE=true for 465
 *   Optional: CONTACT_MAIL_TO, MAIL_FROM
 */
export function isMailConfigured(): boolean {
    if (process.env.RESEND_API_KEY?.trim()) return true;
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Default verified sender for Resend. */
const RESEND_DEFAULT_FROM = 'Omniware <support@omniware.lk>';

const RESEND_BLOCKED_FROM_DOMAINS = new Set([
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'yahoo.co.uk',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'icloud.com',
    'me.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
]);

function parseFromEmail(fromHeader: string): string | null {
    const trimmed = fromHeader.trim();
    const angle = trimmed.match(/<([^>]+)>/);
    const addr = (angle ? angle[1] : trimmed).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return null;
    return addr.toLowerCase();
}

/** Use a verified From address; never a random @gmail.com etc. */
function resolveResendFromHeader(): string {
    const raw = process.env.MAIL_FROM?.trim();
    if (!raw) return RESEND_DEFAULT_FROM;

    const email = parseFromEmail(raw);
    if (!email) return raw;

    const domain = email.split('@')[1] ?? '';
    if (RESEND_BLOCKED_FROM_DOMAINS.has(domain)) {
        console.warn(
            `[mail] MAIL_FROM (${email}) cannot be used with Resend without verifying that domain. ` +
                `Using ${RESEND_DEFAULT_FROM} for the From header. Replies still use the visitor's address (Reply-To). ` +
                `For production, verify your domain at https://resend.com/domains and set MAIL_FROM to an address on that domain.`
        );
        return RESEND_DEFAULT_FROM;
    }

    return raw;
}

function buildPlainBody(opts: { name: string; email: string; subject: string; message: string }): string {
    return [
        `Name: ${opts.name}`,
        `Reply-To: ${opts.email}`,
        '',
        `Subject: ${opts.subject}`,
        '',
        opts.message,
    ].join('\n');
}

type MailMessage = {
    to: string[];
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    from?: string;
};

function getSalesFromHeader(): string {
    return process.env.ORDER_MAIL_FROM?.trim() || 'Omniware Sales <sales@omniware.lk>';
}

async function sendViaResend(opts: {
    name: string;
    email: string;
    subject: string;
    message: string;
}): Promise<void> {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
        throw new Error('RESEND_API_KEY is not set.');
    }

    const resend = new Resend(key);
    const to = process.env.CONTACT_MAIL_TO || 'support@omniware.lk';
    const from = resolveResendFromHeader();

    const { error } = await resend.emails.send({
        from,
        to: [to],
        replyTo: opts.email,
        subject: `[Website contact] ${opts.subject}`,
        text: buildPlainBody(opts),
    });

    if (error) {
        const hint =
            /not verified|verify your domain/i.test(error.message)
                ? ' Add and verify your domain at https://resend.com/domains, then set MAIL_FROM to an address on that domain (or remove MAIL_FROM to use Resend test sending).'
                : '';
        throw new Error((error.message || 'Resend rejected the email.') + hint);
    }
}

async function sendViaSmtp(opts: {
    name: string;
    email: string;
    subject: string;
    message: string;
}): Promise<void> {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
        throw new Error(
            'SMTP is not fully configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS (or use RESEND_API_KEY instead).'
        );
    }

    const port = Number(process.env.SMTP_PORT || '587');
    const secure =
        process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1' || port === 465;

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
    });

    const to = process.env.CONTACT_MAIL_TO || 'support@omniware.lk';
    const from = process.env.MAIL_FROM?.trim() || `"Omniware" <${user}>`;
    const text = buildPlainBody(opts);

    await transporter.sendMail({
        from,
        to,
        replyTo: opts.email,
        subject: `[Website contact] ${opts.subject}`,
        text,
    });
}

async function sendMessageViaResend(message: MailMessage): Promise<void> {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
        throw new Error('RESEND_API_KEY is not set.');
    }

    const resend = new Resend(key);
    const from = message.from || resolveResendFromHeader();

    const { error } = await resend.emails.send({
        from,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
    });

    if (error) {
        throw new Error(error.message || 'Resend rejected the email.');
    }
}

async function sendMessageViaSmtp(message: MailMessage): Promise<void> {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
        throw new Error(
            'SMTP is not fully configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS (or use RESEND_API_KEY instead).'
        );
    }

    const port = Number(process.env.SMTP_PORT || '587');
    const secure =
        process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1' || port === 465;

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
    });

    await transporter.sendMail({
        from: message.from || `"Omniware" <${user}>`,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
    });
}

async function sendMailMessage(message: MailMessage): Promise<void> {
    if (process.env.RESEND_API_KEY?.trim()) {
        await sendMessageViaResend(message);
        return;
    }
    await sendMessageViaSmtp(message);
}

function logSettledMailFailure(result: PromiseSettledResult<void>, context: string): void {
    if (result.status !== 'rejected') return;
    console.error(`[mail] ${context} failed:`, result.reason);
}

export async function sendContactFormEmail(opts: {
    name: string;
    email: string;
    subject: string;
    message: string;
}): Promise<void> {
    if (process.env.RESEND_API_KEY?.trim()) {
        await sendViaResend(opts);
        return;
    }
    await sendViaSmtp(opts);
}

type OrderItemMail = {
    name: string;
    qty: number;
    price: number;
};

type OrderMailPayload = {
    /** Kept for internal use / subject line short ref only — never shown as full Mongo id in the body */
    orderId: string;
    orderStatus: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    totalPrice: number;
    paymentMethod: string;
    shippingAddress: {
        address: string;
        city: string;
        postalCode: string;
        country: string;
    };
    orderItems: OrderItemMail[];
};

const ORDER_STATUS_LABELS: Record<string, string> = {
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

function orderStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

/** Short customer-facing reference (last 8 chars of id), not the full database id */
function orderShortRef(orderId: string): string {
    return orderId.slice(-8).toUpperCase();
}

function statusBoxStyles(status: string): { bg: string; border: string; title: string; badge: string } {
    switch (status) {
        case 'waiting_confirmation':
        case 'pending':
            return {
                bg: '#fffbeb',
                border: '#f59e0b',
                title: '#92400e',
                badge: '#d97706',
            };
        case 'confirmed':
        case 'preparing':
            return {
                bg: '#eff6ff',
                border: '#3b82f6',
                title: '#1e3a8a',
                badge: '#2563eb',
            };
        case 'ready_for_pickup':
        case 'out_for_delivery':
        case 'shipped':
            return {
                bg: '#ecfdf5',
                border: '#10b981',
                title: '#065f46',
                badge: '#059669',
            };
        case 'delivered':
            return {
                bg: '#f0fdf4',
                border: '#22c55e',
                title: '#14532d',
                badge: '#16a34a',
            };
        case 'rejected':
        case 'cancelled':
            return {
                bg: '#fef2f2',
                border: '#ef4444',
                title: '#991b1b',
                badge: '#dc2626',
            };
        default:
            return {
                bg: '#f3f4f6',
                border: '#6b7280',
                title: '#374151',
                badge: '#4b5563',
            };
    }
}

function buildOrderItemLines(items: OrderItemMail[]): string {
    return items
        .map((item) => `- ${item.name} x ${item.qty} (LKR ${Math.round(item.price).toLocaleString()})`)
        .join('\n');
}

function formatLkr(amount: number): string {
    return `LKR ${Math.round(amount).toLocaleString()}`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildOrderItemsTableHtml(items: OrderItemMail[]): string {
    const rows = items
        .map(
            (item) => `
                <tr>
                    <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;">${escapeHtml(item.name)}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:center;">${item.qty}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;text-align:right;">${formatLkr(item.price)}</td>
                </tr>
            `
        )
        .join('');

    return `
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#ffffff;">
            <thead>
                <tr>
                    <th align="left" style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Item</th>
                    <th align="center" style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Qty</th>
                    <th align="right" style="padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Price</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function buildStatusHighlightHtml(orderId: string, orderStatus: string): string {
    const label = orderStatusLabel(orderStatus);
    const s = statusBoxStyles(orderStatus);
    return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;border-collapse:separate;border-spacing:0;">
            <tr>
                <td style="padding:18px 20px;background:${s.bg};border:2px solid ${s.border};border-radius:10px;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${s.title};margin-bottom:8px;opacity:0.85;">Order status</div>
                    <div style="font-size:18px;font-weight:700;color:${s.badge};line-height:1.3;">${escapeHtml(label)}</div>
                    <div style="font-size:12px;color:${s.title};margin-top:8px;opacity:0.9;">Reference: <strong>${escapeHtml(orderShortRef(orderId))}</strong></div>
                </td>
            </tr>
        </table>
    `;
}

function buildStatusUpdateIntro(newStatus: string): string {
    switch (newStatus) {
        case 'confirmed':
            return 'Your order has been confirmed. We will proceed with processing it and will notify you if we need anything else.';
        case 'rejected':
            return 'Your order could not be confirmed at this time. Please contact us if you have questions or would like to discuss alternatives.';
        case 'preparing':
            return 'Your order is now being prepared. We will update you again when it is ready for pickup or dispatch.';
        case 'ready_for_pickup':
            return 'Your order is ready for pickup. Please collect it at the agreed time or follow any instructions we have shared with you.';
        case 'out_for_delivery':
            return 'Your order is on its way. You should receive it soon; reply to this email if you need delivery details.';
        case 'delivered':
            return 'Your order has been marked as delivered. Thank you for shopping with Omniware.';
        case 'refunded':
            return 'Your payment for this order has been refunded. If this was unexpected, please contact our sales team.';
        case 'cancelled':
            return 'Your order has been cancelled. Contact us if you would like to place a new order or need clarification.';
        case 'paid':
            return 'We have recorded payment for your order and will continue processing it.';
        case 'shipped':
            return 'Your order has been shipped. You should receive it according to the delivery arrangement.';
        default:
            return `Your order status has been updated to ${orderStatusLabel(newStatus)}.`;
    }
}

export type OrderStatusUpdateMailPayload = {
    orderId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    newStatus: string;
    totalPrice: number;
    paymentMethod: string;
    shippingAddress: {
        address: string;
        city: string;
        postalCode: string;
        country: string;
    };
    orderItems: OrderItemMail[];
};

export async function sendOrderStatusUpdatedEmail(payload: OrderStatusUpdateMailPayload): Promise<void> {
    if (!isMailConfigured()) return;

    const email = payload.customerEmail?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        console.warn('[mail] skip status update email: invalid customer email');
        return;
    }

    const salesInbox = process.env.ORDER_MAIL_TO?.trim() || 'sales@omniware.lk';
    const from = getSalesFromHeader();
    const shortRef = orderShortRef(payload.orderId);
    const intro = buildStatusUpdateIntro(payload.newStatus);
    const newLabel = orderStatusLabel(payload.newStatus);

    const fullPayload: OrderMailPayload = {
        orderId: payload.orderId,
        orderStatus: payload.newStatus,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        customerPhone: payload.customerPhone,
        totalPrice: payload.totalPrice,
        paymentMethod: payload.paymentMethod,
        shippingAddress: payload.shippingAddress,
        orderItems: payload.orderItems,
    };

    const commonDetails = [
        `Reference: ${shortRef}`,
        `Order status: ${newLabel}`,
        `Customer: ${payload.customerName}`,
        `Email: ${payload.customerEmail}`,
        payload.customerPhone ? `Phone: ${payload.customerPhone}` : null,
        `Payment: ${payload.paymentMethod}`,
        `Total: ${formatLkr(payload.totalPrice)}`,
        'Shipping:',
        `  ${payload.shippingAddress.address}`,
        `  ${payload.shippingAddress.city}, ${payload.shippingAddress.postalCode}`,
        `  ${payload.shippingAddress.country}`,
        '',
        'Items:',
        buildOrderItemLines(payload.orderItems),
    ]
        .filter(Boolean)
        .join('\n');

    const textBody = [
        `Hi ${payload.customerName},`,
        '',
        'Your order status has been updated.',
        '',
        intro,
        '',
        commonDetails,
        '',
        `Reply to: ${salesInbox}`,
    ].join('\n');

    try {
        await sendMailMessage({
            from,
            to: [email],
            replyTo: salesInbox,
            subject: `Omniware order update · ${shortRef}`,
            text: textBody,
            html: buildOrderMailHtml({
                title: `Hi ${payload.customerName}, your order was updated`,
                intro,
                payload: fullPayload,
            }),
        });
    } catch (err) {
        console.error('[mail] sendOrderStatusUpdatedEmail failed:', err);
    }
}

function buildOrderMailHtml(opts: {
    title: string;
    intro: string;
    payload: OrderMailPayload;
}): string {
    const { payload } = opts;
    return `
        <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                <tr>
                    <td style="padding:24px;background:#111827;color:#ffffff;">
                        <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">Omniware</div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:24px;">
                        <h2 style="margin:0 0 8px 0;font-size:20px;line-height:1.3;color:#111827;">${escapeHtml(opts.title)}</h2>
                        <p style="margin:0 0 20px 0;color:#4b5563;font-size:14px;line-height:1.6;">${escapeHtml(opts.intro)}</p>

                        ${buildStatusHighlightHtml(payload.orderId, payload.orderStatus)}

                        <div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;margin-bottom:16px;">
                            <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">Order details</div>
                            <div style="font-size:14px;line-height:1.7;">
                                <strong>Customer:</strong> ${escapeHtml(payload.customerName)}<br />
                                <strong>Email:</strong> ${escapeHtml(payload.customerEmail)}<br />
                                ${payload.customerPhone ? `<strong>Phone:</strong> ${escapeHtml(payload.customerPhone)}<br />` : ''}
                                <strong>Payment:</strong> ${escapeHtml(payload.paymentMethod)}<br />
                                <strong>Total:</strong> ${escapeHtml(formatLkr(payload.totalPrice))}<br />
                                <strong>Shipping:</strong> ${escapeHtml(payload.shippingAddress.address)}, ${escapeHtml(payload.shippingAddress.city)}, ${escapeHtml(payload.shippingAddress.postalCode)}, ${escapeHtml(payload.shippingAddress.country)}
                            </div>
                        </div>

                        ${buildOrderItemsTableHtml(payload.orderItems)}
                    </td>
                </tr>
                <tr>
                    <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
                        This is an automated message from Omniware Sales.
                    </td>
                </tr>
            </table>
        </div>
    `;
}

export async function sendOrderPlacedEmails(payload: OrderMailPayload): Promise<void> {
    if (!isMailConfigured()) return;

    const salesInbox = process.env.ORDER_MAIL_TO?.trim() || 'sales@omniware.lk';
    const from = getSalesFromHeader();
    const shortOrderId = orderShortRef(payload.orderId);
    const statusLine = `Order status: ${orderStatusLabel(payload.orderStatus)}`;

    const commonDetails = [
        `Reference: ${shortOrderId}`,
        statusLine,
        `Customer: ${payload.customerName}`,
        `Email: ${payload.customerEmail}`,
        payload.customerPhone ? `Phone: ${payload.customerPhone}` : null,
        `Payment: ${payload.paymentMethod}`,
        `Total: ${formatLkr(payload.totalPrice)}`,
        'Shipping:',
        `  ${payload.shippingAddress.address}`,
        `  ${payload.shippingAddress.city}, ${payload.shippingAddress.postalCode}`,
        `  ${payload.shippingAddress.country}`,
        '',
        'Items:',
        buildOrderItemLines(payload.orderItems),
    ]
        .filter(Boolean)
        .join('\n');

    const [customerResult, salesResult] = await Promise.allSettled([
        sendMailMessage({
            from,
            to: [payload.customerEmail],
            replyTo: salesInbox,
            subject: `Omniware order received - ${shortOrderId}`,
            text: [
                `Hi ${payload.customerName},`,
                '',
                'Thank you for your order. Your order has been placed and is waiting for confirmation.',
                'Our sales team will review your order and contact you soon.',
                '',
                commonDetails,
            ].join('\n'),
            html: buildOrderMailHtml({
                title: `Hi ${payload.customerName}, your order is received`,
                intro: 'Thank you for your order. It has been placed and is waiting for confirmation. Our sales team will review it and contact you shortly.',
                payload,
            }),
        }),
        sendMailMessage({
            from,
            to: [salesInbox],
            replyTo: payload.customerEmail,
            subject: `New order placed - ${shortOrderId}`,
            text: [
                'A new order has been placed and is waiting for confirmation.',
                '',
                commonDetails,
            ].join('\n'),
            html: buildOrderMailHtml({
                title: 'New order placed',
                intro: 'A customer has placed a new order and it is now waiting for confirmation.',
                payload,
            }),
        }),
    ]);

    logSettledMailFailure(customerResult, 'customer order placed email');
    logSettledMailFailure(salesResult, 'sales order notification email');
}
