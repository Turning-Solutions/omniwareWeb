import mongoose from 'mongoose';

const facetSnapshotSchema = new mongoose.Schema(
    {
        cacheKey: { type: String, required: true, unique: true, index: true },
        categoryKey: { type: String, required: true, index: true },
        mode: { type: String, required: true, index: true },
        payload: { type: mongoose.Schema.Types.Mixed, required: true },
        expiresAt: { type: Date, required: true, index: true },
    },
    {
        timestamps: true,
    }
);

facetSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.FacetSnapshot) {
    delete mongoose.models.FacetSnapshot;
}

const FacetSnapshot =
    mongoose.models.FacetSnapshot ?? mongoose.model('FacetSnapshot', facetSnapshotSchema);

export default FacetSnapshot;

