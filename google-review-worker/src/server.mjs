import express from "express";
import {
  DEFAULT_SOURCE_URL,
  importGoogleReviewPayload,
  scrapeGoogleMapsReviews,
} from "./scrapeGoogleMapsReviews.mjs";

const app = express();
const port = Number(process.env.PORT || 4001);
const host = "0.0.0.0";
const refreshSecret = String(process.env.GOOGLE_REVIEWS_REFRESH_WEBHOOK_SECRET || "").trim();
const defaultMaxReviews = Number.isFinite(Number(process.env.GOOGLE_REVIEWS_MAX_REVIEWS))
  ? Math.max(1, Math.min(500, Number(process.env.GOOGLE_REVIEWS_MAX_REVIEWS)))
  : 120;

let activeJob = null;
let lastJob = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  error: "",
  total: 0,
};

app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "google-review-worker",
  });
});

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    active: Boolean(activeJob),
    lastJob,
  });
});

app.post("/google-reviews-refresh", async (req, res) => {
  const providedSecret = String(req.headers["x-google-review-refresh-secret"] || "").trim();
  if (refreshSecret && providedSecret !== refreshSecret) {
    res.status(401).json({ message: "Invalid refresh secret." });
    return;
  }

  if (activeJob) {
    res.status(409).json({ message: "A refresh job is already running." });
    return;
  }

  const body = req.body || {};
  const sourceUrl = String(body.sourceUrl || DEFAULT_SOURCE_URL).trim();
  const importUrl = String(body.importUrl || "").trim();
  const importSecret = String(body.importSecret || "").trim();
  const maxReviews = Number.isFinite(Number(body.maxReviews))
    ? Math.max(1, Math.min(500, Number(body.maxReviews)))
    : defaultMaxReviews;

  if (!importUrl) {
    res.status(400).json({ message: "importUrl is required." });
    return;
  }
  if (!importSecret) {
    res.status(400).json({ message: "importSecret is required." });
    return;
  }

  const startedAt = new Date().toISOString();
  lastJob = {
    status: "running",
    startedAt,
    finishedAt: null,
    error: "",
    total: 0,
  };

  activeJob = (async () => {
    try {
      const payload = await scrapeGoogleMapsReviews({
        sourceUrl,
        maxReviews,
        headless: true,
      });
      await importGoogleReviewPayload(importUrl, importSecret, payload);
      lastJob = {
        status: "success",
        startedAt,
        finishedAt: new Date().toISOString(),
        error: "",
        total: payload.total,
      };
    } catch (error) {
      lastJob = {
        status: "error",
        startedAt,
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Refresh failed.",
        total: 0,
      };
      console.error("[google-review-worker] refresh failed", error);
    } finally {
      activeJob = null;
    }
  })();

  res.status(202).json({
    ok: true,
    queued: true,
    sourceUrl,
    maxReviews,
  });
});

const server = app.listen(port, host, () => {
  console.log(`[google-review-worker] listening on ${host}:${port}`);
});

server.on("error", (error) => {
  console.error("[google-review-worker] server error", error);
});

process.on("unhandledRejection", (error) => {
  console.error("[google-review-worker] unhandled rejection", error);
});

process.on("uncaughtException", (error) => {
  console.error("[google-review-worker] uncaught exception", error);
});
