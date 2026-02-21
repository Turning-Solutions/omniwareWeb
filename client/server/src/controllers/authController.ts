import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';

// Admin-only login credentials (no public registration)
const ADMIN_USERNAME = 'omniadmin';
const ADMIN_PASSWORD = 'Oadmin26';

const generateToken = (id: string) => {
    return jwt.sign({ id }, process.env.JWT_ACCESS_SECRET || 'changeme_access', {
        expiresIn: '30d',
    });
};

export const registerUser = async (_req: Request, res: Response) => {
    res.status(403).json({ message: 'Registration is disabled' });
};

export const loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (email !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        res.status(401).json({ message: 'Invalid username or password' });
        return;
    }

    try {
        let user = await User.findOne({ email: ADMIN_USERNAME });
        if (!user) {
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, salt);
            user = await User.create({
                name: 'Admin',
                email: ADMIN_USERNAME,
                passwordHash,
                role: 'admin',
            });
        }

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id),
        });
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

export const getMe = async (req: AuthRequest, res: Response) => {
    if (req.user) {
        res.status(200).json(req.user);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};
