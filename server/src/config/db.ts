import mongoose from 'mongoose';
import { ensureReviewIndexes } from '../models/Review';
import { ensureGoogleReviewFeedIndexes } from '../models/GoogleReviewFeed';
import { expandMongoSrvUri } from '../utils/expandMongoSrvUri';

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is not defined in environment variables");
        }
        let connectUri = process.env.MONGODB_URI;
        if (/^mongodb\+srv:\/\//i.test(connectUri)) {
            connectUri = await expandMongoSrvUri(process.env.MONGODB_URI);
        }
        const conn = await mongoose.connect(connectUri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        await ensureReviewIndexes();
        await ensureGoogleReviewFeedIndexes();
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
};

export default connectDB;
