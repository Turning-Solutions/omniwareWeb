/**
 * Triggers Next.js on-demand ISR revalidation after admin mutations.
 *
 * Sends a POST to /api/internal/revalidate with the given paths and tags.
 * Callers must `await` this *before* sending their HTTP response: on Vercel's
 * serverless runtime the function can freeze the instant the response is sent,
 * so a fire-and-forget call here can get dropped mid-flight — leaving a stale
 * cached page (e.g. a product 404 from before it was reactivated) stuck until
 * the next ISR window.
 */
import { getSiteUrl } from "../../../lib/seo/productSeo";

export async function triggerRevalidation(paths: string[] = ['/'], tags: string[] = []): Promise<void> {
    const secret = process.env.REVALIDATION_SECRET;
    if (!secret) {
        // Revalidation not configured — silently skip.
        return;
    }

    const baseUrl =
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
        getSiteUrl();

    if (!baseUrl) return;

    const url = `${baseUrl.replace(/\/+$/, '')}/api/internal/revalidate`;

    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({ paths, tags }),
        });
    } catch (err) {
        console.warn('[Revalidation] Failed:', (err as Error).message);
    }
}
