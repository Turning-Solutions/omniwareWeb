import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        customer: {
            name: { type: String, required: true, trim: true },
            email: { type: String, required: true, trim: true, lowercase: true },
            phone: { type: String, trim: true },
        },
        orderItems: [
            {
                name: { type: String, required: true },
                qty: { type: Number, required: true },
                image: { type: String, required: true },
                price: { type: Number, required: true },
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true,
                    ref: 'Product',
                },
            },
        ],
        shippingAddress: {
            address: { type: String, required: true },
            city: { type: String, required: true },
            postalCode: { type: String, required: true },
            country: { type: String, required: true },
        },
        paymentMethod: { type: String, required: true },
        bankTransferReceipt: {
            url: { type: String },
            publicId: { type: String },
            resourceType: { type: String, enum: ['image', 'raw'] },
            format: { type: String },
            bytes: { type: Number },
            uploadedAt: { type: Date },
        },
        paymentResult: {
            id: { type: String },
            status: { type: String },
            update_time: { type: String },
            email_address: { type: String },
        },
        itemsPrice: { type: Number, required: true, default: 0.0 },
        taxPrice: { type: Number, required: true, default: 0.0 },
        shippingPrice: { type: Number, required: true, default: 0.0 },
        totalPrice: { type: Number, required: true, default: 0.0 },
        isPaid: { type: Boolean, required: true, default: false },
        paidAt: { type: Date },
        isDelivered: { type: Boolean, required: true, default: false },
        deliveredAt: { type: Date },
        // Admin-facing fields
        status: {
            type: String,
            enum: [
                'waiting_confirmation',
                'confirmed',
                'rejected',
                'preparing',
                'ready_for_pickup',
                'out_for_delivery',
                'delivered',
                // Legacy statuses (kept for older records)
                'pending',
                'paid',
                'shipped',
                'cancelled',
                'refunded',
            ],
            default: 'waiting_confirmation',
            index: true,
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending',
            index: true,
        },
        notes: { type: String },
        trackingInfo: { type: String },
    },
    {
        timestamps: true,
    }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

// In Next.js dev/HMR, the old compiled model can linger with stale enums.
// Re-register to ensure latest schema changes are applied immediately.
if (mongoose.models.Order) {
    delete mongoose.models.Order;
}
const Order = mongoose.model('Order', orderSchema);
export default Order;
