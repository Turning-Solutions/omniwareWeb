/**
 * Create a MongoDB backup before migrations.
 *
 * 1. Uses `mongodump` when MongoDB Database Tools are on PATH (or `MONGODB_DUMP_PATH`).
 * 2. If `mongodump` is missing (ENOENT on Windows/macOS/Linux), falls back to a Node.js
 *    export: Extended JSON per collection (no extra install).
 *
 * Optional env:
 *   MONGODB_DUMP_FORCE_NODE=1   — skip mongodump, always use Node export
 *   MONGODB_DUMP_PATH             — full path to mongodump executable
 *   MONGODB_URI_DIRECT            — alternate URI (e.g. Atlas “standard” connection string)
 *   MONGODB_DNS_SERVERS           — optional, e.g. `8.8.8.8,1.1.1.1` for SRV resolution
 *
 * For `mongodb+srv://`, the script expands to a seed-list URI (same strategy as
 * `client/server/src/config/db.ts`) so local DNS/querySrv issues are avoided.
 *
 * Run from `server/`:
 *   npm run dump:db
 *
 * Output: `server/backups/mongodb-dump-<timestamp>/`
 */
import { EJSON } from 'bson';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import mongoose from 'mongoose';
import { expandMongoSrvUri } from '../utils/expandMongoSrvUri';

function loadEnv(): void {
    const here = __dirname;
    const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(here, '../../.env'),
        path.resolve(here, '../../../client/.env'),
        path.resolve(here, '../../../.env'),
    ];
    for (const file of candidates) {
        if (fs.existsSync(file)) {
            dotenv.config({ path: file });
            console.log(`[dump:db] Loaded env from ${file}`);
            if (process.env.MONGODB_URI) return;
        }
    }
    dotenv.config();
}
loadEnv();

async function resolveConnectUri(): Promise<string> {
    const direct = process.env.MONGODB_URI_DIRECT?.trim();
    if (direct) {
        console.log('[dump:db] Using MONGODB_URI_DIRECT (non-SRV or alternate URI).');
        return direct;
    }
    const primary = process.env.MONGODB_URI?.trim();
    if (!primary) {
        throw new Error('MONGODB_URI is not set.');
    }
    // Do not rely on `new URL()` here — passwords with special characters can throw and we
    // would fall through to raw mongodb+srv:// (driver uses querySrv and fails on some networks).
    if (!/^mongodb\+srv:\/\//i.test(primary)) {
        return primary;
    }
    console.log('[dump:db] Expanding mongodb+srv:// to seed-list URI (manual SRV, avoids driver querySrv).');
    return expandMongoSrvUri(primary);
}

function printConnectionTroubleshooting(err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';

    if (msg.includes('querySrv') || code === 'ECONNREFUSED' || msg.includes('ENOTFOUND')) {
        console.error('');
        console.error('[dump:db] MongoDB connection failed during DNS (often with mongodb+srv://).');
        console.error('[dump:db] Try one of:');
        console.error('  • Atlas → Network Access: allow your current IP (or 0.0.0.0/0 for dev).');
        console.error('  • Use another network/VPN if DNS or firewall blocks SRV lookups.');
        console.error('  • In Atlas → Connect → Drivers: copy the standard (non-SRV) URI if offered,');
        console.error('    put it in MONGODB_URI_DIRECT in .env for this script only.');
        console.error('  • Try MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1 if your resolver blocks SRV.');
        console.error('');
    }
}

async function dumpWithNode(uri: string, outDir: string): Promise<void> {
    await mongoose.connect(uri.trim());
    try {
        const db = mongoose.connection.db;
        if (!db) throw new Error('No database after connect');
        const dbName = db.databaseName;
        const dbOut = path.join(outDir, dbName);
        fs.mkdirSync(dbOut, { recursive: true });

        const cols = await db.listCollections().toArray();
        let total = 0;
        for (const { name } of cols) {
            if (name.startsWith('system.')) continue;
            const docs = await db.collection(name).find({}).toArray();
            total += docs.length;
            const file = path.join(dbOut, `${name}.ejson.json`);
            fs.writeFileSync(file, EJSON.stringify(docs, { relaxed: true }), 'utf8');
            console.log(`[dump:db]   ${name}: ${docs.length} document(s)`);
        }

        fs.writeFileSync(
            path.join(outDir, 'README.txt'),
            [
                'Backup mode: Node.js + BSON Extended JSON (mongodump was not available or FORCE_NODE was set).',
                `Database: ${dbName}`,
                'Each file is an EJSON array of documents (*.ejson.json).',
                '',
            ].join('\n'),
            'utf8'
        );
        console.log(`[dump:db] Node export complete (${total} documents total).`);
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
}

function spawnMongodump(uri: string, outDir: string) {
    const custom = process.env.MONGODB_DUMP_PATH?.trim();
    const candidates = custom
        ? [custom]
        : process.platform === 'win32'
          ? ['mongodump.exe', 'mongodump']
          : ['mongodump'];

    let last: ReturnType<typeof spawnSync> | undefined;
    for (const bin of candidates) {
        const result = spawnSync(bin, ['--uri', uri.trim(), '--gzip', '--out', outDir], {
            stdio: 'inherit',
            shell: false,
        });
        last = result;
        const code = (result.error as NodeJS.ErrnoException | undefined)?.code;
        if (!result.error || code !== 'ENOENT') {
            return result;
        }
    }
    return last!;
}

async function main(): Promise<void> {
    let uri: string;
    try {
        uri = await resolveConnectUri();
    } catch {
        console.error('[dump:db] MONGODB_URI is not set.');
        process.exit(1);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupsRoot = path.resolve(__dirname, '../../backups');
    const outDir = path.join(backupsRoot, `mongodb-dump-${stamp}`);

    fs.mkdirSync(outDir, { recursive: true });
    console.log('[dump:db] Writing to:', outDir);

    if (process.env.MONGODB_DUMP_FORCE_NODE === '1') {
        console.log('[dump:db] MONGODB_DUMP_FORCE_NODE=1 — using Node.js export.');
        await dumpWithNode(uri, outDir);
        console.log('[dump:db] Done.');
        return;
    }

    const result = spawnMongodump(uri, outDir);
    const errno = (result.error as NodeJS.ErrnoException | undefined)?.code;

    if (result.error && errno === 'ENOENT') {
        console.warn('[dump:db] mongodump not found on PATH; using Node.js Extended JSON export.');
        await dumpWithNode(uri, outDir);
        console.log('[dump:db] Done.');
        return;
    }

    if (result.error) {
        console.error('[dump:db] Failed to spawn mongodump:', result.error.message);
        process.exit(1);
    }

    if (result.status !== 0) {
        console.error('[dump:db] mongodump exited with code', result.status);
        process.exit(result.status ?? 1);
    }

    console.log('[dump:db] Done.');
}

main().catch((err) => {
    if (!(err instanceof Error && err.message.includes('MONGODB_URI'))) {
        printConnectionTroubleshooting(err);
    }
    console.error('[dump:db] FAILED:', err);
    process.exit(1);
});
