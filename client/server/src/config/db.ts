import mongoose from 'mongoose';

// Serverless-friendly: cache connection per Lambda instance to avoid exhausting MongoDB connections
declare global {
    // eslint-disable-next-line no-var
    var mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
}

const cached = global.mongooseCache ?? { conn: null, promise: null };
if (process.env.NODE_ENV !== 'production') global.mongooseCache = cached;

async function connectDB(): Promise<typeof mongoose> {
    if (cached.conn) return cached.conn;
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined in environment variables');
    }
    if (!cached.promise) {
        cached.promise = mongoose.connect(process.env.MONGODB_URI);
    }
    cached.conn = await cached.promise;
    return cached.conn;
}

export async function ensureDb(): Promise<void> {
    await connectDB();
}

export default connectDB;
