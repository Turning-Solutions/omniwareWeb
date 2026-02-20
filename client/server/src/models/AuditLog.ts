import mongoose from 'mongoose';

export interface AuditLogDocument extends mongoose.Document {
    actorUserId?: mongoose.Types.ObjectId | null;
    action: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
    userAgent?: string;
    createdAt: Date;
}

const auditLogSchema = new mongoose.Schema<AuditLogDocument>(
    {
        actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        action: { type: String, required: true },
        entityType: { type: String, required: true },
        entityId: { type: String },
        before: { type: mongoose.Schema.Types.Mixed },
        after: { type: mongoose.Schema.Types.Mixed },
        ip: { type: String },
        userAgent: { type: String },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });

const AuditLog = mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);
export default AuditLog;

