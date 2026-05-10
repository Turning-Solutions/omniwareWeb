/**
 * Triggers Next.js on-demand ISR revalidation after admin mutations.
 *
 * Sends a POST to /api/internal/revalidate with the given paths and tags.
 * Runs fire-and-forget so it never blocks the admin response.
 */
export function triggerRevalidation(paths: string[] = ['/'], tags: string[] = []): void {
    const secret = process.env.REVALIDATION_SECRET;
    if (!secret) {
        // Revalidation not configured — silently skip.
        return;
    }

    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

    if (!baseUrl) return;

    const url = `${baseUrl.replace(/\/+$/, '')}/api/internal/revalidate`;

    // Fire-and-forget: never block the admin API response.
    void fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ paths, tags }),
    }).catch((err) => {
        console.warn('[Revalidation] Failed:', (err as Error).message);
    });
}
