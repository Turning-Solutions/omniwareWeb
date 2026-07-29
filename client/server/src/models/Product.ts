import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: false },
    sku: { type: String, required: false },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', index: true },
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true }],
    price: { type: Number, required: true, index: true },
    dealerPrice: { type: Number, required: false, min: 0 },
    /**
     * Optional product-level discount override amount.
     * If null/0, category discount may apply.
     */
    discountPercent: { type: Number, required: false, default: null, min: 0 },
    stock: {
        qty: { type: Number, required: true, default: 0 }
    },
    availability: {
        type: String,
        enum: ['coming_soon', 'in_stock', 'out_of_stock', 'pre_order'],
        default: 'pre_order'
    },
    specs: { type: Map, of: String },
    badges: [{ type: String }],
    images: [{ type: String }],
    attributeGroups: [{
        category: { type: String, required: true, default: 'General' },
        attributes: [{
            name: { type: String, required: false },
            value: { type: String, required: true }
        }]
    }],
    attributes: [{
        name: { type: String, required: false },
        value: { type: String, required: true }
    }],
    variants: [{
        sku: { type: String },
        price: { type: Number },
        stock: { qty: { type: Number, default: 0 } },
        attributes: [{
            name: { type: String, required: false },
            value: { type: String, required: true }
        }]
    }],
    colorVariants: [{
        name: { type: String, required: true },
        hex: { type: String, required: false },
        image: { type: String, required: false },
        sku: { type: String, required: false },
        price: { type: Number, required: false },
        stock: { qty: { type: Number, default: 0 } }
    }],
    warranty: { type: String, required: false },
    extendedWarranty: {
        duration: { type: String, required: false },
        description: { type: String, required: false }
    },
    description: { type: String },
    seo: {
        title: { type: String, required: false, trim: true, maxlength: 70 },
        description: { type: String, required: false, trim: true, maxlength: 160 },
        keywords: [{ type: String, trim: true }],
        image: { type: String, required: false, trim: true },
        imageAlt: { type: String, required: false, trim: true, maxlength: 180 },
        noIndex: { type: Boolean, default: false }
    },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

// Indexes to optimize common product queries and faceted filtering
productSchema.index({ title: 1 });

productSchema.index({ brandId: 1, price: 1 });
productSchema.index({ categoryIds: 1, price: 1 });
productSchema.index({ categoryIds: 1, brandId: 1, price: 1 });
productSchema.index({ isActive: 1, price: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, categoryIds: 1, createdAt: -1 });
productSchema.index({ isActive: 1, brandId: 1, createdAt: -1 });
productSchema.index({ isActive: 1, categoryIds: 1, brandId: 1, createdAt: -1 });
productSchema.index({ isActive: 1, availability: 1, categoryIds: 1 });
productSchema.index({ availability: 1 });
// Wildcard index for dynamic specs used in faceted filters
productSchema.index({ 'specs.$**': 1 });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ slug: 1 }, { unique: true, sparse: true });

// In Next.js dev HMR, mongoose model cache can keep an older schema.
// Recreate the model in non-production so newly added fields persist immediately.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Product) {
    delete mongoose.models.Product;
}
const Product = mongoose.models.Product ?? mongoose.model('Product', productSchema);
export default Product;
