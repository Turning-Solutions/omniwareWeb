import mongoose, { Schema, Document } from 'mongoose';

export interface IAttributeAliasGroup {
    /** Display name shown on the compare page for the merged row. */
    canonical: string;
    /** Every spec/attribute name (as typed on products) that should be shown as `canonical`. */
    aliases: string[];
}

export interface ICategoryAttributeAlias extends Document {
    /** Main (top-level) category these mappings apply to, including its subcategories. */
    categoryId: mongoose.Types.ObjectId;
    groups: IAttributeAliasGroup[];
    createdAt: Date;
    updatedAt: Date;
}

const CategoryAttributeAliasSchema: Schema = new Schema({
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, unique: true },
    groups: [{
        _id: false,
        canonical: { type: String, required: true, trim: true },
        aliases: { type: [String], default: [] },
    }],
}, {
    timestamps: true
});

if (process.env.NODE_ENV !== 'production' && mongoose.models.CategoryAttributeAlias) {
    delete mongoose.models.CategoryAttributeAlias;
}
export default (mongoose.models?.CategoryAttributeAlias as mongoose.Model<ICategoryAttributeAlias>) ??
    mongoose.model<ICategoryAttributeAlias>('CategoryAttributeAlias', CategoryAttributeAliasSchema);
