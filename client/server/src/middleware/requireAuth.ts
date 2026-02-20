import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthUserPayload {
    id: string;
    role: 'customer' | 'admin';
    email: string;
}

declare module 'express-serve-static-core' {
    interface Request {
        authUser?: AuthUserPayload;
    }
}

// New admin-friendly auth middleware that prefers httpOnly cookie but
// gracefully falls back to Bearer token to avoid breaking existing flows.
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        const bearerToken =
            authHeader && authHeader.startsWith('Bearer') ? authHeader.split(' ')[1] : undefined;
        const cookieToken = (req as any).cookies?.accessToken as string | undefined;

        const token = cookieToken || bearerToken;
        if (!token) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_ACCESS_SECRET || 'changeme_access'
        ) as { id: string };

        const user = await User.findById(decoded.id).select('-passwordHash');
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.authUser = {
            id: user.id,
            role: user.role,
            email: user.email,
        };

        return next();
    } catch (error) {
        console.error('requireAuth error', error);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

