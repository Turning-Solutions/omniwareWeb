import type { NextApiRequest, NextApiResponse } from 'next';
import { getApp } from '../../server/src/app';

// Run the Express app for all /api/* requests (serverless on Vercel)
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const app = getApp();
    return app(req, res);
}

// Disable body parsing so Express can handle it
export const config = {
    api: {
        bodyParser: false,
    },
};
