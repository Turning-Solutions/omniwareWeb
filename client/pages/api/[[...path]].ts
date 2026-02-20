import type { NextApiRequest, NextApiResponse } from 'next';
import { getApp } from '../../server/src/app';

// Run the Express app for all /api/* requests (serverless on Vercel)
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    // Vercel can pass path without /api prefix; ensure Express sees full path so routes match
    const path = typeof req.url === 'string' ? req.url : '/api/v1';
    const pathOnly = path.split('?')[0];
    const query = path.includes('?') ? path.slice(path.indexOf('?')) : '';
    if (!pathOnly.startsWith('/api')) {
        (req as any).url = `/api${pathOnly.startsWith('/') ? pathOnly : '/' + pathOnly}${query}`;
    }
    const app = getApp();
    return app(req, res);
}

// Disable body parsing so Express can handle it
export const config = {
    api: {
        bodyParser: false,
    },
};
