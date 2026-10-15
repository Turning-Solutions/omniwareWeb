# VPS Migration Plan (Docker + caching layer)

Status: **PLAN ONLY. No Docker files have been created. Waiting for go-ahead.**
Decision: **Option A-lean** (one Next.js container with the embedded API, on a 2 GB VPS, image built in CI). Section 10 covers the later options (split backend, React SPA).
The caching layer (section 4) is already implemented in code (uncommitted) and works on Vercel today, with or without Redis.

Goal: move from Vercel (serverless) + MongoDB Atlas to one VPS running Docker, with MongoDB and Redis on the same box, and remove the shop's search/filter waiting time.

## 1. Facts about this project

- Customers: **Sri Lanka**. Catalogue: **~500 products**. Atlas cluster: **Singapore**.
- Live code is `client/server/src` (Express embedded in Next.js via `client/pages/api/[[...path]].ts`). The top-level `server/` folder is deleted in the working tree.
- 500 products is a small dataset. Raw query cost (regex scan, `$facet`) is small at this size, so the delay is almost certainly **network round trips and cold starts**, not the data volume.

## 2. Likely causes of the waiting time (hypotheses, confirm in Phase 0)

| Cause | Where | Effect |
|---|---|---|
| Vercel functions run in a different region than Atlas (Singapore). Vercel's default region is Washington DC. | Vercel project settings | ~200-250 ms per DB query, multiplied by the many sequential queries per shop request. Probably the biggest cause. |
| Many sequential queries per request (brand lookup, category lookup, category-tree walk, list, count, facets) | `productAggregation.ts`, `productController.ts` | Each one pays the round trip |
| Cold starts and per-instance caches | Vercel serverless | First hit on each instance is slow; caches are not shared |
| Heavy `$facet` / `$graphLookup` aggregation per filter click | `productController.ts` | CPU cost, minor at 500 products |
| Unanchored regex search on `title` | `productAggregation.ts` | Full scan, but only 500 docs, so minor |

How to confirm: the code already logs `[DB] Connected in region <VERCEL_REGION>`. Check the Vercel function region in project settings and time `/api/v1/products` on production (cold and warm).

## 3. Target architecture

```
Cloudflare (DNS, TLS, CDN for /_next/static and images)
      |
   Caddy (auto HTTPS, HTTP/3, compression)       one VPS, docker compose
      |
   web: Next.js standalone (long-lived Node process, warm DB pool, heap cap 384 MB)
      +-- mongo 7  (auth on, Docker network only, WiredTiger cache 0.25 GB)
      +-- redis 7  (shared cache, 48 MB cap, LRU eviction)
   host cron: daily mongodump (14-day retention) + off-site copy
```

Meilisearch is **dropped from the plan**: at 500 products it adds RAM and a sync path for no real gain. Revisit only if the catalogue grows past several thousand.

### Region (customers in Sri Lanka)
- Best: **Mumbai or Bangalore** (about 30-50 ms to Colombo). Providers: Vultr Mumbai, DigitalOcean Bangalore, AWS Lightsail Mumbai.
- Fine: **Singapore** (about 60-90 ms to Colombo). Same region as the current Atlas, which makes the data copy fast.
- Cloudflare in front serves static files and images from its Colombo/regional edge regardless of VPS location.
- Dedicated or consistent-CPU plan, NVMe disk.

## 4. Caching layer (implemented)

Files:
- `client/server/src/utils/cache.ts`: the cache itself.
- `client/server/src/utils/catalogCacheInvalidation.ts`: Mongoose plugin that invalidates on writes.
- Plugin applied in `models/Product.ts`, `Category.ts`, `Brand.ts`, `CategoryFeaturedSpecs.ts`.
- Wired into `controllers/productController.ts` (`getProducts`, `getProductFacets`) and `utils/productAggregation.ts` (brand and category slug-to-id lookups, including the category tree walk).
- New dependency: `ioredis`.

How it works:
- **Two tiers:** in-process LRU (L1, microseconds) and Redis (L2, shared) when `REDIS_URL` is set. Without Redis, L1 is the only cache and TTL is capped at 60 s.
- **Version-based invalidation:** every key embeds a catalog version. Any save/update/delete on products, categories, brands or featured specs bumps it, so all stale entries become unreachable at once. No key scanning. With Redis the version is shared across instances (re-read at most once per second).
- **Single-flight:** concurrent identical misses share one DB computation (prevents stampedes).
- **Fail-open:** if Redis is down or slow (250 ms command timeout), requests fall back to L1 and the database.
- **Never caches** errors (non-2xx), admin paths, or authenticated requests.
- Cache keys use the normalised query string, so `?a=1&b=2` and `?b=2&a=1` share an entry.
- TTLs: list and facets 5 min (with automatic invalidation on writes); slug lookups 10 min.
- The existing facet memory cache and `FacetSnapshot` layers are untouched. `invalidateFacetCaches()` now also bumps the version.

Environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `REDIS_URL` | unset | Enables Redis (L2). Example: `redis://:password@redis:6379` |
| `CACHE_ENABLED` | on | Set `false` to bypass all caching (debugging) |
| `CACHE_PREFIX` | `omni:` | Key prefix |
| `CACHE_L1_MAX_ENTRIES` | 500 | In-process LRU size |

