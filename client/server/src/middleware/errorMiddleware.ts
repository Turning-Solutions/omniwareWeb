import { Request, Response, NextFunction } from 'express';

// Extend Error interface to optionally catch standard "code" and "details" from our controllers
export interface AppError extends Error {
    code?: string;
    details?: any;
    status?: number;
}

export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const statusCode = err.status || res.statusCode || 500;
    const code = statusCode === 200 ? 500 : statusCode;
    res.status(code);
    const message =
        err.message || (code === 500 ? 'An unexpected error occurred' : 'Request failed');
    if (code >= 500) console.error('[API Error]', err.message, err.stack);
    res.json({
        error: {
            code: err.code || 'INTERNAL_SERVER_ERROR',
            message,
            details: err.details,
            requestId: req.id,
        },
    });
};
