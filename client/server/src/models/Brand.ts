import { catalogCacheInvalidation } from '../utils/catalogCacheInvalidation';
import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    logoUrl: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

brandSchema.plugin(catalogCacheInvalidation);

const Brand = mongoose.models.Brand ?? mongoose.model('Brand', brandSchema);
export default Brand;
