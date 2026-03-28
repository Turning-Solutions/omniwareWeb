import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
    {
        kind: {
            type: String,
            enum: ['shop', 'product'],
            required: true,
            index: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            index: true,
            default: null,
        },
        rating: { type: Number, required: true, min: 1, max: 5 },
        authorName: { type: String, required: true, trim: true, maxlength: 100 },
        comment: { type: String, required: true, trim: true, maxlength: 2000 },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true,
        },
    },
    { timestamps: true }
);

reviewSchema.index({ kind: 1, createdAt: -1 });
reviewSchema.index({ kind: 1, productId: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

/** Drops legacy unique index that blocks multiple shop reviews (null + null counted as duplicate). */
export async function ensureReviewIndexes(): Promise<void> {
    try {
        await Review.collection.dropIndex('product_id_1_user_id_1');
    } catch (err: unknown) {
        const code = (err as { code?: number }).code;
        const msg = String((err as Error)?.message ?? err);
        const gone = code === 27 || /index not found|ns not found/i.test(msg);
        if (!gone) console.warn('[Review] legacy index drop:', err);
    }
    await Review.syncIndexes();
}

export default Review;