Verified so far: TypeScript compiles (only 2 pre-existing errors in `e2e/shop.spec.ts`), and a unit-style script confirmed single-flight (1 computation for 3 concurrent callers), cache hit, invalidation after a bump, and errors not being cached.

**Not yet verified:** behaviour against a real MongoDB and Redis, the running shop pages, and the Playwright e2e suite. Run those before shipping.

Known gaps:
- `Model.bulkWrite` and raw `Product.collection.*` writes may not trigger the hooks. If any admin flow uses them, call `invalidateFacetCaches()` after.
- `getProductBySlug` (product detail) is not cached yet.
- On Vercel without Redis, each serverless instance has its own cache, so invalidation only reaches the instance that handled the write (hence the 60 s cap). Redis on the VPS fixes this.

## 5. RAM budget (2 GB VPS, Option A-lean)

All numbers are estimates until measured with `docker stats` on staging.

| Component | Typical | Limit set |
|---|---|---|
| MongoDB (WiredTiger cache 0.25 GB; 500 products is tiny) | 300-450 MB | 600 MB |
| Next.js + embedded Express (Node, heap capped 384 MB) | 300-500 MB | 700 MB |
| Redis (maxmemory 48 MB) | 30-50 MB | 80 MB |
| Caddy | 30-50 MB | 64 MB |
| OS + Docker daemon | 300-400 MB | n/a |
| **Total** | **~1.0-1.5 GB** | |

- Add 1 GB swap as a safety net.
- The image is **built in GitHub Actions and pulled by the VPS**, so the 1.5-2 GB that `next build` needs is never used on the server.
- Backups run from a host cron (`mongodump`), not an always-on container.
- If `docker stats` shows sustained pressure, upgrade to 4 GB with one click. Cost: about $10-12/month at 2 GB, $12-24 at 4 GB.
- CI build caveat: the build cannot reach the production database to prerender `/shop-all`. Those pages must render on first request (ISR) instead, with the cache covering repeat visits. Verify this before committing to the 2 GB size.

## 6. Phases

### Phase 0: Measure (about 0.5 day)
- Check the Vercel function region against Atlas Singapore.
- Time `/api/v1/products`, `/api/v1/products/facets`, `/shop` (cold and warm, p50/p95) from a Sri Lankan connection.
- `explain("executionStats")` on a search query for completeness.
- Record numbers for before/after comparison.

### Phase 1: Quick win on the current setup (optional, minutes)
- If Vercel is not in Singapore, set the function region to `sin1` (Vercel project settings). This may remove most of the delay before any migration.
- Add a Redis instance (for example Upstash, Singapore) and set `REDIS_URL` on Vercel to share the cache across instances.

### Phase 2: Containerise (about 1-2 days)
1. `output: "standalone"` in `next.config.ts`, enabled by an env flag so Vercel builds are unaffected.
2. Multi-stage `Dockerfile` (non-root user, `HEALTHCHECK`) and a `/api/health` route that pings Mongo.
3. `docker-compose.yml`: `web`, `mongo` (auth on), `redis`, `caddy`; memory limits per section 5; Mongo reachable only on the Docker network. Backups via host cron.
4. Mongo pool settings for a long-lived server (`maxPoolSize` about 20, `minPoolSize` about 3) in `config/db.ts`.
5. Build in GitHub Actions and push to GHCR; the VPS only pulls. The build has no database, so make `/shop-all` and `/shop-all/[categorySlug]` render on first request (ISR, `dynamicParams`) instead of prerendering at build time. The Redis/in-process cache keeps repeat hits fast.
6. The Chromium-based Google reviews refresh currently only works on Vercel (non-Vercel branch needs full `playwright`). Decide before cutover: keep it on a scheduled job elsewhere, or add Chromium to the image.
7. `deploy.sh`: `docker compose pull`, `up -d`, health check, **warm-up script**, prune old images.
8. Keep Next's `.next/cache` on a Docker volume so rendered pages survive restarts and deploys.

#### Post-deploy warm-up script (planned, not created)
Purpose: after each deploy, request every public page once so no visitor pays the first-render cost (ISR pages, catalog response cache).
- Location: `client/scripts/warmup.mjs`, run as `npm run warmup` from `deploy.sh` after the health check passes.
- URL list is built from the live `/sitemap.xml` (static pages, categories, products), re-rooted onto the target host, plus:
  - core pages: `/`, `/shop`, `/shop-all`, `/cart`, `/compare`
  - the `/shop-all/<slug>` ISR twin of every `/shop/<slug>` category
  - the shop's first-paint API calls (`/api/v1/products?limit=20&page=1`, `/api/v1/products/facets?mode=lite`, and the same per category)
