# CosmoShip — Project Guide

Developer-facing guide for building on this codebase. Read this before changing code.
For decisions, audit history, and open items see `docs/CODE_REVIEW_FINDINGS.md`; the
prioritized TODO of remaining work is `docs/ROADMAP.md`; the scripted QA suite is
documented in `docs/QA_TEST_PLAN.md` + `docs/QA_FINDINGS.md`.

---

## 1. What this is

**CosmoShip** is a community ship library for
[Cosmoteer: Starship Architect & Commander](https://store.steampowered.com/app/798090/),
a Steam ship-building strategy game. Players share **ship blueprints** — PNG images with the
ship's full binary data **hidden inside the image pixels** (steganography). CosmoShip lets users:

- Upload a blueprint PNG (the site decodes it, computes price/crew/tags, detects duplicates)
- Browse, search, and filter the community library
- Download blueprints or open them directly in Cosmoteer
- Build collections of ships and favorite ships
- Inspect decoded internals (JSON view, price analysis, stats) via a `/decode` tool

All posted ships are under **CC BY 4.0** unless the author states otherwise.

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 16** (App Router), `next` 16.2.11 — see the Next 16 docs note below |
| UI | React 19, TypeScript, **Tailwind CSS v4** (`@tailwindcss/postcss`), font `Space Grotesk` |
| DB | PostgreSQL via `pg`, hosted on **Supabase** (pooler port 6543), strict TLS (`rejectUnauthorized: true` + embedded Supabase CA) |
| Auth | **Discord OAuth** → signed **JWT** in a `httpOnly` `__session` cookie (HS256, 7d) |
| Uploads | **UploadThing** (`ufs.sh`); legacy hosts `i.ibb.co`, `res.cloudinary.com` still read |
| Bot protection | **Cloudflare Turnstile** on critical mutations (skipped in dev) |
| Deploy | **Vercel**, `output: "standalone"`; request middleware is `src/proxy.ts` |

> **Next 16 is NOT the Next.js from your training data** — APIs, conventions and file
> structure may differ. Read the relevant guide in `node_modules/next/dist/docs/` before
> writing code, and heed deprecation notices. Notably, `middleware.ts` is now `proxy.ts`.

## 3. How ship data works (the file format)

This is the core domain and the reason several "weird" code paths exist.

1. A Cosmoteer ship blueprint is a **PNG** whose RGB pixel **LSBs** (3 bits per pixel) encode
   the ship data.
2. Payload layout: 4-byte little-endian length, optional `COSMOSHIP` magic, then the
   data **gzip-compressed** (`zlib.gunzipSync`).
3. The decompressed bytes are a custom **binary tree serialization** ("OBNode"): node types
   `Data | ChildList | ChildMap | Link | Null`, with varints and length-prefixed strings.
   `processBinaryValue` maps known keys (`Parts`, `Doors`, `Color`, `Location`, …) to
   numbers/strings/bools/arrays. Unknown values are skipped.

There are **two decoders** that must stay in sync:

- **Browser**: `src/lib/cosmoShip.js` (914 lines, untyped JS) — used client-side by
  `UploadPanel`, `/decode`, and `useShipDecode`. Wraps floats as `{value}` and colors as
  `{parts}`.
- **Server**: `src/lib/server-decode.ts` (typed port) — used by `/api/ship/check-duplicate`
  and the UploadThing server route. Returns raw numbers/arrays.

Because the two wrappers differ, `src/lib/normalize-ship.ts` strips `{value}`/`{parts}`
wrappers so `JSON.stringify` produces **identical output on both sides** — this is what makes
duplicate detection reliable.

Derived values (all computed at upload, stored on the row):

- **Price / crew**: `src/lib/price.ts` + `part-data.ts` / `price-data.ts` (resource costs,
  crew quarters, missile types) + `tag-data.ts` (part → tag map).
- **Tags**: `extractTags` maps part IDs and missile toggle states to canonical tags.
- **Signature**: `src/lib/ship-signature.ts` = `sha256(JSON(normalizeForSignature(decoded)))`,
  stored in `ship_signatures` for duplicate detection.

The `shipdb.data` column stores the **hosted PNG URL** (UploadThing). The PNG itself is the
canonical blueprint — downloads return the image, replace = new upload + `data` swap.

## 4. Features & workflows

### Public browsing (`/`)
- Server-side initial search via `searchFromQueryString` (`src/lib/db/search.ts`), then a
  client `HomeContent` that keeps filters in the **URL** (shareable, back/forward safe).
- Filters: full-text `q`, tags on/off, author, min/max price, max crew, brand, sort
  (`new` default, `fav`, `pop`). 150ms debounce on filter changes (`useFilters`).
- Mobile-first: **bottom-sheet filter drawer**; desktop: collapsible sidebar.
- Ships render as cards in a responsive grid (`ShipCard`, `ShipGrid`).

### Ship detail (`/ship/[id]`)
- Renders the blueprint PNG, name, author, price, crew, tags, description, download/favorite
  counts, CC BY 4.0 notice.
- Toggles: **Stats** (`ShipStats`), **JSON** (`ShipJson`), **Price Analysis**
  (`ShipPriceAnalysis`), **Reconstruction** (pixel render of the ship).
- Actions depend on auth/ownership: anonymous → "Login to favorite" + Download only;
  owner → Edit/Replace/Delete (Replace + Delete are Turnstile-gated, delete needs an
  "armed" confirmation).

### Upload (`/upload`, auth required)
1. Pick a PNG → client decodes it immediately (`cosmoShip.js`) and shows a **decode panel**
   (author / price / crew / tags) before any upload.
2. Client computes the signature and calls `/api/ship/check-duplicate` → if a match exists,
   shows a warning; the user must acknowledge before uploading.
3. Submit → Turnstile token → UploadThing `pngUploader` route (`src/app/api/uploadthing/`)
   which re-decodes server-side, computes price/tags/signature, and inserts the `shipdb` +
   `ship_signatures` rows. The PNG URL is returned and stored in `data`.

### Edit / Replace / Delete (owner only)
- `PUT /api/ship/[id]` updates metadata + optionally swaps `data` (replace uses UploadThing
  with `x-ship-id`). `DELETE` removes the row, its signature, and the ship from every
  `collections.ships` and `favoritedb.favorite` array, then deletes the hosted file.
- Ownership is enforced server-side via `isShipOwner` (`discord_id` primary, username
  fallback) — **never trust the client**.

### Collections (`/collections`, `/my-collections`, `/collections/new`, `/collections/[id]`)
- Users create titled/described collections and add ships by id. Public listing page.
- Mutations (create/update/delete) are Turnstile-gated; add/remove-ship are authenticated
  but not Turnstile-gated (low-stakes, high-frequency).

### Favorites (`/favorites`)
- Per-user favorite array (`favoritedb`), toggle from any ship card/detail. Not
  Turnstile-gated (high-frequency, low-stakes).

### Decode tool (`/decode`)
- Public: drop any PNG and view the decoded ship JSON tree. Regression-tested against a
  known fixture (`scripts/qa-fixtures/`).

### Admin analytics (`/admin`, admins only)
- Dashboard reads `getDashboardData` (`src/lib/db/analytics.ts`) with date zoom, event-type
  breakdown, top pages, recent errors, and an **exclude filter** (owner + pinned QA anon id).
- Admins are configured via `ADMIN_USERNAMES` env (comma-separated, `username#disc` form).

### About pages
- `/about` (CosmoShip) and `/game` (Cosmoteer the game, external links).

## 5. Auth & security model

**Login flow** (`/auth/discord` → `/callback`):
1. `/auth/discord` redirects to Discord OAuth with a CSRF state cookie.
2. Discord redirects back to `/callback` with `code` + `state` → exchanges code, fetches
   profile, builds username as `username#discriminator`.
3. On every login `migrateUsernameOnLogin` runs: **adopts** legacy rows (no `discord_id`)
   matching any candidate name, and **refreshes** the username on rows already anchored to
   the Discord id (survives Discord renames).
4. Sets the JWT in `__session` (`httpOnly`, `secure`, `SameSite=Strict`, 7d). Cookie never
   goes in a URL or localStorage.

**Everywhere else**:
- `getUserFromRequest(req)` decodes the cookie JWT (`HS256` pinned) — the single source of
  truth for the current user.
- `requireAuth` / `requireAdmin` guards in `src/lib/auth.ts`; API routes return
  `{ error: "Unauthorized" }` 401 / `{ error: "Forbidden" }` 403.
- Ownership is dual-keyed (`discord_id` first, then username) in `src/lib/db/users.ts`.
- **Turnstile** is verified only on critical mutations (ship create/replace/update/delete,
  collection create/update/delete, admin dashboard) via shared `verifyTurnstileFromRequest`
  (`src/lib/turnstile.ts`); skipped in dev. Non-critical authenticated mutations rely on the
  `SameSite=Strict` cookie. UploadThing parses the `__session` cookie server-side itself.
- **Rate limiting** lives in `src/proxy.ts` (in-memory token buckets, `src/lib/rate-limit.ts`):
  `/callback` + `/auth/discord` 5/min, `/api/uploadthing` 10/min,
  `/api/ship/check-duplicate` 20/min, other `/api/*` 600/min → 429 + `X-RateLimit-*`.
- **CSP** with a per-request nonce (`strict-dynamic`) is set in `proxy.ts`; static security
  headers (`X-Frame-Options: DENY`, HSTS, nosniff, Referrer-Policy, Permissions-Policy) are
  in `next.config.ts`.
- **Decode hardening**: max PNG dimensions 4096×4096, bit-depth 8, non-interlaced only;
  signature check caps; `ship_signatures` deletes cascade through deleteShip.
- `src/lib/sanitize.ts` allows only safe URL protocols; `sanitizeText` is applied to all
  user-entered strings before storage.

## 6. Data model (PostgreSQL)

| Table | Key columns | Notes |
|-------|-------------|-------|
| `shipdb` | `id`, `name`, `ship_name`, `data` (PNG URL), `author`, `description`, `submitted_by`, `discord_id`, `price`, `brand`, `crew`, `tags text[]`, `downloads`, `fav`, `date` | One row per blueprint |
| `ship_signatures` | `ship_id`, `signature` | sha256 dedup index |
| `collections` | `id`, `owner`, `discord_id`, `title`, `description`, `ships int[]`, `created_at` | ships stored as array |
| `favoritedb` | `name`, `discord_id`, `favorite int[]` | one row per user |
| `analytics` | `id`, `event_type`, `user_id`, `username`, `guild`, `ship_id`, `url`, `metadata jsonb`, `anon_id`, `created_at` | fire-and-forget events |
| `_migrations` | `id`, `applied_at` | tracked by `npm run migrate` |

Indexes (idempotent, added during the auth migration): `shipdb(submitted_by)`,
`shipdb(discord_id)`, `collections(owner)`, `collections(discord_id)`,
`favoritedb(name)`, `favoritedb(discord_id)`.

**Schema changes** go in `scripts/migrations/` as `NNN-description.sql` and are applied with
`npm run migrate` (tracked in `_migrations`, idempotent). Runtime `ensureAnalyticsSchema`
(`src/lib/analytics-db.ts`) is a belt-and-suspenders fallback for the `anon_id` column only.

## 7. Project structure

```
src/
  app/                  # Next.js App Router
    (auth)/             # /auth/discord, /callback
    api/                # all JSON API routes (auth, ship, collections, price, analytics, uploadthing)
    admin/ decode/ game/ about/ upload/ collections/ ship/ favorites/
    my-ships/ my-collections/
    layout.tsx          # root layout: env validation import, Header/Footer, ErrorBoundary, AnalyticsTracker
    page.tsx            # / — server-side initial search
    proxy.ts            # (top-level) rate limiting + CSP + CORS
  components/
    layout/             # Header, Footer
    ui/                 # Button, Card, RichTextEditor, PreconnectForImage, TurnstileWidget
    search/             # SearchBar, TagFilter, AuthorFilter, PriceFilter, CrewFilter, SortFilter, FilterDrawer…
    ship/ collection/ tags/ upload/
    HomeContent.tsx     # client search + filter state owner
    AnalyticsTracker.tsx# page-view tracking
  hooks/                # useAuth, useAuthFetch, useFilters, useShipDecode, useDropdown
  lib/
    db.ts               # barrel → db/index
    db/                 # core, ships, collections, favorites, users, search, analytics
    auth.ts  env.ts  cache.ts  rate-limit.ts  turnstile.ts  proxy-utils
    price.ts  part-data.ts  price-data.ts  tag-data.ts  physics.ts
    cosmoShip.js  server-decode.ts  normalize-ship.ts  ship-signature.ts
    analytics-db.ts  analytics-client.ts
    upload-png.ts  image-host.ts  download-ship.ts  sanitize.ts  api.ts
scripts/                # dev/QA tooling + DB migrations (never shipped)
  qa-suite.ts  qa-lib.ts  qa-brave.sh  migrate.ts  migrations/
  backfill-*  import-builtin-ships  sync-game-data  price-test  qa-fixtures …
docs/                   # this guide, QA plan/findings, code-review findings, plans/
```

Legacy/unreferenced: `src/lib/db.old.ts` (693 lines, pre-modularization) — candidate for
deletion; `src/lib/types.ts` holds shared client/server shapes.

## 8. Conventions for building on this repo

- **Read `node_modules/next/dist/docs/` first** for any Next 16 API you touch.
- **API routes**: use the `src/lib/api.ts` envelope helpers (`ok`, `error`, `unauthorized`,
  `notFound`, `badRequest`, `forbidden`) — consistent `{ ok, data | error }` shape. Guard
  with `requireAuth`/`requireAdmin` from `src/lib/auth.ts`. Keep dynamic `import()` out of
  route handlers; static top-level imports only.
- **DB access**: import from `src/lib/db` (barrel). Never hand-build user SQL fragments —
  parameterize everything. Use `cachedQuery` for read-only hot paths (invalidate with
  `bumpDbVersion` after writes). Wrap multi-statement writes in `transaction`.
- **Client data fetching**: `useAuthFetch(url)` for authenticated reads; `useAuth` for the
  session; keep filters URL-driven with 150ms debounce. Abort in-flight fetches on unmount.
- **Env vars**: add to `envSchema` in `src/lib/env.ts` (with a validator) so startup
  validation covers them; document in `.env.example`.
- **Tailwind v4** — no `tailwind.config.js`; tokens live in `src/app/globals.css`
  (`--background`, `--foreground`, …). Use existing `ui/` components instead of new
  bespoke buttons/cards.
- **Turning on a new page**: add `metadata`, consider `loading.tsx`/`error.tsx`, wrap
  dynamic content in `<Suspense>`.
- **Security defaults**: anything accepting file/binary input must re-validate server-side
  (re-decode, size caps); don't trust client-computed values.

## 9. UI/UX design decisions

- **Theme**: dark "deep space" — background `#021526`, foreground `#BBE0FF`, cyan accent
  (`text-cyan-400`), theme color `#021526`. An animated gradient + alpha webp
  (`/background-alpha.webp`) gives the moving "aurora" backdrop (desktop uses the full image,
  mobile a lighter variant).
- **Type**: Space Grotesk (400–700). Headings are uppercase.
- **Layout**: max-width `1360px`, sticky header with nav (Ships / Collections / Upload) and a
  user menu (My Ships / My Favorites / My Collections / Analytics [admin] / About / Logout).
  Auth errors show a dismissible banner that auto-hides after 15s (don't shorten — the QA
  suite asserts it).
- **Cards over tables**: ship/collection grids use `Card` + `Button variant="primary"` for a
  consistent look.
- **Mobile-first**: filter drawer is a bottom sheet with focus trap + `role="dialog"`;
  desktop shows a collapsible sidebar. Ship grid is responsive (tested at 1280/768/375).
- **Progressive disclosure on detail pages**: Stats / JSON / Price Analysis / Reconstruction
  are toggles, not all-at-once (keeps heavy decode work lazy).
- **UX trade-offs chosen deliberately** (see CODE_REVIEW_FINDINGS for rationale): Turnstile
  only on critical actions (not on favorite/download/search); duplicate warnings gate uploads
  but allow "Upload Anyway"; delete requires arming a confirm state; download failures fail
  silently rather than opening raw JSON.
- **Analytics is privacy-lean**: page views are fire-and-forget `sendBeacon`; anonymous
  visitors get a salted hash (`anon_id`) of IP+UA, excludable from the dashboard.

## 10. Development workflow

**Dev server** — port **8000 is required** (Discord OAuth redirect). Launch detached:

```bash
cd /home/johnn/cosmo-next && (setsid npx next dev -p 8000 >> /tmp/next-server.log 2>&1 < /dev/null &) ; echo "launched"
```

Restart after `.env` edits (dev server only picks them up on restart):
`pkill -f 'next dev'` first — but **never** in the same command that starts the server
(self-match). Verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000` (expect
200; cold start ~10s). Logs: `tail -f /tmp/next-server.log`.

**Checks**: `npx tsc --noEmit` and `npm run lint`.

**QA suite** (`docs/QA_TEST_PLAN.md`): `node --env-file=.env --no-warnings scripts/qa-suite.ts`
(43 cases; session `qa` = persistent `.qa/brave-profile` admin `poney5850#0`, `anon` =
in-memory). Turnstile is stubbed in dev. UI/UX checks use the `playwright-cli` skill against
Brave with a persistent profile.

**DB**: creds from `.env` (`POSTGRES_HOST` = Supabase pooler `:6543`). Migrations:
`npm run migrate`.

## 11. Known limitations & deferred work

Full audit history and open items: `docs/CODE_REVIEW_FINDINGS.md`.

- **Rate-limit coverage gap**: the suite has no automated `P2-G11` (429) case yet.
- **`QA_TEST_PLAN.md` counts are stale** (e.g. "350" vs live ~1100 ships); the suite compares
  dynamically so it passes, but the doc lags.
- **Analytics legacy rows**: ~2,048 pre-`anon_id` rows have NULL `user_id`/`anon_id` and can't
  be excluded or attributed.
- **Deferred**: bad-IP blocklist (503 + Retry-After, Vercel cron) — plan at
  `docs/plans/bad-ip-blocklist-503.md`.
- **Open low-priority**: inconsistent error envelope (`R4-L18`), `db.old.ts` cleanup,
  several medium/low findings in the consolidated findings doc.
