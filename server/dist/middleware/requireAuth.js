"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
// New admin-friendly auth middleware that prefers httpOnly cookie but
// gracefully falls back to Bearer token to avoid breaking existing flows.
const requireAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const authHeader = req.headers.authorization;
        const bearerToken = authHeader && authHeader.startsWith('Bearer') ? authHeader.split(' ')[1] : undefined;
        const cookieToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.accessToken;
        const token = cookieToken || bearerToken;
        if (!token) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_ACCESS_SECRET || 'changeme_access');
        const user = yield User_1.default.findById(decoded.id).select('-passwordHash');
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        req.authUser = {
            id: user.id,
            role: user.role,
            email: user.email,
        };
        return next();
    }
    catch (error) {
        console.error('requireAuth error', error);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
});
exports.requireAuth = requireAuth;
