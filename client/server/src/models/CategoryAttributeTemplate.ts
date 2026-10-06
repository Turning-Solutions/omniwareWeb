import mongoose, { Schema, Document } from 'mongoose';

/**
 * Admin-defined standard attribute list for a main category (e.g. the RAM spec sheet).
 * The naming-scheme AI must map raw attribute names onto these exact names when the meaning
 * matches; anything that doesn't match keeps its own name.
 */
export interface ICategoryAttributeTemplate extends Document {
    categoryId: mongoose.Types.ObjectId;
    attributes: { name: string; description?: string }[];
    createdAt: Date;
    updatedAt: Date;
}

const CategoryAttributeTemplateSchema: Schema = new Schema({
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, unique: true },
    attributes: [{
        _id: false,
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
    }],
}, {
    timestamps: true
});

if (process.env.NODE_ENV !== 'production' && mongoose.models.CategoryAttributeTemplate) {
    delete mongoose.models.CategoryAttributeTemplate;
}
export default (mongoose.models?.CategoryAttributeTemplate as mongoose.Model<ICategoryAttributeTemplate>) ??
    mongoose.model<ICategoryAttributeTemplate>('CategoryAttributeTemplate', CategoryAttributeTemplateSchema);
