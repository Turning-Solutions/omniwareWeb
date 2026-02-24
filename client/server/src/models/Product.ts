import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: false },
    sku: { type: String, required: false },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', index: true },
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true }],
    price: { type: Number, required: true, index: true },
    stock: {
        qty: { type: Number, required: true, default: 0 }
    },
    availability: {
        type: String,
        enum: ['coming_soon', 'in_stock', 'out_of_stock', 'pre_order'],
        default: 'in_stock'
    },
    specs: { type: Map, of: String },
    badges: [{ type: String }],
    images: [{ type: String }],
    attributeGroups: [{
        category: { type: String, required: true, default: 'General' },
        attributes: [{
            name: { type: String, required: true },
            value: { type: String, required: true }
        }]
    }],
    attributes: [{
        name: { type: String, required: true },
        value: { type: String, required: true }
    }],
    variants: [{
        sku: { type: String },
        price: { type: Number },
        stock: { qty: { type: Number, default: 0 } },
        attributes: [{
            name: { type: String, required: true },
            value: { type: String, required: true }
        }]
    }],
    description: { type: String },
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
productSchema.index({ categoryIds: 1, brandId: 1, price: 1 });
productSchema.index({ isActive: 1, price: 1 });
productSchema.index({ availability: 1 });
// Wildcard index for dynamic specs used in faceted filters
productSchema.index({ 'specs.$**': 1 });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ slug: 1 }, { unique: true, sparse: true });

const Product = mongoose.models.Product ?? mongoose.model('Product', productSchema);
export default Product;
