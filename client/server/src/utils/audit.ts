import { Request } from 'express';
import AuditLog from '../models/AuditLog';

interface AuditOptions {
    action: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
}

export const createAuditLog = async (req: Request, opts: AuditOptions) => {
    try {
        const user = (req as any).authUser;

        await AuditLog.create({
            actorUserId: user?.id || null,
            action: opts.action,
            entityType: opts.entityType,
            entityId: opts.entityId,
            before: opts.before,
            after: opts.after,
            ip: (req.headers['x-forwarded-for'] as string) || req.ip,
            userAgent: req.headers['user-agent'],
        });
    } catch (err) {
        // Never break the main request on audit failures
        console.error('Failed to write audit log', err);
    }
};

