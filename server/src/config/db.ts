import mongoose from 'mongoose';
import { ensureReviewIndexes } from '../models/Review';
import { ensureGoogleReviewFeedIndexes } from '../models/GoogleReviewFeed';

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is not defined in environment variables");
        }
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        await ensureReviewIndexes();
        await ensureGoogleReviewFeedIndexes();
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
};

export default connectDB;
