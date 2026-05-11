import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    link: { type: String, default: '' },
    badgeText: { type: String, default: '' },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    directRedirect: { type: Boolean, default: false },
}, {
    timestamps: true
});

promotionSchema.index({ validFrom: 1, validTo: 1 });
promotionSchema.index({ isActive: 1 });

const Promotion = mongoose.models.Promotion ?? mongoose.model('Promotion', promotionSchema);
export default Promotion;
