#!/usr/bin/env node

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_SOURCE_URL =
  "https://www.google.com/maps/place/Omniware+Technologies/@6.8499418,79.8840428,17z/data=!4m8!3m7!1s0x3ae25bc001c21cfb:0x706552a0c455e4a3!8m2!3d6.8499365!4d79.8866177!9m1!1b1!16s%2Fg%2F11srgk22h7?entry=ttu&g_ep=EgoyMDI2MDQwNy4wIKXMDSoASAFQAw%3D%3D";

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run scrape:maps-reviews -- [url] [out] [max]",
      "  npm run scrape:maps-reviews -- --url \"<google maps place url>\" [--out ./data/shop-google-reviews.json] [--max 120]",
      "  node scripts/scrape-google-maps-reviews.mjs --import-url \"https://your-app/api/v1/admin/google-reviews/import\" --import-secret \"<secret>\"",
      "",
      "Hosted worker:",
      "  deploy the separate service in google-review-worker/ for Railway or another long-running host",
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

function parseRating(value) {
  if (!value) return null;
  const m = String(value).match(/([\d.]+)\s*(?:out of|star|stars)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.max(1, Math.min(5, Math.round(n))) : null;
}

async function maybeAcceptConsent(page) {
  const consentButtons = [
    page.getByRole("button", { name: /accept all|i agree|accept/i }),
    page.locator('button:has-text("Accept all")'),
  ];

  for (const locator of consentButtons) {
    const count = await locator.count().catch(() => 0);
    if (!count) continue;
    try {
      await locator.first().click({ timeout: 1500 });
      await page.waitForTimeout(1000);
      return;
    } catch {
      // Ignore consent if it is not present/clickable.
    }
  }
}

async function openReviewsPanel(page) {
  const openers = [
    page.locator('button[jsaction*="pane.reviewChart.moreReviews"]'),
    page.getByRole("button", { name: /reviews/i }),
    page.getByRole("tab", { name: /reviews/i }),
    page.locator('[aria-label*="reviews" i][role="button"]'),
  ];

  for (const opener of openers) {
    const count = await opener.count().catch(() => 0);
    if (!count) continue;
    for (let i = 0; i < count; i++) {
      const candidate = opener.nth(i);
      try {
        if (!(await candidate.isVisible())) continue;
        await candidate.click({ timeout: 2500 });
        await page.waitForTimeout(1500);
        return true;
      } catch {
        // Try the next candidate.
      }
    }
  }
  return false;
}

async function waitForReviewSurface(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector('div[role="feed"]') ||
          document.querySelector('div[data-review-id]') ||
          document.querySelector(".jftiEf")
      ),
    { timeout: 15000 }
  );
}

async function findReviewScrollerHandle(page) {
  return page.evaluateHandle(() => {
    const directFeed = document.querySelector('div[role="feed"]');
    if (directFeed instanceof HTMLElement) return directFeed;

    const all = Array.from(document.querySelectorAll("div"));
    const possible = all.filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.scrollHeight <= el.clientHeight + 20) return false;
      return Boolean(el.querySelector('div[data-review-id], .jftiEf'));
    });
    return possible.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? null;
  });
}

async function scrapeReviews(page, maxReviews) {
  const reviews = [];
  const seen = new Set();
  let sameCountRounds = 0;
  let previousCount = 0;

  await waitForReviewSurface(page);
  const scrollerHandle = await findReviewScrollerHandle(page);
  const noScroller = await scrollerHandle.evaluate((el) => el == null);
  if (noScroller) {
    throw new Error("Could not find the reviews scroll container.");
  }

  while (reviews.length < maxReviews && sameCountRounds < 10) {
    const cards = page.locator('div[data-review-id], div.jftiEf');
    const count = await cards.count();

    for (let i = 0; i < count && reviews.length < maxReviews; i++) {
      const card = cards.nth(i);
      const reviewId =
        (await card.getAttribute("data-review-id").catch(() => null)) ||
        `review-${i}-${reviews.length}`;
      if (seen.has(reviewId)) continue;

      const moreBtn = card.getByRole("button", { name: /more|full review/i });
      if ((await moreBtn.count().catch(() => 0)) > 0) {
        try {
          await moreBtn.first().click({ timeout: 800 });
        } catch {
          // Optional expansion only.
        }
      }

      const author =
        (await card.locator(".d4r55").first().textContent().catch(() => null))?.trim() ||
        (await card.locator('a[href*="/contrib/"]').first().textContent().catch(() => null))?.trim() ||
        "Google user";

      const ratingLabel =
        (await card
          .locator('span[role="img"][aria-label*="star" i], span.kvMYJc[aria-label*="star" i]')
          .first()
          .getAttribute("aria-label")
          .catch(() => null)) ||
        (await card.locator('span[aria-label*="star" i]').first().getAttribute("aria-label").catch(() => null));

      const dateText =
        (await card.locator(".rsqaWe").first().textContent().catch(() => null))?.trim() ||
        "";

      const text =
        (await card.locator(".wiI7pd").first().textContent().catch(() => null))?.trim() ||
        (await card.locator(".MyEned").first().textContent().catch(() => null))?.trim() ||
        "";

      reviews.push({
        id: reviewId,
        authorName: author,
        rating: parseRating(ratingLabel),
        dateText,
        comment: text,
      });
      seen.add(reviewId);
    }

    if (count === previousCount) sameCountRounds++;
    else sameCountRounds = 0;
    previousCount = count;

    await scrollerHandle.evaluate((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.scrollBy({ top: Math.max(900, el.clientHeight * 0.95), behavior: "auto" });
    });
    await page.waitForTimeout(1200);
  }

  await scrollerHandle.dispose();
  return reviews;
}

async function maybeImportPayload(importUrl, importSecret, payload) {
  if (!importUrl) return null;

  const headers = {
    "Content-Type": "application/json",
    "x-google-review-import-secret": String(importSecret || ""),
  };

  const res = await fetch(importUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sourceUrl: payload.sourceUrl,
      reviews: payload.reviews,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Import failed with status ${res.status}.`);
  }

  return res.json().catch(() => null);
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

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    await maybeAcceptConsent(page);
    await page.waitForTimeout(1500);
    await openReviewsPanel(page);
    await page.waitForTimeout(1500);

    const reviews = await scrapeReviews(page, maxReviews);
    const payload = {
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      total: reviews.length,
      reviews,
    };

    const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
    await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Saved ${reviews.length} reviews to: ${absoluteOutputPath}`);

    if (importUrl) {
      await maybeImportPayload(importUrl, importSecret, payload);
      console.log(`Imported reviews into: ${importUrl}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Failed to scrape Google Maps reviews.");
  console.error(err?.stack || err);
  process.exit(1);
});
