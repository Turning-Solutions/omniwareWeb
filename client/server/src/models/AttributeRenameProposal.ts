import mongoose, { Schema, Document } from 'mongoose';

/**
 * One product's suggested attribute renames (names only — values are never changed), produced from the
 * approved naming scheme and applied only after an admin accepts it. Accepted proposals keep the old
 * and new names so the change can be undone.
 */
export interface IProposalChange {
    container: 'specs' | 'attributeGroups' | 'attributes';
    groupIndex?: number;
    groupName?: string;
    attrIndex?: number;
    /** Name as shown to people (spec keys have underscores turned into spaces). */
    oldName: string;
    /** Raw stored spec key (specs only). */
    oldKey?: string;
    newName: string;
    /** The value at the time of the suggestion — used to detect that the product changed since. */
    value: string;
    confidence: 'high' | 'medium' | 'low';
    reason?: string;
    canonicalId?: string;
}

export interface IAttributeRenameProposal extends Document {
    categoryId: mongoose.Types.ObjectId;
    productId: mongoose.Types.ObjectId;
    productTitle: string;
    brand: string;
    image?: string;
    status: 'pending' | 'accepted' | 'rejected';
    changes: IProposalChange[];
    /** Final names that two of the product's details would share. */
    collisions: string[];
    needsLook: boolean;
    acceptedAt?: Date;
    acceptedBy?: string;
    rejectedAt?: Date;
    revertedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const ChangeSchema = new Schema({
    container: { type: String, enum: ['specs', 'attributeGroups', 'attributes'], required: true },
    groupIndex: { type: Number },
    groupName: { type: String },
    attrIndex: { type: Number },
    oldName: { type: String, required: true },
    oldKey: { type: String },
    newName: { type: String, required: true },
    value: { type: String, default: '' },
    confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    reason: { type: String },
    canonicalId: { type: String },
}, { _id: false });

const AttributeRenameProposalSchema: Schema = new Schema({
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productTitle: { type: String, default: '' },
    brand: { type: String, default: '' },
    image: { type: String },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    changes: { type: [ChangeSchema], default: [] },
    collisions: { type: [String], default: [] },
    needsLook: { type: Boolean, default: false },
    acceptedAt: { type: Date },
    acceptedBy: { type: String },
    rejectedAt: { type: Date },
    revertedAt: { type: Date },
}, {
    timestamps: true
});

AttributeRenameProposalSchema.index({ categoryId: 1, productId: 1 }, { unique: true });
AttributeRenameProposalSchema.index({ categoryId: 1, status: 1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.AttributeRenameProposal) {
    delete mongoose.models.AttributeRenameProposal;
}
export default (mongoose.models?.AttributeRenameProposal as mongoose.Model<IAttributeRenameProposal>) ??
    mongoose.model<IAttributeRenameProposal>('AttributeRenameProposal', AttributeRenameProposalSchema);
