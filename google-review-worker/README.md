# Google Review Worker

This service is the hosted browser worker for Google Maps review refreshes.

Use it when:
- the main app is hosted on Vercel
- the admin panel should trigger review refreshes
- Google Maps scraping should run outside Vercel

## What it does

1. Receives a refresh request from the main app at `POST /google-reviews-refresh`
2. Scrapes the Omniware Google Maps reviews page with Playwright
3. Sends normalized reviews back to the main app import endpoint

## Endpoints

- `GET /healthz`
- `POST /google-reviews-refresh`

## Environment variables

- `PORT`
- `GOOGLE_REVIEWS_REFRESH_WEBHOOK_SECRET`
- `GOOGLE_REVIEWS_MAX_REVIEWS` optional

## Railway deployment

Deploy this folder as a separate Railway service.

Recommended:
- use the `Dockerfile` in this folder
- expose port `4001`

## Vercel app environment

The main app should point to this worker:

- `GOOGLE_REVIEWS_REFRESH_WEBHOOK_URL=https://your-worker.up.railway.app/google-reviews-refresh`
- `GOOGLE_REVIEWS_REFRESH_WEBHOOK_SECRET=your-shared-secret`
- `GOOGLE_REVIEWS_IMPORT_SECRET=your-import-secret`
- `GOOGLE_REVIEWS_SOURCE_URL=<your-google-maps-url>`
- `GOOGLE_REVIEWS_MAX_REVIEWS=120`

## Request format

The main app sends JSON like:

```json
{
  "sourceUrl": "https://www.google.com/maps/place/...",
  "importUrl": "https://your-app.vercel.app/api/v1/admin/google-reviews/import",
  "importSecret": "your-import-secret",
  "maxReviews": 120
}
```
