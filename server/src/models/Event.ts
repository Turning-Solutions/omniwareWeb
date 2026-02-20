import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
    type: string;
    ts: Date;
    userId?: mongoose.Types.ObjectId;
    sessionId?: string;
    productId?: mongoose.Types.ObjectId;
    orderId?: mongoose.Types.ObjectId;
    category?: string;
    brand?: string;
    props?: Record<string, any>;
    ua?: string;
    ip?: string;
    referrer?: string;
}

const eventSchema = new Schema<IEvent>({
    type: { type: String, required: true, index: true },
    ts: { type: Date, default: Date.now, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    category: { type: String, index: true },
    brand: { type: String, index: true },
    props: { type: Schema.Types.Mixed },
    ua: { type: String },
    ip: { type: String },
    referrer: { type: String }
}, {
    timestamps: false // We use 'ts' manually
});

// Indexes from requirements
eventSchema.index({ type: 1, ts: -1 });
eventSchema.index({ productId: 1, ts: -1 });
eventSchema.index({ sessionId: 1, ts: -1 });
eventSchema.index({ category: 1, ts: -1 });

export const Event = mongoose.model<IEvent>('Event', eventSchema);
