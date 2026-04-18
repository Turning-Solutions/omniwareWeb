import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    /**
     * Optional category-wide discount amount.
     * If null/0, no category discount.
     */
    discountPercent: { type: Number, required: false, default: null, min: 0 },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

// In Next.js dev HMR, mongoose model cache can keep an older schema.
// Recreate the model in non-production so newly added fields persist immediately.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Category) {
    delete mongoose.models.Category;
}
const Category = mongoose.models.Category ?? mongoose.model('Category', categorySchema);
export default Category;
