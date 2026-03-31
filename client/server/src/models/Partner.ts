import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        logoUrl: { type: String, default: "" },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    {
        timestamps: true,
    }
);

partnerSchema.index({ isActive: 1, sortOrder: 1 });
partnerSchema.index({ name: 1 }, { unique: true });

const Partner = mongoose.models.Partner ?? mongoose.model("Partner", partnerSchema);
export default Partner;
