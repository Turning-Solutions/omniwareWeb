import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import connectDB from "../server/src/config/db";
import { backfillProductSlugs } from "../server/src/utils/productSlug";

function loadEnvFile(fileName: string) {
    const filePath = path.join(process.cwd(), fileName);
    if (!existsSync(filePath)) return;

    const text = readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separator = trimmed.indexOf("=");
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}

function printUsage() {
    console.log([
        "Usage:",
        "  npm run backfill:product-slugs",
        "  npm run backfill:product-slugs -- --dry-run",
        "  npm run backfill:product-slugs -- --active-only",
        "",
        "Regenerates slugs for products that are missing one or still use a MongoDB id URL.",
    ].join("\n"));
}

async function main() {
    const args = new Set(process.argv.slice(2));
    if (args.has("--help") || args.has("-h")) {
        printUsage();
        return;
    }

    loadEnvFile(".env");
    loadEnvFile(".env.local");

    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is not set. Add it to .env or your shell environment.");
    }

    const dryRun = args.has("--dry-run");
    const activeOnly = args.has("--active-only");

    await connectDB();
    const result = await backfillProductSlugs({ dryRun, activeOnly });

    console.log(JSON.stringify(result, null, 2));

    if (dryRun) {
        console.log("\nDry run only. Re-run without --dry-run to write slugs.");
    } else if (result.updated > 0) {
        console.log(`\nUpdated ${result.updated} product slug(s).`);
        console.log("Redeploy or revalidate /sitemap.xml so Google picks up the new URLs.");
    }

    await mongoose.disconnect();
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
