import express from 'express';
import cors from 'cors';
import { ensureDb } from './config/db';
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import orderRoutes from './routes/orderRoutes';
import adminRoutes from './routes/adminRoutes';
import builderRoutes from './routes/builderRoutes';
import adminProductRoutes from './routes/admin.products';
import analyticsRoutes from './routes/analyticsRoutes';
import featuredSpecsRoutes from './routes/featuredSpecsRoutes';
import uploadRoutes from './routes/uploadRoutes';
import { errorHandler } from './middleware/errorMiddleware';
import { requestIdMiddleware } from './middleware/requestId';

// Middleware: ensure DB is connected before handling requests (serverless-safe)
async function ensureDbMiddleware(
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction
) {
    try {
        await ensureDb();
        next();
    } catch (err) {
        next(err);
    }
}

function createApp() {
    const app = express();

    app.use(
        cors({
            origin: true, // Allow same-origin and Vercel preview URLs
            credentials: true,
        })
    );
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use(ensureDbMiddleware);

    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/products', productRoutes);
    app.use('/api/v1/orders', orderRoutes);
    app.use('/api/v1/admin/products', adminProductRoutes);
    app.use('/api/v1/admin/categories', featuredSpecsRoutes);
    app.use('/api/v1/admin/upload', uploadRoutes);
    app.use('/api/v1/admin', adminRoutes);
    app.use('/api/v1/builder', builderRoutes);
    app.use('/api/v1/analytics', analyticsRoutes);

    app.get('/api', (_req, res) => {
        res.send('Omniware API is running');
    });

    app.use(errorHandler);
    return app;
}

// Singleton for serverless (reuse across invocations in same instance)
let appInstance: express.Express | null = null;

export function getApp(): express.Express {
    if (!appInstance) appInstance = createApp();
    return appInstance;
}

export default getApp;
