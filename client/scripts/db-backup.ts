import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { once } from "node:events";
import mongoose from "mongoose";
import { EJSON } from "bson";
import connectDB from "../server/src/config/db";

/**
 * Full logical backup of the database in MONGODB_URI — every collection, every document,
 * plus index definitions. Written as canonical Extended JSON (one document per line) so
 * ObjectIds, Dates, Decimals etc. survive a round trip exactly.
 *
 * Output: backups/<dbName>-<timestamp>/
 *   manifest.json                 db name, time, per-collection counts
 *   <collection>.jsonl            documents
 *   <collection>.indexes.json     index specs
 *
 * Restore with `npm run db:restore` (into the same or a new database name).
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

async function main() {
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
        console.log([
            "Usage:",
            "  npm run db:backup",
            "  npm run db:backup -- --out ./my-backups",
            "",
            "Dumps every collection of the MONGODB_URI database to backups/<db>-<timestamp>/.",
        ].join("\n"));
        return;
    }

    loadEnvFile(".env");
    loadEnvFile(".env.local");
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set. Add it to .env or your shell environment.");

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is not ready.");

    const dbName = db.databaseName;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outDir = path.resolve(argValue("--out") ?? "backups", `${dbName}-${stamp}`);
    mkdirSync(outDir, { recursive: true });

    const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
        .map((c) => c.name)
        .filter((name) => !name.startsWith("system."))
        .sort();

    const manifest: { dbName: string; createdAt: string; collections: Record<string, number> } = {
        dbName,
        createdAt: new Date().toISOString(),
        collections: {},
    };

    for (const name of collections) {
        const collection = db.collection(name);
        const file = createWriteStream(path.join(outDir, `${name}.jsonl`), { encoding: "utf8" });
        let count = 0;
        for await (const doc of collection.find({})) {
            if (!file.write(EJSON.stringify(doc, { relaxed: false }) + "\n")) await once(file, "drain");
            count += 1;
        }
        file.end();
        await once(file, "finish");

        const indexes = await collection.indexes();
        writeFileSync(path.join(outDir, `${name}.indexes.json`), JSON.stringify(indexes, null, 2));

        const expected = await collection.countDocuments();
        if (expected !== count) {
            console.warn(`  ! ${name}: wrote ${count} docs but collection now has ${expected} (written to during backup?)`);
        }
        manifest.collections[name] = count;
        console.log(`  ${name}: ${count}`);
    }

    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`\nBackup of "${dbName}" written to ${outDir}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => undefined);
    });
