export const DEFAULT_SOURCE_URL =
  "https://www.google.com/maps/place/Omniware+Technologies/@6.8499418,79.8840428,17z/data=!4m8!3m7!1s0x3ae25bc001c21cfb:0x706552a0c455e4a3!8m2!3d6.8499365!4d79.8866177!9m1!1b1!16s%2Fg%2F11srgk22h7?entry=ttu&g_ep=EgoyMDI2MDQwNy4wIKXMDSoASAFQAw%3D%3D";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36";

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

async function collectReviews(page, maxReviews) {
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

      const dateText = (await card.locator(".rsqaWe").first().textContent().catch(() => null))?.trim() || "";

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

export async function scrapeGoogleMapsReviews({
  launchBrowser,
  sourceUrl = DEFAULT_SOURCE_URL,
  maxReviews = 120,
}) {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    locale: "en-US",
    userAgent: DEFAULT_USER_AGENT,
  });
  const page = await context.newPage();

  try {
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    await maybeAcceptConsent(page);
    await page.waitForTimeout(1500);
    await openReviewsPanel(page);
    await page.waitForTimeout(1500);

    const reviews = await collectReviews(page, maxReviews);
    return {
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      total: reviews.length,
      reviews,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function importGoogleReviewPayload(importUrl, importSecret, payload) {
  if (!importUrl) return null;

  const res = await fetch(importUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-google-review-import-secret": String(importSecret || ""),
    },
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
