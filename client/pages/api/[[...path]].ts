import type { NextApiRequest, NextApiResponse } from 'next';
import { getApp } from '../../server/src/app';

// Run the Express app for all /api/* requests (serverless on Vercel).
// Next.js expects the handler to only "resolve" after a response is sent; Express sends
// the response asynchronously, so we wait for res 'finish' to avoid "API resolved without
// sending a response" / stalled request warnings.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const path = typeof req.url === 'string' ? req.url : '/api/v1';
    const pathOnly = path.split('?')[0];
    const query = path.includes('?') ? path.slice(path.indexOf('?')) : '';
    if (!pathOnly.startsWith('/api')) {
        (req as unknown as { url?: string }).url = `/api${pathOnly.startsWith('/') ? pathOnly : '/' + pathOnly}${query}`;
    }
    const app = getApp();
    return new Promise<void>((resolve, reject) => {
        const onDone = () => resolve();
        res.once('finish', onDone);
        res.once('close', onDone);
        try {
            app(req, res);
        } catch (err) {
            reject(err);
        }
    });
}

// Disable body parsing so Express can handle it
export const config = {
    api: {
        bodyParser: false,
    },
};
