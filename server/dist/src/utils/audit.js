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
exports.createAuditLog = void 0;
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
const createAuditLog = (req, opts) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.authUser;
        yield AuditLog_1.default.create({
            actorUserId: (user === null || user === void 0 ? void 0 : user.id) || null,
            action: opts.action,
            entityType: opts.entityType,
            entityId: opts.entityId,
            before: opts.before,
            after: opts.after,
            ip: req.headers['x-forwarded-for'] || req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
    catch (err) {
        // Never break the main request on audit failures
        console.error('Failed to write audit log', err);
    }
});
exports.createAuditLog = createAuditLog;
