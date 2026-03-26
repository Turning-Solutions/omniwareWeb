import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    /**
     * Optional category-wide discount (percent 0-100).
     * If null/0, no category discount.
     */
    discountPercent: { type: Number, required: false, default: null, min: 0, max: 100 },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

// In dev, recreate the model so schema changes apply immediately.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Category) {
    delete mongoose.models.Category;
}
const Category = mongoose.models.Category ?? mongoose.model('Category', categorySchema);
export default Category;
