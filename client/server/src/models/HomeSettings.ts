import mongoose from "mongoose";

const homeSettingsSchema = new mongoose.Schema(
    {
        showDiscountedProductsRow: { type: Boolean, default: true },
    },
    {
        timestamps: true,
    }
);

const HomeSettings = mongoose.models.HomeSettings ?? mongoose.model("HomeSettings", homeSettingsSchema);

export default HomeSettings;
