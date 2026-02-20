import mongoose from 'mongoose';

// Serverless-friendly: cache connection per Lambda instance to avoid exhausting MongoDB connections
declare global {
    // eslint-disable-next-line no-var
    var mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
}

const cached = global.mongooseCache ?? { conn: null, promise: null };
if (process.env.NODE_ENV !== 'production') global.mongooseCache = cached;

export class DatabaseError extends Error {
    status = 503;
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

async function connectDB(): Promise<typeof mongoose> {
    if (cached.conn) return cached.conn;
    if (!process.env.MONGODB_URI) {
        throw new DatabaseError('MONGODB_URI is not set. Add it in Vercel Project Settings → Environment Variables.');
    }
    if (!cached.promise) {
        cached.promise = mongoose.connect(process.env.MONGODB_URI).catch((err) => {
            cached.promise = null;
            throw new DatabaseError(
                process.env.NODE_ENV === 'production'
                    ? 'Database connection failed. Check MONGODB_URI and network.'
                    : (err as Error).message
            );
        });
    }
    cached.conn = await cached.promise;
    return cached.conn;
}

export async function ensureDb(): Promise<void> {
    await connectDB();
}

export default connectDB;
