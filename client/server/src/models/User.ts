import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    phone: { type: String },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    addresses: [{
        street: String,
        city: String,
        state: String,
        zip: String,
        country: String
    }]
}, {
    timestamps: true
});

const User = mongoose.models.User ?? mongoose.model('User', userSchema);
export default User;
