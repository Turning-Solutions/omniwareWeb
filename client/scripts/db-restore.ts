import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import mongoose from "mongoose";
import { EJSON, type Document } from "bson";
import type { CreateIndexesOptions, IndexSpecification } from "mongodb";
import connectDB from "../server/src/config/db";

/**
 * Restore a backup made by `npm run db:backup` into a database on the same cluster.
 *
 *   npm run db:restore -- --from backups/<folder> --to-db omniware_normalized
 *   npm run db:restore -- --from backups/<folder> --to-db <original db> --drop --yes-overwrite-source
 *
 * Safety:
 *  - refuses to write into a collection that already has documents unless --drop is passed
 *  - refuses to touch the database the backup came from unless --yes-overwrite-source is passed
 */

function loadEnvFile(fileName: string) {
    const filePath = path.join(process.cwd(), fileName);
    if (!existsSync(filePath)) return;
    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separator = trimmed.indexOf("=");
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
    }
}

function argValue(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index !== -1 ? process.argv[index + 1] : undefined;
}

const BATCH_SIZE = 500;

async function main() {
    const from = argValue("--from");
    const toDb = argValue("--to-db");
    const drop = process.argv.includes("--drop");
    const overwriteSource = process.argv.includes("--yes-overwrite-source");

    if (!from || !toDb || process.argv.includes("--help")) {
        console.log([
            "Usage:",
            "  npm run db:restore -- --from backups/<folder> --to-db <database name> [--drop]",
            "",
            "  --drop                   empty each target collection before restoring",
            "  --yes-overwrite-source   required to restore over the database the backup came from",
        ].join("\n"));
        return;
    }

    const dir = path.resolve(from);
    const manifestPath = path.join(dir, "manifest.json");
    if (!existsSync(manifestPath)) throw new Error(`No manifest.json in ${dir}`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { dbName: string; collections: Record<string, number> };

    if (toDb === manifest.dbName && !overwriteSource) {
        throw new Error(
            `"${toDb}" is the database this backup came from. Pass --yes-overwrite-source (with --drop) if you really mean to roll it back.`
        );
    }

    loadEnvFile(".env");
    loadEnvFile(".env.local");
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set. Add it to .env or your shell environment.");

    await connectDB();
    const target = mongoose.connection.useDb(toDb, { useCache: false }).db;
    if (!target) throw new Error("Database connection is not ready.");

    // Check every target collection first so we never leave a half-restored database.
    for (const name of Object.keys(manifest.collections)) {
        const existing = await target.collection(name).estimatedDocumentCount();
        if (existing > 0 && !drop) {
            throw new Error(`Target collection ${toDb}.${name} already has ${existing} documents. Use --drop to replace it.`);
        }
    }

    for (const [name, expected] of Object.entries(manifest.collections)) {
        const collection = target.collection(name);
        if (drop) await collection.deleteMany({});

        const lines = readline.createInterface({
            input: createReadStream(path.join(dir, `${name}.jsonl`), { encoding: "utf8" }),
            crlfDelay: Infinity,
        });
        let batch: Document[] = [];
        let count = 0;
        for await (const line of lines) {
            if (!line.trim()) continue;
            batch.push(EJSON.parse(line, { relaxed: false }) as Document);
            if (batch.length >= BATCH_SIZE) {
                await collection.insertMany(batch, { ordered: true });
                count += batch.length;
                batch = [];
            }
        }
        if (batch.length) {
            await collection.insertMany(batch, { ordered: true });
            count += batch.length;
        }

        const indexFile = path.join(dir, `${name}.indexes.json`);
        if (existsSync(indexFile)) {
            const indexes = JSON.parse(readFileSync(indexFile, "utf8")) as { name: string; key: Record<string, number | string>; [k: string]: unknown }[];
            for (const { key, name: indexName, ...rest } of indexes) {
                if (indexName === "_id_") continue;
                // Server-generated fields; not valid createIndex options.
                const options: Record<string, unknown> = { ...rest };
                delete options.v;
                delete options.ns;
                await collection.createIndex(key as IndexSpecification, { name: indexName, ...options } as CreateIndexesOptions);
            }
        }

        const status = count === expected ? "ok" : `MISMATCH (manifest says ${expected})`;
        console.log(`  ${name}: ${count} ${status}`);
    }

    console.log(`\nRestored "${manifest.dbName}" backup into "${toDb}".`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => undefined);
    });