- Behaviour: waits up to 90 s for the server to come up, 4 parallel requests (low, for a 2 GB box), 30 s per-request timeout, one retry, drains each response body.
- Reports ok/failed counts, median and slowest time; lists failing URLs.
- Exit code 1 if the server never starts or more than 10% of URLs fail, so a bad deploy is visible.
- Options: `--base`, `--concurrency`, `--wait`, `--timeout`, `--max-fail`.
- Expected run time for about 500 products: under a minute.
- Already prototyped and checked against a mock server (sitemap parsing, `/shop-all` twin, query strings kept, failure and server-down exit codes), then removed at your request. It can be recreated from this spec.

### Phase 3: Data and cutover
1. Stand up a staging VPS and restore a copy of Atlas using the existing `npm run db:backup` / `db:restore` scripts.
2. Run the Playwright e2e suite against staging.
3. Lower DNS TTL to 60 s a day before.
4. Short freeze on admin writes, final backup from Atlas, restore, switch DNS.
5. Keep Vercel and Atlas live for about a week as rollback (roll back by pointing DNS back).

### Phase 4: Hardening
- Cloudflare: cache `/_next/static/*` for a year; cache public API GETs 30-60 s with `stale-while-revalidate`.
- UFW with only 80/443 open, SSH keys only, fail2ban, unattended security updates, rotated secrets.
- Nightly `mongodump` copied off-site (Backblaze B2 or Cloudflare R2), weekly restore test.
- Uptime monitoring on `/api/health`.

## 7. Expected result (targets, not measured)

- Warm `/shop` TTFB about 100-250 ms; filter and search API calls about 5-50 ms on cache hits and about 20-80 ms on misses (local DB).
- No cold starts.
- Most of the gain comes from removing the Vercel-to-Singapore round trips, plus the cache.

## 8. Risks

- Single VPS is a single point of failure. Mitigation: off-site backups and snapshots; later a second node.
- We own database upgrades, backups and security.
- Version-based invalidation relies on Mongoose hooks. Any direct driver write skips it (see known gaps).

## 9. Start checklist

- [x] Answer open questions (Sri Lanka, 500 products, Atlas Singapore)
- [x] Caching layer implemented and unit-checked
- [ ] Commit the caching layer, after e2e and a real Mongo/Redis check
- [ ] Phase 0 measurements recorded
- [ ] Decide Chromium reviews-refresh approach
- [x] Option A-lean chosen (2 GB VPS, CI-built image)
- [ ] Verify `/shop-all` renders on first request without a build-time DB
- [ ] Create the warm-up script and `.next/cache` volume (specified in Phase 2)
- [ ] Pick provider and region (Mumbai/Bangalore vs Singapore)
- [ ] Provision and harden the VPS
- [ ] Staging restore and e2e
- [ ] Choose cutover date

## 10. Later options (not planned now)

Codebase size, measured: 34 pages (18 public, 16 admin), about 24,000 lines of frontend code, about 11,000 lines of server code. Estimates below assume one developer working full time.

### Option B: separate backend container (Next.js + standalone Express API)
- **Work:** about 3-5 days.
  - Add a standalone API entry point and its own image.
  - Replace the in-process `shopProductsDirect` / `shopFacetsDirect` / home data loaders with HTTP calls to the API, or move shared code into a package.
  - Route `/api/*` to the API container in Caddy; split secrets, CORS and cookies.
  - Two images to build and deploy.
- **Risk:** low to medium. Mistakes show up as broken SSR data or auth cookies, and the e2e suite would catch most of them.
- **Improvement:** no RAM saving (about +100-150 MB for a second Node process) and no speed gain (one extra local hop, about 1 ms). The only benefits are independent restarts and independent scaling, which you don't need at this size.
- **Verdict:** only worth it if the API needs to scale or deploy separately from the site.

### Option C: React SPA (for example Vite + React Router) + separate API
- **Work:** about 3-4 weeks.

| Piece | Estimate |
|---|---|
| Extract the API into its own server (as in B) | 3-5 days |
| Rebuild 18 public pages as SPA routes (replace server components, `generateMetadata`, `next/image`, `next/link`, routing, ISR) | 8-10 days |
| Admin (16 pages, mostly client-side already) | 3-4 days |
| SEO workaround: prerender or a prerender service for shop, category and product pages, sitemap, robots, redirects | 4-6 days |
| Testing and the e2e suite rewrite, cutover | 4-5 days |

- **Risk:** high.
  - **SEO and rankings:** the shop depends on Google. A client-rendered site is indexed slower and less reliably, and you could lose ranking you rebuilt after the WordPress migration.
  - **WhatsApp and Facebook link previews:** their crawlers do not run JavaScript, so shared product links would lose their title and image unless every product page is prerendered.
  - **First load gets slower:** HTML, then JavaScript, then an API call, instead of ready HTML. Worse on mobile connections.
  - Regression risk across about 24,000 lines of UI.
- **Improvement:**
  - RAM down about 0.5-0.8 GB (total about 0.8-1.2 GB), which saves roughly $5-8/month or lets you use a 1 GB VPS.
  - The static files are served by Caddy or Cloudflare, so there is no frontend process to run.
  - No meaningful speed gain: after the first load the app is already client-side React Query, and the first load gets slower.
- **Verdict:** not recommended. About a month of work and real SEO risk to save a few dollars a month. Reconsider only if you must run on a 1 GB server.
