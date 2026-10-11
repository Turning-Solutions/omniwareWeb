import mongoose, { Schema, Document } from 'mongoose';

/**
 * One product's conversion to its category's standard detail list: the AI fills each standard field
 * from the product's existing details, the admin checks it, chooses which old details to keep, and
 * approves. Nothing is written to the product until approval; the previous details are kept for undo.
 */
export interface IConversionSource {
    /** Where the information came from: an existing detail id (see occurrenceKey) or "title". */
    id: string;
    name: string;
    value: string;
}

export interface IConversionField {
    name: string;
    value: string;
    basis: 'copied' | 'typed' | 'reformatted' | 'inferred' | 'missing';
    sources: IConversionSource[];
    note?: string;
    /** Worth a human look: worked out rather than copied, or a number that isn't in the sources. */
    check: boolean;
}

export interface IConversionExisting {
    id: string;
    container: 'specs' | 'attributeGroups' | 'attributes';
    groupName?: string;
    name: string;
    value: string;
    /** Standard fields this detail's information went into. */
    usedFor: string[];
    /** Same stored name as a standard field — it is replaced, so it can't be kept separately. */
    replaced: boolean;
    keep: boolean;
}

export interface IProductConversion extends Document {
    categoryId: mongoose.Types.ObjectId;
    productId: mongoose.Types.ObjectId;
    productTitle: string;
    brand: string;
    image?: string;
    status: 'queued' | 'pending' | 'approved' | 'skipped' | 'failed';
    fields: IConversionField[];
    existing: IConversionExisting[];
    needsLook: boolean;
    error?: string;
    aiModel?: string;
    /** Fingerprint of the product's details when the AI read them — approval is refused if they changed. */
    sourceFingerprint?: string;
    /** Fingerprint right after approval — undo is refused if the product was edited since. */
    afterFingerprint?: string;
    /** The product's details before approval (for undo). */
    before?: unknown;
    approvedAt?: Date;
    approvedBy?: string;
    skippedAt?: Date;
    revertedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const SourceSchema = new Schema({ id: String, name: String, value: String }, { _id: false });

const FieldSchema = new Schema({
    name: { type: String, required: true },
    value: { type: String, default: '' },
    basis: { type: String, enum: ['copied', 'typed', 'reformatted', 'inferred', 'missing'], default: 'missing' },
    sources: { type: [SourceSchema], default: [] },
    note: { type: String },
    check: { type: Boolean, default: false },
}, { _id: false });

const ExistingSchema = new Schema({
    id: { type: String, required: true },
    container: { type: String, enum: ['specs', 'attributeGroups', 'attributes'], required: true },
    groupName: { type: String },
    name: { type: String, required: true },
    value: { type: String, default: '' },
    usedFor: { type: [String], default: [] },
    replaced: { type: Boolean, default: false },
    keep: { type: Boolean, default: false },
}, { _id: false });

const ProductConversionSchema: Schema = new Schema({
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productTitle: { type: String, default: '' },
    brand: { type: String, default: '' },
    image: { type: String },
    status: { type: String, enum: ['queued', 'pending', 'approved', 'skipped', 'failed'], default: 'queued' },
    fields: { type: [FieldSchema], default: [] },
    existing: { type: [ExistingSchema], default: [] },
    needsLook: { type: Boolean, default: false },
    error: { type: String },
    aiModel: { type: String },
    sourceFingerprint: { type: String },
    afterFingerprint: { type: String },
    before: { type: Schema.Types.Mixed },
    approvedAt: { type: Date },
    approvedBy: { type: String },
    skippedAt: { type: Date },
    revertedAt: { type: Date },
}, {
    timestamps: true
});

ProductConversionSchema.index({ categoryId: 1, productId: 1 }, { unique: true });
ProductConversionSchema.index({ categoryId: 1, status: 1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.ProductConversion) {
    delete mongoose.models.ProductConversion;
}
export default (mongoose.models?.ProductConversion as mongoose.Model<IProductConversion>) ??
    mongoose.model<IProductConversion>('ProductConversion', ProductConversionSchema);
