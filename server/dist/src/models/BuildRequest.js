"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const buildRequestSchema = new mongoose_1.default.Schema({
    contactInfo: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
    },
    goal: { type: String, required: true },
    budget: { type: Number, required: true },
    selectedParts: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Product' }],
    status: { type: String, default: 'pending', enum: ['pending', 'reviewed', 'quoted', 'completed'] },
    quote: { type: Number },
}, {
    timestamps: true
});
const BuildRequest = mongoose_1.default.model('BuildRequest', buildRequestSchema);
exports.default = BuildRequest;
