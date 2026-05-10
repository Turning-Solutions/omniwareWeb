import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET || '';

export async function POST(req: NextRequest) {
    // Protect the endpoint with a shared secret
    const authHeader = req.headers.get('authorization');
    if (!REVALIDATION_SECRET || authHeader !== `Bearer ${REVALIDATION_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { paths } = body as { paths?: string[] };

    const revalidated: string[] = [];

    if (Array.isArray(paths)) {
        for (const path of paths) {
            revalidatePath(path);
            revalidated.push(path);
        }
    }

    // Always revalidate the home page (most visible)
    if (!revalidated.includes('/')) {
        revalidatePath('/');
        revalidated.push('/');
    }

    return NextResponse.json({ revalidated, now: Date.now() });
}
