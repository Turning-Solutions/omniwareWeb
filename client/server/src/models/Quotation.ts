import mongoose from 'mongoose';

const quotationItemSchema = new mongoose.Schema(
    {
        productId: { type: String, required: false },
        title: { type: String, required: true },
        qty: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        image: { type: String, required: false },
    },
    { _id: false }
);

const quotationSchema = new mongoose.Schema(
    {
        items: { type: [quotationItemSchema], required: true },
        currency: { type: String, default: 'LKR' },
        subtotal: { type: Number, required: true },
    },
    {
        timestamps: true,
    }
);

const Quotation = mongoose.models.Quotation ?? mongoose.model('Quotation', quotationSchema);

export default Quotation;

