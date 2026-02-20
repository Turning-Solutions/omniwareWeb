import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    req.id = uuidv4();
    next();
};

// Add to express Request interface
declare global {
    namespace Express {
        interface Request {
            id?: string;
        }
    }
}
