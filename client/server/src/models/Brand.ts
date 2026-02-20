import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    logoUrl: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

const Brand = mongoose.models.Brand ?? mongoose.model('Brand', brandSchema);
export default Brand;
