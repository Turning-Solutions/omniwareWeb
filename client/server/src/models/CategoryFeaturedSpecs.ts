import mongoose, { Schema, Document } from 'mongoose';

export interface ICategoryFeaturedSpecs extends Document {
    categoryKey: string;
    featuredSpecKeys: string[];
    createdAt: Date;
    updatedAt: Date;
}

const CategoryFeaturedSpecsSchema: Schema = new Schema({
    categoryKey: { type: String, required: true, unique: true },
    featuredSpecKeys: { type: [String], default: [] }
}, {
    timestamps: true
});

// Ensure unique index on categoryKey
CategoryFeaturedSpecsSchema.index({ categoryKey: 1 }, { unique: true });

export default (mongoose.models?.CategoryFeaturedSpecs as mongoose.Model<ICategoryFeaturedSpecs>) ?? mongoose.model<ICategoryFeaturedSpecs>('CategoryFeaturedSpecs', CategoryFeaturedSpecsSchema);
