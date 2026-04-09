import mongoose from 'mongoose';

const googleReviewItemSchema = new mongoose.Schema(
    {
        externalId: { type: String, required: true, trim: true, maxlength: 200 },
        authorName: { type: String, required: true, trim: true, maxlength: 100 },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, required: true, trim: true, maxlength: 4000 },
        dateText: { type: String, default: '', trim: true, maxlength: 120 },
        createdAt: { type: Date, required: true },
    },
    { _id: false }
);

const googleReviewFeedSchema = new mongoose.Schema(
    {
        sourceKey: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            maxlength: 80,
            default: 'omniware-google-maps',
        },
        sourceUrl: { type: String, required: true, trim: true, maxlength: 2000 },
        reviewCount: { type: Number, default: 0, min: 0 },
        reviews: { type: [googleReviewItemSchema], default: [] },
        lastRequestedAt: { type: Date, default: null },
        lastSyncedAt: { type: Date, default: null },
        lastImportStatus: {
            type: String,
            enum: ['idle', 'pending', 'success', 'error'],
            default: 'idle',
        },
        lastError: { type: String, default: '', maxlength: 1000 },
        lastRequestedBy: { type: String, default: '', trim: true, maxlength: 160 },
    },
    { timestamps: true }
);

googleReviewFeedSchema.index({ sourceKey: 1 }, { unique: true });

const GoogleReviewFeed =
    mongoose.models.GoogleReviewFeed || mongoose.model('GoogleReviewFeed', googleReviewFeedSchema);

export async function ensureGoogleReviewFeedIndexes(): Promise<void> {
    await GoogleReviewFeed.syncIndexes();
}

export default GoogleReviewFeed;
