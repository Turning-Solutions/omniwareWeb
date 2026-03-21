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

/** Resend only allows verified domains; public inboxes cannot be the From address. */
const RESEND_TEST_FROM = 'Omniware <onboarding@resend.dev>';

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

/** Use verified / Resend test From; never a random @gmail.com etc. */
function resolveResendFromHeader(): string {
    const raw = process.env.MAIL_FROM?.trim();
    if (!raw) return RESEND_TEST_FROM;

    const email = parseFromEmail(raw);
    if (!email) return raw;

    const domain = email.split('@')[1] ?? '';
    if (RESEND_BLOCKED_FROM_DOMAINS.has(domain)) {
        console.warn(
            `[mail] MAIL_FROM (${email}) cannot be used with Resend without verifying that domain. ` +
                `Using ${RESEND_TEST_FROM} for the From header. Replies still use the visitor's address (Reply-To). ` +
                `For production, verify your domain at https://resend.com/domains and set MAIL_FROM to an address on that domain.`
        );
        return RESEND_TEST_FROM;
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
