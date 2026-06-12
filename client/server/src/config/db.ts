import mongoose from 'mongoose';
import dns from 'node:dns';

// Serverless-friendly: cache connection per Lambda instance to avoid exhausting MongoDB connections
declare global {
    // eslint-disable-next-line no-var
    var mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
}

const cached = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cached;

export class DatabaseError extends Error {
    status = 503;
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

let reviewIndexesPromise: Promise<void> | null = null;

// Some local Node runtimes fail the driver's internal SRV lookup even when DNS works.
// Expanding the SRV URI ourselves keeps local development working without affecting env shape.
async function expandMongoSrvUri(uri: string): Promise<string> {
    const parsed = new URL(uri);
    const srvHost = `_mongodb._tcp.${parsed.host}`;
    const serversBefore = dns.getServers();
    if (serversBefore.length > 0 && serversBefore.every((server) => server === '127.0.0.1' || server === '::1')) {
        dns.setServers(['1.1.1.1', '8.8.8.8']);
    }
    const srvRecords = await new Promise<dns.SrvRecord[]>((resolve, reject) => {
        dns.resolveSrv(srvHost, (err, records) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(records);
        });
    });
    const txtRecords = await new Promise<string[][]>((resolve, reject) => {
        dns.resolveTxt(parsed.host, (err, records) => {
            if (err && (err as NodeJS.ErrnoException).code !== 'ENODATA' && (err as NodeJS.ErrnoException).code !== 'ENOTFOUND') {
                reject(err);
                return;
            }
            resolve(records ?? []);
        });
    });
    const params = new URLSearchParams(parsed.search);
    for (const chunk of txtRecords) {
        for (const part of chunk.join('').split('&')) {
            const [key, value] = part.split('=');
            if (key && value && !params.has(key)) params.set(key, value);
        }
    }
    if (!params.has('tls')) params.set('tls', 'true');
    const dbName = (parsed.pathname || '/').replace(/^\//, '');
    const seedList = srvRecords.map((record) => `${record.name}:${record.port}`).join(',');
    return `mongodb://${encodeURIComponent(parsed.username)}:${encodeURIComponent(parsed.password)}@${seedList}/${dbName}?${params.toString()}`;
}

async function connectDB(): Promise<typeof mongoose> {
    if (cached.conn) return cached.conn;
    if (!process.env.MONGODB_URI) {
        throw new DatabaseError('MONGODB_URI is not set. Add it in Vercel Project Settings → Environment Variables.');
    }
    let connectUri = process.env.MONGODB_URI;
    try {
        const uri = new URL(process.env.MONGODB_URI);
        if (uri.protocol === 'mongodb+srv:') {
            connectUri = await expandMongoSrvUri(process.env.MONGODB_URI);
        }
    } catch {
        // noop
    }
    if (!cached.promise) {
        cached.promise = mongoose.connect(connectUri).catch((err) => {
            cached.promise = null;
            throw new DatabaseError(
                process.env.NODE_ENV === 'production'
                    ? 'Database connection failed. Check MONGODB_URI and network.'
                    : (err as Error).message
            );
        });
    }
    cached.conn = await cached.promise;
    if (process.env.VERCEL_REGION) {
        console.info(`[DB] Connected in region ${process.env.VERCEL_REGION}`);
    }
    return cached.conn;
}

export async function ensureDb(): Promise<void> {
    await connectDB();
    // Index creation only needs to happen once per database, not on every serverless
    // cold start — it adds seconds to the first request of each new instance.
    // Set ENSURE_DB_INDEXES=true (or run locally in dev) after schema changes to (re)create them.
    if (process.env.NODE_ENV === 'production' && process.env.ENSURE_DB_INDEXES !== 'true') {
        return;
    }
    if (!reviewIndexesPromise) {
        reviewIndexesPromise = Promise.all([
            import('../models/Review').then(({ ensureReviewIndexes }) => ensureReviewIndexes()),
            import('../models/GoogleReviewFeed').then(({ ensureGoogleReviewFeedIndexes }) =>
                ensureGoogleReviewFeedIndexes()
            ),
        ])
            .then(() => undefined)
            .catch((err) => {
                reviewIndexesPromise = null;
                console.error('[DB] ensure indexes', err);
                throw err;
            });
    }
    await reviewIndexesPromise;
}

export default connectDB;
