import mongoose from 'mongoose';

const buildRequestSchema = new mongoose.Schema({
    contactInfo: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
    },
    goal: { type: String, required: true },
    budget: { type: Number, required: true },
    selectedParts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    status: { type: String, default: 'pending', enum: ['pending', 'reviewed', 'quoted', 'completed'] },
    quote: { type: Number },
}, {
    timestamps: true
});

const BuildRequest = mongoose.model('BuildRequest', buildRequestSchema);
export default BuildRequest;
