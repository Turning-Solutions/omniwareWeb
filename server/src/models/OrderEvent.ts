import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderEvent extends Document {
    orderId: mongoose.Types.ObjectId;
    status: string;
    prevStatus?: string;
    changedBy?: mongoose.Types.ObjectId; // User ID (admin)
    ts: Date;
    note?: string;
}

const orderEventSchema = new Schema<IOrderEvent>({
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    status: { type: String, required: true },
    prevStatus: { type: String },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    ts: { type: Date, default: Date.now },
    note: { type: String }
});

export const OrderEvent = mongoose.model<IOrderEvent>('OrderEvent', orderEventSchema);
