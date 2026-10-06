import mongoose, { Schema, Document } from 'mongoose';

/** The AI provider + model the admin picked in the UI (API keys stay in environment variables). */
export interface IAiSetting extends Document {
    key: string;
    provider: string;
    modelName: string;
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const AiSettingSchema: Schema = new Schema({
    key: { type: String, required: true, unique: true, default: 'default' },
    provider: { type: String, required: true },
    modelName: { type: String, required: true, trim: true },
    updatedBy: { type: String },
}, {
    timestamps: true
});

if (process.env.NODE_ENV !== 'production' && mongoose.models.AiSetting) {
    delete mongoose.models.AiSetting;
}
export default (mongoose.models?.AiSetting as mongoose.Model<IAiSetting>) ??
    mongoose.model<IAiSetting>('AiSetting', AiSettingSchema);
