#!/usr/bin/env node

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_SOURCE_URL,
  importGoogleReviewPayload,
  scrapeGoogleMapsReviews,
} from "../lib/server/googleMapsReviewScraper.mjs";

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run scrape:maps-reviews -- [url] [out] [max]",
      "  npm run scrape:maps-reviews -- --url \"<google maps place url>\" [--out ./data/shop-google-reviews.json] [--max 120]",
      "  node scripts/scrape-google-maps-reviews.mjs --import-url \"https://your-app/api/v1/admin/google-reviews/import\" --import-secret \"<secret>\"",
      "",
      "Defaults:",
      `  url: ${DEFAULT_SOURCE_URL}`,
      "  out: ./data/shop-google-reviews.json",
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = value;
    i++;
  }
  if (!args.url && positional[0]) args.url = positional[0];
  if (!args.out && positional[1]) args.out = positional[1];
  if (!args.max && positional[2]) args.max = positional[2];
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const sourceUrl = String(args.url || process.env.GOOGLE_REVIEWS_SOURCE_URL || DEFAULT_SOURCE_URL);
  const outputPath = String(args.out || process.env.GOOGLE_REVIEWS_OUTPUT || "./data/shop-google-reviews.json");
  const importUrl = String(args["import-url"] || process.env.GOOGLE_REVIEWS_IMPORT_URL || "").trim();
  const importSecret = String(args["import-secret"] || process.env.GOOGLE_REVIEWS_IMPORT_SECRET || "").trim();
  const maxReviews = Number.isFinite(Number(args.max)) ? Math.max(1, Number(args.max)) : 120;
  const headless = args.headful ? false : true;
  const payload = await scrapeGoogleMapsReviews({
    sourceUrl,
    maxReviews,
    launchBrowser: async () => chromium.launch({ headless }),
  });

  const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
  await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await writeFile(absoluteOutputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Saved ${payload.total} reviews to: ${absoluteOutputPath}`);

  if (importUrl) {
    await importGoogleReviewPayload(importUrl, importSecret, payload);
    console.log(`Imported reviews into: ${importUrl}`);
  }
}

main().catch((err) => {
  console.error("Failed to scrape Google Maps reviews.");
  console.error(err?.stack || err);
  process.exit(1);
});
