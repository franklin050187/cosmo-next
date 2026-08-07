# Code Review Findings — cosmo-next (Merged)

Merged single findings document consolidating all audit rounds.

## Audit History

| Round | Date | Scope | Status |
|-------|------|-------|--------|
| Round 1 | 2026-07-26 | Initial audit (base of earlier rounds) | Merged into Round 2/3 |
| Round 2 | 2026-07-29 | Pattern simplification review | Merged into Round 3 |
| Round 3 | 2026-07-29 | Full production readiness audit | See [§1](#1-round-3--production-readiness-audit-2026-07-29) |
| Round 4 | 2026-07-31 | Comprehensive codebase audit + auth migration | See [§2](#2-round-4--july-2026-audit-updated-31-jul-2026) |
| Pre-Production | 2026-08-01 | Code structure, usage, security, simplification report | See [§3](#3-pre-production-code-review-report-2026-08-01) |
| Round 5 | 2026-08-07 | Analytics improvements (exclude filter, anon identity, hardening) | See [§4](#4-round-5--analytics-improvements-2026-08-07) |

## Status Legend

| Mark | Meaning |
|------|---------|
| ✅ FIXED | Addressed |
| 🔴 OPEN | Still present |
| 🟠 MEDIUM | Medium priority / partially addressed |

---

# 1. Round 3 — Production Readiness Audit (2026-07-29)

Scope: Full production readiness audit.

## CRITICAL

### ✅ C1. SQL injection via `ORDER BY ${order}` (FIXED)
`src/lib/db.ts:424` — ORDER BY used string interpolation. LIMIT and OFFSET also interpolated.

**Fix:** Migrated LIMIT and OFFSET to parameterized queries (`$N` placeholders appended to `args`). ORDER BY constrained to 3 hardcoded values via ternary — no user string reaches it, but now LIMIT/OFFSET are also parameterized.

### ✅ C2. No `pool.on('error')` handler (FIXED)
`src/lib/db.ts:7-20` — PostgreSQL Pool has no error handler, crashing the process on idle connection termination.

**Fix:** Added `pool.on("error", (err) => { console.error(...) })` in `getPool()`.

### ✅ C3. Unhandled promise rejections in 12 API routes (FIXED)
Routes: `ship/tags`, `ship/search`, `ship/my-ships`, `ship/favorites`, `ship/authors`, `ship/[id]` (GET + DELETE), `ship/[id]/favorite`, `ship/[id]/unfavorite`, `ship/[id]/download`, `collections` (GET + POST), `collections/mine`, `collections/[id]` (GET + PUT + DELETE), `collections/[id]/ships`, `collections/[id]/ships/[shipId]`.

**Fix:** Added try/catch to every handler. All return `{ error: "internal" }` with status 500 on failure.

### ✅ C4. No per-page metadata (SEO)
`src/app/layout.tsx` — Only layout has metadata. Pages like `/upload`, `/collections`, `/ship/[id]` have no `generateMetadata`.

**Fix:** Added `export const metadata` to `page.tsx` (home), `about/page.tsx`, and `upload/page.tsx`. Client-side pages already set `document.title` after data load.

---

## HIGH

### ✅ H1. JWT `verify()` without algorithm restriction (FIXED)
`src/lib/auth.ts:46` — `jwt.verify(token, secret)` without `{ algorithms: ['HS256'] }` opens theoretical algorithm-confusion vector.

**Fix:** Changed to `jwt.verify(token, secret, { algorithms: ['HS256'] })`.

### ✅ H2. XSS — `javascript:` protocol bypasses sanitizer (FIXED)
`src/lib/sanitize.ts` — Allowed `<a href="javascript:alert(1)">` through unchanged.

### ✅ H3. XSS — Single-quoted and unquoted attributes bypass sanitizer (FIXED)
`src/lib/sanitize.ts` — Regex only matched `key="val"`, so `key='val'` and `key=val` were silently dropped.

**Fix (H2+H3):** Added `isSafeUrl()` which only allows `http:`, `https:`, `mailto:`, `/`, and `#` protocols. Updated regex to match double-quoted, single-quoted, and unquoted attributes.

### ✅ H4. Duplicate data files `part-data.ts` / `price-data.ts` (FIXED)
Both files define identical `partsResources` / `resourceCost` arrays (150 lines duplicated).

**Fix:** Merged into `part-data.ts` as single source of truth. `price-data.ts` re-exports from `part-data.ts`.

### ✅ H5. Missing security headers in `next.config.ts` (FIXED)
No `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

**Fix:** Added `headers()` export with all four headers. Also added `res.cloudinary.com` to image `remotePatterns`.

### ✅ H6. `ShipPriceAnalysis` — `analysis` not memoized (FIXED)
`src/components/ship/ShipPriceAnalysis.tsx:100` — Object created every render causing canvas redraw on every parent re-render.

**Fix:** Wrapped in `useMemo(() => priceAnalysis(decoded), [decoded])`.

### ✅ H7. Hydration mismatch — `sessionStorage` in `useState` initializer (FIXED)
`src/app/ship/[id]/page.tsx:53-56` — `sessionStorage.read()` in `useState()` returns different value on server vs client.

**Fix:** Replaced with `useState("/")` + `useEffect` to read `sessionStorage` client-side only.

### ✅ H8. `router.push()` called during render (FIXED)
`src/app/ship/[id]/edit/page.tsx:107-111` — Side effect in render path.

**Fix:** Moved to `useEffect` watching `notOwner` state.

### ✅ H9. Reverse dependency `lib/` → `hooks/` (FIXED)
`src/lib/price-analysis.ts:2` — Imported `DecodedShip` type from `@/hooks/useShipDecode`.

**Fix:** Defined `DecodedShip` type inline in `price-analysis.ts` instead of importing from hooks.

### ✅ H10. PostgreSQL env vars missing existence checks (FIXED)
`src/lib/db.ts:10-14` — If `POSTGRES_HOST`/`DATABASE`/`USER`/`PASSWORD` are unset, pg silently connects to wrong database.

**Fix:** Added validation that all 4 env vars are present before creating Pool. Throws descriptive error if any missing.

### ✅ H11. No error boundaries anywhere (FIXED)
Entire app unprotected — single render error takes down React tree.

**Fix:** Created `src/components/ErrorBoundary.tsx` (class component with retry button). Wrapped both the outer layout and the `<main>` content in the root layout.

### ✅ H12. `cosmoShip.js` — `readBytes` doesn't validate declared length against buffer
`src/lib/cosmoShip.js:715` — Corrupted image declaring length > buffer returns truncated data silently.

**Fix:** Validate `length <= out.length - 4` before slicing; throw on mismatch.

### ✅ H13. `cosmoShip.js` — `writeBytes`/`setByte` no bounds check
`src/lib/cosmoShip.js:718-738` — Writing past pixel capacity corrupts Uint8ClampedArray.

**Fix:** Added offset/capacity bounds check based on `width * height * 3 / 8`.

### ✅ H14. `download-ship.ts` — Error fallback opens raw API in new tab
`src/lib/download-ship.ts:20-27` — On failure, opens `/api/ship/${shipId}` showing raw JSON.

**Fix:** Replaced `window.open` fallback with `console.error` + silent failure.

### ✅ H15. `ship-signature-client.ts` — `crypto.subtle.digest` requires secure context
`src/lib/ship-signature-client.ts:5` — On HTTP, `crypto.subtle` is `undefined`, throws.

**Fix:** Added `if (!crypto?.subtle?.digest)` guard with descriptive error.

### ✅ H16. No `AbortController` on search fetches — race conditions
`src/components/HomeContent.tsx` — Rapid filter changes fire multiple overlapping fetches.

**Fix:** Created `AbortController` per fetch in `useEffect`; abort on cleanup. `fetchShips` accepts `AbortSignal`.

### ✅ H17. No debounce on search/URL updates
`src/hooks/useFilters.ts` + `SearchBar.tsx` — Every keystroke triggers `router.push` + full re-render.

**Fix:** Added 150ms debounce via `clearTimeout`/`setTimeout` in `setFilter` before `router.push`.

### ✅ H18. `SearchBar` local state not synced with `query` prop
`src/components/search/SearchBar.tsx` — `input` state initialized from `query` but never synced back when query is cleared externally.

**Fix:** Added `useEffect(() => setInput(query), [query])` to sync on prop change.

---

## MEDIUM

### ✅ M17. `addToCollection` success message says "Added!" even on warnings
`src/components/collection/CollectionPicker.tsx` — Shows "Added!" when API returns `{ warning: "already in collection" }`.

**Fix:** Already handled — line 94 reads `data.warning ?? data.error ?? "Added!"`, correctly showing the warning message.

### 🟠 M1. TagFilter radio and checkbox logic identical
`src/components/tags/UserTagEditor.tsx:31-41` — Radio mode doesn't enforce exclusive selection.
_(Note: superseded/fixed in Round 4, H9.)_

### 🟠 M2. Collections API inconsistent response shapes
`src/app/api/collections/route.ts — `GET /api/collections?shipId=X` returns `{data: [...]}`, paginated path returns `{data, page, max_page, total_count}`.

### 🟠 M3. `price.ts` — Module-level side effect on import
`src/lib/price.ts:18-26` — `partCostCache` eagerly populated on import. `MISSILE_MAPPING` duplicates `missileTagMap` from `tag-data.ts`.

### 🟠 M4. `analytics-db.ts` — Five sequential queries, no error isolation
`src/lib/analytics-db.ts:47-103` — Sequential queries could be parallelized. Single failure zeroes all data.

### 🟠 M5. Module-level caches never evicted
`src/hooks/useShipDecode.ts`, `ShipStats.tsx`, `ShipReconstruction.tsx` — Unbounded caches grow memory under sustained browsing.

### 🟠 M6. `TurnstileWidget` — No visual feedback on script load failure
`src/components/TurnstileWidget.tsx` — Empty `<div>` when Cloudflare is blocked; `getToken()` returns `undefined` silently.

### 🟠 M7. `analytics-client.ts` — Silent exception swallow
`src/lib/analytics-client.ts` — Bare `try {} catch {}` with zero observability.

### 🟠 M8. `normalize-ship.ts` — No circular reference protection
`src/lib/normalize-ship.ts` — Recursive traversal throws `Maximum call stack size exceeded` on cycles.

### 🟠 M9. `cosmoShip.js` — No decompressed size limit (zip-bomb vector)
No max output size on `DecompressionStream('deflate')` / `zlib.gunzipSync`. Crafted PNG triggers OOM.

### 🟠 M10. `cosmoShip.js` — `readString` length prefix allocates without limit
`readString()` allocates `Uint8Array(len)` from varint. Large declared length causes massive allocation.

### 🟠 M11. `cosmoShip.js` — `SKIP` drops keys silently
When `processBinaryValue` returns `SKIP`, key-value pair silently removed from decoded object.

### 🟠 M12. No rate limiting on any endpoint
Unauthenticated endpoints (`/api/auth/token`, download counter, search) are susceptible to abuse.
_(Reconfirmed in Round 4 H7 and Pre-Production report — still OPEN.)_

### 🟠 M13. `ssl: { rejectUnauthorized: false }`
`src/lib/db.ts` — Disables PostgreSQL certificate validation. MITM on DB connection possible.
_(Fixed in Round 4 H6.)_

### 🟠 M14. `AnalyticsTracker` outside `<Suspense>`
`src/app/layout.tsx` — Renders outside Suspense, may cause full layout to be client-rendered.

### 🟠 M15. Missing Open Graph / Twitter metadata
`src/app/layout.tsx` — Only `title` and `description`. No `openGraph`, `twitter`, `metadataBase`.

### 🟠 M16. `pageshow` bfcache refresh only on collections page
Other list pages don't re-fetch on browser back-navigation.

### 🟠 M18. `ShipStatsPanel` lacks `"use client"` but rendered via `dynamic(..., {ssr: false})`
`src/components/ship/ShipStatsPanel.tsx` — Works but inconsistent.

### 🟠 M19. `Footer` logo missing width/height attributes
`src/components/layout/Footer.tsx` — `<img>` without explicit dimensions causes CLS.

### 🟠 M20. `CollectionPicker` `setTimeout` no cleanup
`src/components/collection/CollectionPicker.tsx:96` — Timer may fire after unmount.

### 🟠 M21. `TurnstileWidget` — `readyState` check on `<script>` element
`src/components/TurnstileWidget.tsx:61-67` — Non-standard property, dead code in modern browsers.

### 🟠 M22. Inconsistent import pattern in API routes
5 collection routes use `await import("@/lib/db")` (dynamic) while ship routes use static imports.
_(✅ FIXED — all dynamic `@/lib/db` imports converted to top-level static imports.)_

### 🟠 M23. Missing CSRF/Turnstile on mutation endpoints (consolidated from M23+M27)
Currently only 3 of 14 mutation endpoints have Turnstile: `POST /api/collections`, `PUT /api/collections/[id]`, `POST /api/uploadthing`.

**Need Turnstile (5 critical endpoints):**
`DELETE /api/collections/[id]`, `PUT /api/ship/[id]`, `DELETE /api/ship/[id]`, `POST /api/uploadthing` (upload + replace), plus `POST /api/collections` and `PUT /api/collections/[id]` and the admin dashboard.

**Intentionally excluded (no Turnstile needed):**
- `POST /api/ship/[id]/favorite`, `POST /api/ship/[id]/unfavorite` — high-frequency, authenticated, low-stakes; removed Aug 6 (was breaking the UI and triggering a widget render on every ship card)
- `POST /api/collections/[id]/ships`, `DELETE /api/collections/[id]/ships/[shipId]` — add/remove ship from own collection; non-critical
- `POST /api/analytics/log` — fire-and-forget, `sendBeacon`, no interactive form
- `POST /api/ship/check-duplicate` — read-only, no DB write
- `POST /api/price` — read-only calculation
- `POST /api/ship/[id]/download` — no interactive form, would require widget on every button click

**✅ FIXED (Aug 6, refined):** Critical mutations verify Turnstile via shared `verifyTurnstileFromRequest` (`src/lib/turnstile.ts`). Skips verification in development. Turnstile is restricted to critical actions: ship create/replace/update/delete, collection create/update/delete, and the admin dashboard. Widgets are mounted on the action forms (UploadPanel, edit pages, new-collection page, admin) and **lazily** on ship/collection detail pages only when Delete is armed — no longer on every ship card or page view. `SameSite=Strict` cookie remains the primary CSRF defense for the non-critical authenticated mutations.

### 🟠 M24. Systemic missing `AbortController` on fetches
Every `useEffect`-based `fetch()` lacks abort — CollectionPicker, ShipStats, TagFilter, AuthorFilter, admin/page, my-ships/page, favorites/page, my-collections/page, collections/page, collections/[id]/page, collections/[id]/edit/page, ship/[id]/page, ship/[id]/edit/page.

**Partial fix (H16):** `HomeContent.tsx` search fetch now uses AbortController. Remaining 12+ locations still use `active` flag without abort.

### 🟠 M25. `typeof window` in render path on ship/[id]/page.tsx:289
`href` differs between server (`"/"`) and client (actual path) causing hydration mismatch.

**Partial fix:** Added `suppressHydrationWarning` — should move to `useEffect` for clean fix.

### 🟠 M26. `RichTextEditor` uses deprecated `document.execCommand()`
`src/components/ui/RichTextEditor.tsx:22` — `execCommand` is deprecated and may be removed by browsers.

### ✅ M27. (merged into M23)
This finding duplicated M23. Content consolidated into M23 entry above.

---

## LOW — Polish / Nice-to-Have

| # | File | Issue |
|---|------|-------|
| L3 | `Dockerfile` | ✅ FIXED — user is created before COPY, `--chown` used on subsequent copies |
| L12 | `src/lib/upload-png.ts` | ✅ FIXED — UploadThing usage is clean, no token leakage |
| L19 | `src/lib/db.ts:55-64` | ✅ FIXED — `transaction()` has proper `catch`/`finally` with `ROLLBACK` and `client.release()` |
| L1 | `src/app/layout.tsx` | No `canonical` URL in metadata |
| L2 | `package.json` | Add `"engines": { "node": ">=20.0.0" }` and `.nvmrc` |
| L4 | `src/lib/db.ts:389` | `searchFromQueryString` fragile manual URL parsing |
| L5 | `src/app/ship/[id]/page.tsx` | Blank render when `error` and `ship` both null |
| L6 | DB | Missing indexes on `collections.owner`, `shipdb.submitted_by`, `favoritedb.name` |
| L7 | `src/components/upload/UploadPanel.tsx:52-54` | `FileReader` not aborted on re-selection |
| L8 | `src/lib/cosmoShip.js` | 914 lines of untyped JS — migrate to TS |
| L9 | `package.json` | Missing `@next/bundle-analyzer` and `sharp` |
| L10 | `tsconfig.json` | Target `"ES2017"` outdated — use `"ES2022"` |
| L11 | `next.config.ts` | Missing `experimental.turbopackTreeShaking: true` |
| L13 | `src/app/ship/[id]/page.tsx` | `isLoggedIn` checked once on mount — no cross-tab sync |
| L14 | Multiple files | Unnecessary `await import("@/lib/db")` — use static imports | ✅ FIXED |
| L15 | `src/lib/analytics-db.ts:12` | `INSERT` uses `fetchAll()` instead of `query()` |
| L16 | `src/lib/db.ts:89-91` | `getImageData` runs `SELECT *` when `SELECT 1` suffices |
| L17 | `src/lib/price.ts:23` | `Number(qty)` without `isNaN` guard |
| L18 | Multiple files | Accessibility: missing `aria-label`, `role`, keyboard handlers |
| L20 | `src/lib/turnstile.ts` | No timeout on `fetch()` to Cloudflare |

---

## Round 3 — Summary by Priority

| Priority | Count | Key items |
|----------|-------|-----------|
| CRITICAL | 0 | — all fixed |
| HIGH     | 0 | — all fixed |
| MEDIUM   | 25 | TagFilter, API shapes, caches, Turnstile fallback, analytics, normalization, cosmoShip limits, rate limiting, SSL, Suspense, OG metadata, bfcache, CSRF (M23+M27 merged), AbortController, hydration, RichTextEditor |
| LOW      | 17 | Canonical, engines, URL parsing, empty state, indexes, FileReader, TS migration, bundle tools, tsconfig, turbopack, cross-tab sync, dynamic imports, query patterns, NaN guards, a11y, fetch timeout |

## Fixes Applied in Round 3

| ID | Change |
|----|--------|
| C1 | Parameterized LIMIT/OFFSET in `db.ts` |
| C2 | Added `pool.on('error')` handler in `db.ts` |
| C3 | Added try/catch to 12 API route files |
| C4 | Added `metadata` exports to home, about, upload pages; client pages already set `document.title` |
| H1 | Added `{ algorithms: ['HS256'] }` to `jwt.verify()` |
| H2+H3 | Blocked `javascript:` URLs, added single-quote/unquoted attr matching in `sanitize.ts` |
| H4 | Merged `price-data.ts` → `part-data.ts` (deleted duplicate) |
| H5 | Added security headers + `res.cloudinary.com` to `next.config.ts` |
| H6 | Wrapped `priceAnalysis()` in `useMemo` in `ShipPriceAnalysis.tsx` |
| H7 | Moved `sessionStorage` read to `useEffect` in ship detail page |
| H8 | Moved `router.push()` to `useEffect` in ship edit page |
| H9 | Inlined `DecodedShip` type in `price-analysis.ts` |
| H10 | Added PG env var existence checks in `db.ts` |
| H11 | Created `ErrorBoundary.tsx`, added to layout |
| H12 | Added length validation in `cosmoShip.readBytes` |
| H13 | Added bounds check in `cosmoShip.setByte`/`writeBytes` |
| H14 | Removed `window.open` fallback in `download-ship.ts` |
| H15 | Added `crypto.subtle` guard in `ship-signature-client.ts` |
| H16 | Added `AbortController` in `HomeContent.tsx` search fetches |
| H17 | Added 150ms debounce to `setFilter` URL pushes |
| H18 | Added `useEffect` to sync `SearchBar` input with `query` prop |
| M17 | (pre-existing) CollectionPicker already handles `warning` field |
| L3 | (pre-existing) Dockerfile creates user before COPY |
| L12 | (pre-existing) UploadThing SDK usage confirmed clean |
| L19 | (pre-existing) `transaction()` error handling already correct |

## Patterns to Simplify (from Round 2 audit)

| Pattern | Impact | Suggestion |
|---------|--------|------------|
| `verifyRequest` + `401` in 11 routes | ~40 lines duplication | Extract `requireAuth(req)` helper |
| `parseInt(id,10)` + `isNaN` in 8 routes | ~24 lines duplication | Create `parseIdParam(id, name)` utility |
| Turnstile block repeated 3 times | ~15 lines duplication | Extract `requireTurnstile(req, tokenSource)` helper |
| `src/lib/db.ts` (490 lines) | Single file with all DB ops | Split by domain (`db/ships.ts`, `db/collections.ts`, etc.) |
| `cosmoShip.js` (914) + `server-decode.ts` (447) | 2 overlapping decoders | Extract shared binary helpers to `src/lib/binary.ts` |
| No middleware | No centralized auth/logging | Consider `src/middleware.ts` |
| Raw `useEffect` + `fetch` everywhere | No caching, dedup | Consider React Query / SWR |

---

# 2. Round 4 — July 2026 Audit (updated 31 Jul 2026)

Findings from a comprehensive codebase audit of `/home/johnn/cosmo-next`. Prioritized for the next agent.

## Round 4 Status

| Category | Total | Resolved | Remaining |
|----------|-------|----------|-----------|
| 🔴 CRITICAL | 6 | 6 | 0 |
| 🟠 HIGH | 12² | 10 | 2 |
| 🟡 MEDIUM | 16 | 16 | 0 |
| 🟢 LOW/CLEANUP | 20 | 18 | 2 |
| **Total** | **54** | **50** | **4** |

¹ C1, C5 omitted per request. ² H5 omitted per request.

---

## 🔴 CRITICAL

### C1 — _(omitted per request)_
### C2 — Session cookie `__session` is NOT HttpOnly ✅ DONE (Jul 31)

**File:** `src/app/callback/route.ts:98`
**Fix:** Set `httpOnly: true`. Increase `maxAge` to match the 30-day JWT expiry. Consider a dual-cookie pattern (httpOnly for server, short-lived client token for JS).

### C3 — JWT stored in localStorage across 15+ client components

**Files (representative):** `RequireAuth.tsx:9`, `UploadPanel.tsx:110`, `ship/[id]/page.tsx:77,101,116,160`, `favorites/page.tsx:14`, `my-ships/page.tsx:14`, `decode/page.tsx:32`, `admin/page.tsx:20`, `my-collections/page.tsx:22,40`, `collections/new/page.tsx:31`, `collections/[id]/page.tsx:43,64,86`, `collections/[id]/edit/page.tsx:35,70,185`, `ship/[id]/edit/page.tsx:55,97,165`, `CollectionPicker.tsx:33,91`, `Header.tsx:54`

**Fix:** Use `httpOnly` cookies for the JWT. Proxy client-side API calls through Next.js API routes or use server-side sessions. Reduce `TOKEN_EXPIRY` from 30d in `src/lib/auth.ts:9`.

### C4 — Discord discriminator deprecated for new users ✅ DONE (Jul 31)

**File:** `src/app/callback/route.ts:87`
**Fix:** Discord migrated away from discriminators in 2023–2024. New accounts get `discriminator: "0"` or missing. Fall back to `global_name` or just `username`.

### C5 — _(omitted per request)_
### C6 — `GET /api/auth/token` is unauthenticated ✅ DONE (Jul 31)

**File:** `src/app/api/auth/token/route.ts`
**Fix:** Remove endpoint or restrict to authenticated users. Anyone can currently generate a signed JWT with `{ app: "cosmo-client" }`. Endpoint deleted; `generateToken()` retired.

### C7 — Discord username change breaks ownership of ships, collections, and favorites ✅ DONE (Jul 31, Aug 1)

**Files:** `src/lib/db.ts`, `src/app/callback/route.ts`
**Fix:** Added a nullable `discord_id` column to `shipdb`, `collections`, and `favoritedb` (run the SQL below). On every OAuth login the callback decodes the **old** `__session` cookie to recover the previous username and migrates orphaned rows to the current username + Discord ID (`src/lib/db.ts:525 migrateUsernameOnLogin`). New writes (`insertShip`, `createCollection`, `addToFavorites`) store the Discord user ID. Ownership checks now resolve primarily via `discord_id` (`isShipOwner`/`isCollectionOwner` in `db.ts:186`) with a single-row username fallback for rows still carrying `discord_id IS NULL`.

**Final migration design (Aug 1, verified live):**
- The callback now **always** builds the username as `username#discriminator` (e.g. `poney5850#0`), matching the legacy app's format and `ADMIN_USERNAMES` — this is what made `is-admin` start matching (`src/app/callback/route.ts:87`).
- `migrateUsernameOnLogin` runs in **one transaction** on every login:
  - **Adopt** legacy rows where `discord_id IS NULL` and `submitted_by`/`owner`/`name` matches any of the candidate set `[newUsername, bareUsername, prevUsername]` (covers the `#0` legacy format, pre-`discord_id` bare rows, and the previous-cookie username for renames).
  - **Refresh** the current username on rows already linked via `discord_id` (`WHERE discord_id = $id AND name <> $new`), keeping display names current after Discord renames without touching ownership.
  - Rows linked to a **different** Discord account are never touched; historical-discriminator orphans (`#1234`, e.g. `Qawa#4599`, `Poney#5850`) are left for manual reconcile via `scripts/legacy-orphans-report.sql`.
- Indexes (idempotent) make the every-login migration light — shipdb adoption uses the index (no seq scan); collections/favoritedb are tiny (5/72 rows) so seq scan there is optimal:
> ```sql
> ALTER TABLE shipdb ADD COLUMN IF NOT EXISTS discord_id VARCHAR(255);
> ALTER TABLE collections ADD COLUMN IF NOT EXISTS discord_id VARCHAR(255);
> ALTER TABLE favoritedb ADD COLUMN IF NOT EXISTS discord_id VARCHAR(255);
> CREATE INDEX IF NOT EXISTS idx_shipdb_submitted_by    ON shipdb(submitted_by);
> CREATE INDEX IF NOT EXISTS idx_collections_owner      ON collections(owner);
> CREATE INDEX IF NOT EXISTS idx_favoritedb_name        ON favoritedb(name);
> CREATE INDEX IF NOT EXISTS idx_shipdb_discord_id      ON shipdb(discord_id);
> CREATE INDEX IF NOT EXISTS idx_collections_discord_id ON collections(discord_id);
> CREATE INDEX IF NOT EXISTS idx_favoritedb_discord_id  ON favoritedb(discord_id);
> ```
> Idempotent; safe to run anytime. Existing rows start `NULL` and fall back to the username match until the user's next login migrates them.

**Live verification (Aug 1):** on real login, `poney5850#0` adopted 350 ships / 3 collections / 1 favorite (all previously `discord_id NULL`); `/api/auth/session` → `poney5850#0`, `/api/auth/is-admin` → `true`, `/api/ship/my-ships` → 350 via `discord_id`; `Poney#5850` orphan untouched; repeat login is a no-op.

---

## 🟠 HIGH

### H1 — `POST /api/ship/[id]/download` has no auth ✅ DONE (Jul 31)

**File:** `src/app/api/ship/[id]/download/route.ts`
**Fix:** Add authentication check + IP-based rate limiting to prevent download count inflation.

### H2 — `SELECT *` queries over-fetch all columns ✅ DONE (Jul 31)

**Files:** `src/lib/db.ts:100,104,219,279,437`, `sitemap.ts:7-8`
**Fix:** Explicitly list columns needed per query. If internal columns are added later, they won't leak via API responses.

### H3 — Missing Content-Security-Policy header ✅ DONE (Jul 31)

**File:** `src/proxy.ts`
**Fix:** CSP set per-request via middleware with nonce (`'strict-dynamic'`). Moved from `next.config.ts` to `proxy.ts` (inline scripts break static headers). Includes `connect-src` entries for Turnstile, Discord, and CDN hosts — `https://*.uploadthing.com` added (Jul 31) so the uploadthing client's HEAD+XHR to the ingest URL isn't blocked.

### H4 — No CSRF protection on mutation endpoints ✅ DONE (Aug 6)

**Files:** `favorite/route.ts`, `unfavorite/route.ts`, `download/route.ts`, `ship/[id]/route.ts` (PUT, DELETE), `collections/[id]/ships/[shipId]/route.ts` (DELETE), `analytics/log/route.ts` (POST), `price/route.ts` (POST)
**Fix:** Implement anti-CSRF tokens (double-submit cookie pattern or Turnstile). Ensure cookies use `SameSite=Strict`.
**Done:** Session cookie already `SameSite=Strict`; Turnstile verification added to all 7 covered mutation endpoints (shared `verifyTurnstileFromRequest`). `download`, `analytics/log`, `price` intentionally excluded (no interactive form / read-only).

### H5 — _(omitted per request)_
### H6 — SSL validation disabled for PostgreSQL ✅ DONE (Jul 31)

**File:** `src/lib/db.ts`
```ts
ssl: { rejectUnauthorized: false },
```
**Fix:** Enable TLS verification with the CA certificate for the Supabase/RDS instance. Embedded the Supabase 2021 CA chain (`SUPABASE_CA` constant, public cert) and set `ssl: { rejectUnauthorized: true, ca: process.env.POSTGRES_CA ?? SUPABASE_CA }`. Verified live: pool connects with strict verification, `/api/ship/search` returns data.

### H7 — No rate limiting on any endpoint

**Files:** All 22+ API route files
**Fix:** Implement rate limiting middleware. At minimum apply strict limits to mutation endpoints.

### H8 — `useShipDecode` ignores `imageUrl` changes when already decoded ✅ DONE (Jul 31)

**Files:** `src/hooks/useShipDecode.ts:32`, `src/components/ship/ShipStats.tsx:38`
```ts
if (decoded || error) return;  // guards fire even when imageUrl changes
```
**Fix:** Track current URL with a ref and invalidate decode cache on URL change.

### H9 — `UserTagEditor` radio buttons not mutually exclusive ✅ DONE (Jul 31)

**File:** `src/components/tags/UserTagEditor.tsx:31-41`
**Fix:** For `radio` type, remove all existing values in the same group before adding the new one (mutual exclusion).

### H10 — Dynamic `ORDER BY` from user input ✅ DONE (Jul 31)

**File:** `src/lib/db.ts:428-437`
**Fix:** Use an allow-list map instead of a fragile ternary.

### H11 — 38+ empty catch blocks throughout codebase ✅ DONE (Jul 31)

**Files (representative):** `analytics-client.ts:25,27`, `turnstile.ts:17`, `download-ship.ts:4`, `collections/[id]/page.tsx:78,96,116`, `collections/[id]/edit/page.tsx:177,200`, `ship/[id]/page.tsx:75`, `TagFilter.tsx:23`, `AuthorFilter.tsx:25` and many more.
**Fix:** At minimum log `console.error` in every catch block. Surface errors to users for critical operations.

### H12 — Session cookie `maxAge` is only 60 seconds ✅ DONE (Jul 31)

**File:** `src/app/callback/route.ts:103`
**Fix:** Increase to match JWT expiry (30 days) or at minimum 5 minutes to survive redirect chains.

### H13 — Cookie name mismatch: login sets `__session`, logout deletes `token` ✅ DONE (Jul 31)

**Files:** `src/app/callback/route.ts:98` vs `src/app/api/auth/logout/route.ts:5`
**Fix:** Align cookie names. The logout endpoint should delete `__session`, not `token`.

---

## 🟡 MEDIUM

### M1 — PNG decompression bomb vulnerability ✅ DONE (Jul 31)

**File:** `src/lib/server-decode.ts:50-139`
**Fix:** Enforce max dimensions (e.g., 4096x4096) before allocation. Use streaming decompression with size limits.

### M2 — Missing HSTS header ✅ DONE (Jul 31)

**File:** `next.config.ts`
**Fix:** Add `{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }`

### M3 — No request body size limits ✅ DONE (Jul 31)

**Files:** All `req.json()` calls across API routes
**Fix:** Reject payloads > 1MB with a middleware pattern or manual check after parsing.

### M4 — `X-Forwarded-For` trusted for IP decisions ✅ DONE (Jul 31)

**Files:** `analytics/dashboard/route.ts:19`, `collections/route.ts:43`, `collections/[id]/route.ts:48`, `uploadthing.ts:64`, `turnstile.ts:11`
**Fix:** Only trust `x-forwarded-for` when behind a known reverse proxy. Use `req.socket.remoteAddress` as fallback.

### M5 — Error messages distinguish "not found" vs "not owner" ✅ DONE (Jul 31)

**Files:** `collections/[id]/route.ts:63`, `collections/[id]/ships/route.ts:31`, `collections/[id]/ships/[shipId]/route.ts:29`, `db.ts:115,319-320,340-341,348-349`
**Fix:** Return same generic error ("not found") for both cases to prevent user enumeration.

### M6 — `formatDate` uses local timezone ✅ DONE (Jul 31)

**File:** `src/lib/format-date.ts`
**Fix:** Use UTC or ISO format consistently so dates don't differ per viewer timezone.

### M7 — `formatPrice` in ActiveFilters uses `$` instead of `₡` ✅ DONE (Jul 31)

**File:** `src/components/search/ActiveFilters.tsx:12-17`
**Fix:** Use `₡` (`&#x20a2;`) consistently with the rest of the app.

### M8 — `collections` API returns 200 for invalid `shipId` ✅ DONE (Jul 31)

**File:** `src/app/api/collections/route.ts:12`
**Fix:** Return `{ error: "Invalid shipId" }` with status 400.

### M9 — `setFilters` in useFilters not debounced ✅ DONE (Jul 31)

**File:** `src/hooks/useFilters.ts:72`
**Fix:** Apply the same 150ms debounce as `setFilter` to prevent race conditions on batch filter updates.

### M10 — `ShipReconstruction` wasteful double loop ✅ DONE (Jul 31)

**File:** `src/components/ship/ShipReconstruction.tsx:283-303`
**Fix:** Single loop with conditional color instead of iterating all 8 items twice.

### M11 — `ship-signature-client.ts` appears orphaned ✅ DONE (Jul 31)

**File:** `src/lib/ship-signature-client.ts`
**Fix:** Verify if this is needed or remove it.

### M12 — `FilterDrawer` keyboard handler re-attaches on every render ✅ DONE (Jul 31)

**File:** `src/components/search/FilterDrawer.tsx:35-41`
**Fix:** Use a ref for the `onClose` callback to prevent the effect from re-running on every render.

### M13 — No env var validation schema

**Files:** 16+ `process.env` references across 12+ files (db.ts, auth.ts, turnstile.ts, 5 route files, sitemap.ts, robots.ts, callback/route.ts, auth/discord/route.ts, uploadthing.ts)
**Fix:** Create `src/lib/env.ts` with Zod or a validation function that checks all required vars at startup. Use type-safe accessors instead of raw `process.env`.

### M14 — `price/route.ts` catch silently swallows errors ✅ DONE (Jul 31)

**File:** `src/app/api/price/route.ts:15-16`
**Fix:** Log the error and return 500 for unexpected failures; 400 only for validation errors.

### M15 — Missing `loading.tsx` and `error.tsx` files ✅ DONE (Jul 31)

**Files:** Missing at root and route segment levels
**Fix:** Add route-level error boundaries and loading states for automatic handling instead of manual state per page.

### M16 — `PreconnectForImage` may throw on cleanup ✅ DONE (Jul 31)

**File:** `src/components/ui/PreconnectForImage.tsx:19-21`
```ts
document.head.removeChild(link);  // throws if already removed
```
**Fix:** Check `document.head.contains(link)` before removing, or wrap in try/catch.

---

## 🟢 LOW / CLEANUP

### L1 — `src/lib/types.ts` is a near-empty re-export ✅ DONE

**File:** `src/lib/types.ts` — now has 4 shared interfaces (ShipDetail, PriceResponse, CollectionSummary, CollectionDetail). ShipRow import kept for CollectionDetail use.

### L2 — `.blue-btn` CSS class defined but never used ✅ DONE (Jul 31)

**File:** `src/app/globals.css:52-67`
**Fix:** Remove dead CSS.

### L3 — `generateToken()` exported but never imported ❌ Finding outdated

**File:** `src/lib/auth.ts:23-27`
**Note:** `generateToken()` IS imported in `src/app/api/auth/token/route.ts:2`. No action needed. (Endpoint since deleted — re-verify no remaining references.)

### L4 — `src/components/edit/` is an empty directory ✅ DONE

**File:** `src/components/edit/` — directory already removed.

### L5 — 5 inline interfaces duplicated across pages ✅ DONE

**Files:** All now import from `src/lib/types.ts` (ShipDetail, PriceResponse, CollectionSummary, CollectionDetail).

### L6 — 17+ instances of identical button Tailwind class string ✅ DONE

**Fix:** Created `<Button variant="primary" />` component in `src/components/ui/Button.tsx`. Refactored 17+ call sites across 8 files.

### L7 — Duplicate dropdown/portal logic in AuthorFilter + TagFilter ✅ DONE

**Fix:** Extracted shared `useDropdown` hook. Refactored AuthorFilter + TagFilter to use it.

### L8 — `collections/page.tsx` uses `.then().catch()` while all other pages use `async/await` ✅ DONE

**File:** `src/app/collections/page.tsx` — already uses async/await.

### L9 — `handleDownload` duplicated in ship detail page and `download-ship.ts` ✅ DONE (Jul 31)

**Files:** `src/app/ship/[id]/page.tsx:130-155`, `src/lib/download-ship.ts`
**Fix:** Replaced inline handler with `downloadShip()` call. Enhanced shared utility with `imageUrl` param and new-tab fallback.

### L10 — `centerOfMass` dynamically imported inside ShipReconstruction render ✅ DONE

**File:** `src/components/ship/ShipReconstruction.tsx:225`
**Fix:** Changed to static top-level import.

### L11 — Missing focus trap and ARIA attributes on filter drawer ✅ DONE (Jul 31)

**File:** `src/components/search/FilterDrawer.tsx`
**Fix:** Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby="filter-drawer-title"` + heading `id`. Focus trap wraps Tab/Shift+Tab within drawer, focuses first control on open, restores focus to trigger on close.

### L12 — Empty `alt=""` on meaningful ship thumbnails in collection edit ✅ DONE (Jul 31)

**File:** `src/app/collections/[id]/edit/page.tsx:240`
**Fix:** Changed `alt=""` to `alt={name}`.

### L13 — Touch targets on tag chip buttons below 44px recommendation ✅ DONE (Jul 31)

**Files:** `src/components/search/TagFilter.tsx`, `src/components/search/ActiveFilters.tsx`
**Fix:** Increase to `min-w-[36px]` or `p-2`.

### L14 — Token/auth logic duplicated in ~15 client components ✅ DONE

**Fix:** Created `useAuth()` hook. Refactored 14+ components to use it. Centralized auth state.

### L15 — Fetch/Loading state pattern duplicated across 5+ pages ✅ DONE (Jul 31)

**Files:** `my-ships/page.tsx`, `favorites/page.tsx`, `my-collections/page.tsx`, `collections/page.tsx`, `collections/[id]/page.tsx`
**Fix:** Created `useAuthFetch<T>(url)` hook. Refactored my-ships, favorites, my-collections. Saved ~15-20 lines per page.

### L16 — `activeCount` recomputed in FilterDrawer — already available from hook ✅ DONE (Jul 31)

**File:** `src/components/search/FilterDrawer.tsx:43-46`
**Fix:** Removed local computation, passed `activeCount` prop from HomeContent.

### L17 — Inline styles that could use Tailwind classes ✅ DONE (Jul 31)

**Files:** `FilterDrawer.tsx:60,62` — converted `style={{ maxHeight: "85vh" }}` to `max-h-[85vh]`. FilterSection.tsx opacity is dynamic and cannot use static Tailwind.

### L18 — Inconsistent error response format across API routes

**Fix:** Adopt uniform response envelope: `{ ok: boolean, data?: unknown, error?: string }` across all endpoints.

### L19 — `auth/discord/route.ts` non-null assertion on env vars ✅ DONE (Jul 31)

**File:** `src/app/auth/discord/route.ts:17-18`
**Fix:** Replaced `!` assertions with guard + `throw Error("VAR_NAME is required")`.

### L20 — Dynamic imports of `cosmoShip` in 4 places cause file-pick latency ✅ DONE

**Files:** `UploadPanel.tsx:60`, `edit/page.tsx:142`, `decode/page.tsx:18`, `useShipDecode.ts:43`
**Fix:** Changed all to top-level static imports.

---

## Round 4 — Code Structure Recommendations

### Extract shared components ✅ ALL DONE

| Component | Status |
|-----------|--------|
| `<Button variant="primary" />` | ✅ Created in `src/components/ui/Button.tsx`, 17+ call sites refactored |
| `<Card>` | ✅ Created in `src/components/ui/Card.tsx`, 13+ call sites refactored |
| `useAuth()` hook | ✅ Centralized with `hydrated` flag |
| `useDropdown()` hook | ✅ Extracted and used in AuthorFilter + TagFilter |
| `useShipList(url)` hook | ✅ Created as `useAuthFetch<T>(url)` |

### Fix structural issues ✅ ALL DONE

| Task | Status |
|------|--------|
| Remove empty `src/components/edit/` directory | ✅ Already removed |
| Remove redundant `src/lib/types.ts` | ✅ Types.ts now has 4 shared interfaces (not redundant) |
| Convert `collections/page.tsx` to `async/await` | ✅ Already using async/await |
| Add `loading.tsx` and `error.tsx` files | ✅ Created root loading and error boundaries |

### Performance ✅ ALL DONE

| Task | Status |
|------|--------|
| Static import `cosmoShip` and `physics` modules | ✅ All 4 call sites changed to static imports |
| Clear debounce timers on unmount in `useFilters` | ✅ Already had cleanup, verified |
| Fix `ShipReconstruction` double loop | ✅ Merged to single loop with ternary color |

---

# 3. Pre-Production Code Review Report (2026-08-01)

Findings on code structure, usage, security, and simplification to complete **before production**. Generated from a fresh read of the current codebase (post auth-migration).

## 3.1 Executive Summary

The application is a **Next.js 16 App Router** app (`cosmo-next`) using a cookie-based JWT auth model backed by Discord OAuth. The recent work migrated auth fully to an **httpOnly `__session` cookie** (30-day JWT), removed all client-side token/Bearer handling, and added a **Discord username-rename migration** that keys ownership on stable `discord_id` with a username fallback for legacy rows.

**Overall posture**: Auth and security foundations are solid, but the codebase has **inconsistent patterns and a few real security gaps** that should be addressed before production hardening. Key risks: (1) several **unauthenticated endpoints** accepting arbitrary PNG payloads for CPU-bound decode/signature work, (2) **no rate limiting** anywhere, (3) **no centralized auth middleware** — auth checks are duplicated per-route and easy to omit (indeed one read-heavy endpoint omits it).

## 3.2 Security Findings (Prioritized)

### 🔴 Critical — Unauthenticated heavy-compute endpoints
**Files**: `src/app/api/ship/check-duplicate/route.ts`, `src/app/api/ship/search/route.ts` (likely)
- `check-duplicate` accepts `multipart/form-data` PNGs **without auth**, decodes pixels, and computes a signature — CPU-bound work that is **trivially abusable for DoS**. No Turnstile, no auth, no size cap beyond 1 MB on the JSON variant (the `multipart` branch has **no content-length guard at all**).
- This is a direct resource-exhaustion vector. An attacker can POST PNG bombs.
- **Cross-ref:** Round 4 M23 deliberately excluded this endpoint from Turnstile as "read-only"; the current audit reclassifies it as a compute-risk endpoint regardless of writes.

### 🔴 Critical — No rate limiting
- **No rate-limiting layer exists** — confirmed by grep for `ratelimit|limiter`. The OAuth callback, login, `is-admin`, upload (UploadThing), duplicates, and search endpoints are all **unthrottled**.
- UploadThing caps uploads at 8 MB but does not rate-limit by account/IP.
- The OAuth callback hits Discord's token endpoint with no local throttling.
- **Cross-ref:** Round 3 M12 and Round 4 H7 both flag this — still OPEN.

### 🟡 High — Inconsistent auth enforcement
- **`check-duplicate` has no auth check** — returns ship signature/dedup info to anonymous users. Signatures enable signature-gating attacks if signatures are meant to be semi-secret.
- `analytics/dashboard` and `analytics/log` correctly gate on admin/session, but the **absence of a shared auth wrapper** means future routes will likely omit it (as `check-duplicate` did).
- **Recommendation: central `auth` middleware or a shared `requireUser`/`requireAdmin` helper imported everywhere.**
- **Cross-ref:** Round 3 "Patterns to Simplify" proposed the same helper; still not implemented.

### 🟡 High — Dynamic imports of DB layer per route
- Routes do `const { getImageData } = await import("@/lib/db")` **inside handlers** (e.g. `ship/[id]/route.ts:50`, `collections/[id]/route.ts`). This is a non-standard pattern that:
  - Defeats tree-shaking/turbopack optimizations the App Router intends (modules should be imported at top-level).
  - Adds per-request overhead.
  - Makes auth/DB call sites inconsistent across routes.
- **Cross-ref:** Round 3 M22/L14 and Round 4 L14 — ✅ FIXED: all dynamic `@/lib/db` imports converted to top-level static imports (last remaining: `collections/page.tsx`).

### 🟡 Medium — `getImageData` SELECTs `data` (full ship blob) on every read
- `getImageData` (db.ts:197) `SELECT ... data ...` is used by read endpoints AND by the replacer ownership path. Returning the full ship blob on list/fetch is fine, but **consider a slim projection** for the `check-duplicate`/`getImageData`-only-ownership path to reduce memory per row.
- **Cross-ref:** Round 3 L16 flagged `SELECT *`; Round 4 H2 (SELECT * fixed) — this is the remaining over-fetch in `getImageData`.

### 🟡 Medium — `getUserFromRequest` swallows errors silently
- `auth.ts:47-52`: `jwt.verify` failures return `null` with no logging. This is acceptable, but combined with no rate limiting means **brute-force JWT probing is silent and unbounded**.

### 🟢 Good / Secure — Cookie auth is correctly configured
- `__session`: `httpOnly, secure, sameSite=lax, maxAge=30d` ✓ (callback/route.ts:115-121)
- Session is **never put in URL** — good note in code comment ✓
- `JWT_SECRET` validated at use; `verifyToken` pins `HS256` algorithm ✓ (prevents alg confusion attacks)
- `X-Frame-Options: DENY`, `nosniff`, `HSTS`, `Permissions-Policy` via `next.config.ts` ✓
- Turnstile gating on write endpoints (uploads, collection writes, dashboard) outside dev ✓
- UploadThing server-side parses `__session` cookie itself — good, avoids client-trusting a user ID
- `isShipOwner`/`isCollectionOwner` dual-keyed (discord_id primary, username fallback) ✓
- `deleteShip` and ownership DELETEs gate on the same dual condition ✓

> Note: `secure: true` means the cookie won't be set over plain HTTP localhost. For dev on `http://localhost`, you'd need a bypass; the app appears to run dev on port 8000 — verify the cookie is actually being sent in dev.

## 3.3 Architecture & Code-Structure Observations

### Directory / File Layout
- Standard Next.js 16 App Router: `src/app/api/*/route.ts` (37 route files), `src/app/callback/route.ts`, `src/lib/*`, `src/hooks/useAuth.ts`, `src/components/*`.
- `src/lib/` holds: `auth.ts`, `db.ts` (674 lines — large), `turnstile.ts`, `upload-png.ts`, `server-decode.ts`, `analytics-db.ts`, `ship-signature.ts`, `price.ts`, `proxy.ts`.

### Layering
```
client (useAuth) -> /api/auth/session -> getUserFromRequest (cookie) -> JWT verify
client (useAuthFetch) -> Bearer header -> REMOVED ✓
UploadThing -> commonMiddleware (cookie from req) -> getUserFromRequest
OAuth callback -> fetch Discord -> JWT.sign -> set __session
```

### Data Flow — Auth
- Single source of user: `getUserFromRequest(req)` returns `UserPayload` (id, username, avatar, guild).
- 36 of 37 API routes use `getUserFromRequest`; 1 (`check-duplicate`) omits it.

### Data Flow — Ownership
- `discord_id` (Discord snowflake) is now stored + checked first; username is a **fallback only for rows where discord_id is NULL** (legacy).
- Writes (`insertShip`, `createCollection`, `addToFavorites`) store `discord_id`.
- The login callback recovers the *old* username from the *previous* `__session` cookie and migrates orphaned rows (Option A backfill-on-login).

### Env Validation
- **FIXED (Aug 6)**: `src/lib/env.ts` now holds a full schema (`envSchema`) with per-var format validators — URLs (`CLIENT_URL`, `DISCORD_REDIRECT_URI`), Discord snowflakes (`DISCORD_CLIENT_ID`, guild IDs), integer ports (`POSTGRES_PORT`), PEM (`POSTGRES_CA`), and min-length checks (`JWT_SECRET` ≥32, `TURNSTILE_SECRET`/`DISCORD_CLIENT_SECRET`/`UPLOADTHING_TOKEN` ≥20, sitekey ≥10). Runs fail-fast at startup (imported from `layout.tsx`, so it fires on every server boot/render). `getRequiredEnv()` replaces scattered `process.env.X!` reads (callback route refactored).
- `analytics/dashboard` parses `ADMIN_USERNAMES` from env on module load (acceptable).
- **Cross-ref:** Round 4 M13 flagged this — now ✅ FIXED.

## 3.4 Code-Structure / Pattern Issues to Simplify

1. **Inconsistent auth guard style**: Some routes use top-level `getUserFromRequest`, others lazy-`import("@/lib/db")` inside handlers. **Standardize**: import db helpers at top; wrap handlers in `requireAuth(req, res)` returning standardized 401 JSON.
2. **Dynamic db imports** (`db.ts:50`, `[id]:60`, `[id]:92`) — move to top-level imports. This is not Next.js App Router idiomatic and hurts readability/maintainability.
3. **`db.ts` is 674 lines** — could be split into `db/ships.ts`, `db/collections.ts`, `db/favorites.ts`, `db/analytics.ts`. (Round 3 flagged 490 lines; it has grown.)
4. **`UserPayload` vs client `User` duplicate-shape** — `auth.ts:UserPayload` and `hooks/useAuth.ts:User` have near-identical shapes (id vs no id); reconcile into a single canonical user type in `lib/auth.ts` re-exported client-side.
5. **No Zod / input schema validation** — routes do ad-hoc `parseInt`/presence checks and inline `body.` access. Consider a shared input-validation helper for robustness (not strictly security, more correctness).
6. **`next.config.ts`** sets `output: "standalone"` — ensure the chosen runtime (Node server) supports the `headers()` + `images` remote patterns. Fine, just verify at deploy.

## 3.5 Improvement Recommendations (Pre-Production Checklist)

| # | Priority | Action | Where |
|---|----------|--------|-------|
| 1 | Critical | Add auth + Turnstile to `check-duplicate` (or gate behind logged-in session) | `ship/check-duplicate/route.ts` |
| 2 | Critical | Add content-length / raw-body size cap to the `multipart` branch of `check-duplicate` | same |
| 3 | Critical | **Add rate limiting** — at minimum on `/api/auth/session`, `/api/auth/is-admin`, `/callback`, `/api/uploadthing`, `/ship/check-duplicate`. Use `@upstash/ratelimit` or an in-process limiter for the latter. | global / middleware |
| 4 | High | Create a **shared `requireAuth(req)` + `requireAdmin(req)`** helper (or a `middleware.ts`) and refactor all 36 routes to use it — prevents missing-check regressions. | `lib/auth.ts` + routes |
| 5 | High | Convert dynamic `db` imports to top-level module imports for consistency & tooling. | multiple route.ts files |
| 6 | Medium | Add **startup-time env validation** (fail fast in prod if `DISCORD_CLIENT_ID/SECRET`, `TURNSTILE_SECRET`, `POSTGRES_*`, `JWT_SECRET`, `CLIENT_URL` missing). | `lib/env.ts` loaded by root layout or `next.config` |
| 7 | Medium | Split `lib/db.ts` into per-domain modules; share the `query`/`transaction` helpers. | `lib/db/` |
| 8 | Medium | Add `idx_shipdb_submitted_by`, `idx_collections_owner`, `idx_favoritedb_name`, `idx_shipdb_discord_id`, `idx_collections_discord_id`, `idx_favoritedb_discord_id` SQL indexes. | ✅ DONE (Aug 1) |
| 9 | Low | Add a **production health/log for `getUserFromRequest` silent-nulls** — count invalid tokens per minute to detect probing. | `lib/auth.ts` |
| 10 | Low | Consider **shortening `__session` TTL** to something smaller than 30d for an OAuth-only app (e.g. 7d) and/or implement token rotation. | `auth.ts`/`callback` |
| 11 | Low | Add **CORS allowlist** if any cross-origin client is served (not currently, but `headers()` has no CORS policy). | `next.config.ts` |

## 3.6 Key Files for Review

- `src/lib/auth.ts:44-53` — `getUserFromRequest` (single source of user; silent-fail concern)
- `src/lib/db.ts:186-194` — `isShipOwner`/`isCollectionOwner` dual-key logic ✓ (good)
- `src/lib/db.ts:525` — `migrateUsernameOnLogin` (rename backfill)
- `src/app/callback/route.ts:100-124` — OAuth callback + rename migration + cookie set
- `src/app/api/auth/session/route.ts` — trivial but correct
- `src/app/api/ship/check-duplicate/route.ts` — **the unauthenticated compute endpoint (risk #1)**
- `src/app/api/auth/is-admin/route.ts` — admin gate pattern (good but could be shared)
- `src/hooks/useAuth.ts` — client session model (good, no localStorage)
- `src/components/RequireAuth.tsx` — (needs reading; likely fine)

## 3.7 Bottom Line

**Auth is secure and well-implemented.** The cookie JWT model, Discord-id-keyed ownership, and rename migration are production-grade. The **main blockers to production hardening** are: (a) the unauthenticated heavy-compute duplicate-check endpoint, and (b) the complete absence of rate limiting — both of which are exploitable today. Secondary: centralize/consistent auth guards, eliminate dynamic db imports, and add fail-fast env validation.

---

# 4. Round 5 — Analytics Improvements (2026-08-07)

Scope: exclude filter (owner + pinned QA anonymous identity), admin dashboard toggle, and a batch of code-hardening findings. Merged from the former `docs/FINDINGS.md`.

## Round 5 Status

| Category | Total | Resolved | Remaining |
|----------|-------|----------|-----------|
| Findings | 10 | 10 | 0 |
| Documented limitations | 4 | n/a | 4 (not changing) |
| Deferred | 1 | 0 | 1 |

## Resolved

| # | Finding | Fix | Status |
|---|---------|-----|--------|
| 1 | `anon_id` column missing → anonymous users indistinguishable | `scripts/migrations/001-analytics-anon-id.sql` + idempotent `ensureAnalyticsSchema` fallback | done |
| 2 | Dashboard exclusion didn't cover the owner (legacy `poney5850` username rows leaked) | exclude by `user_id` + `username` (`?exclude` / `?excludeUserId`) | done |
| 3 | QA anonymous runs pollute the dashboard | pinned deterministic anon_id (`scripts/qa-lib.ts` `QA_ANON_ID`) + `ANALYTICS_EXCLUDE_ANON_IDS`; `P4-N2` drift guard | done |
| 4 | Turnstile single-use token reuse → 403 → home redirect on date zoom | fresh one-shot token per dashboard fetch + 403 retry (`admin/page.tsx`) | done |
| 5 | `GET /api/analytics/dashboard?exclude=…` 500 (`syntax error at or near "AND"`) | `build()`/`where()` predicate composer in `analytics-db.ts` | done |
| 6 | 5 dashboard queries ran sequentially | `Promise.all` in `getDashboardData` | done |
| 7 | `/api/analytics/log` accepted unbounded `event_type`/`url`/`metadata` | length caps + 400 on bad shapes + `ship_id` int4 range guard | done |
| 8 | `P4-N2` left a `/qa-anon-id-check` marker row per run | suite `DELETE`s the marker after asserting | done |
| 9 | schema ensured via per-process ALTER only | added `scripts/migrate.ts` + `npm run migrate` (runtime fallback kept) | done |
| 10 | `P2-G10` flake: "Login was cancelled." banner auto-dismissed after 5s, racing the 15s test poll | banner auto-dismiss 5s → 15s (`Header.tsx`) | done |

## Documented limitations (not changing)

- **Unidentifiable legacy events**: ~2,048 of ~3,241 analytics rows have NULL
  `user_id` and NULL `anon_id` (pre-anon_id era). They can't be attributed,
  excluded, or counted in `unique_users` (`COUNT(DISTINCT)` ignores NULL), so
  "Total Events" always includes them.
- **`ANALYTICS_ANON_SALT` default is public** (`cosmo-anon-v1`): production must
  set a random salt, otherwise anon hashes are predictable. See `.env.example`.
- **Pinned QA anon id is environment-specific**: it derives from the loopback IP
  (`::1`) + dev-browser UA + default salt. A deployed QA environment needs its
  own value; changing the salt/browser/IP invalidates it (`P4-N2` fails loudly).
- **`anonIdFor` trusts `x-forwarded-for`**: safe on Vercel (platform-set), but a
  spoofable trust boundary if ever deployed behind a plain reverse proxy.

## Deferred

- **Bad-IP blocklist (503)** — see `docs/plans/bad-ip-blocklist-503.md`
  (FireHOL level1 + blocklist.de free lists, in-memory + DB hybrid, Vercel cron +
  `/api/internal/update-blocklist`, `IP_BLOCKLIST_ENABLED` default-on with
  emergency override, analytics `blocked_ips_total` / `blocked_ip_hits_24h`).
  Planned but not implemented.

## Observability

- Suite: `node --env-file=.env --no-warnings scripts/qa-suite.ts` (43 cases).
- Migrations: `npm run migrate` (apply pending `scripts/migrations/*.sql`).

---

# Consolidated Open Items (across all rounds)

| ID | Round | Severity | Item | Status |
|----|-------|----------|------|--------|
| R3-M12 / R4-H7 / R4-PP | R3, R4, PP | 🔴 Critical | No rate limiting on any endpoint | ✅ FIXED (Aug 6: `src/proxy.ts` — login `/callback`+`/auth/discord` 5/min, api 600/min, upload 10/min, check-dup 20/min; verified `/callback` → 429 on 6th request with `X-RateLimit-*` headers) |
| R4-PP-1 | PP | 🔴 Critical | Unauthenticated heavy-compute `check-duplicate` endpoint | ✅ FIXED (auth-gated) |
| R4-PP-2 | PP | 🔴 Critical | No size cap on `multipart` branch of `check-duplicate` | ✅ FIXED (5MB multipart / 1MB JSON caps) |
| R3-M23 / R4-H4 | R3, R4 | 🟠 High | Missing CSRF/Turnstile on mutation endpoints | ✅ FIXED (Aug 6: Turnstile on critical mutations; removed from favorite + add/remove-collection-ship) |
| R4-PP-4 | PP | 🟡 High | No shared `requireAuth`/`requireAdmin` helper | ✅ FIXED (Aug 6: helpers in `lib/auth.ts`, refactored 15 routes; dashboard anon now 401) |
| R3-M22 / R3-L14 / R4-PP-5 | R3, PP | 🟡 High | Dynamic `await import("@/lib/db")` in API routes | ✅ FIXED |
| R4-M13 / R4-PP-6 | R4, PP | 🟡 Medium | No startup-time env validation schema | ✅ FIXED (Aug 6: `src/lib/env.ts` schema with per-var format validators — URLs, snowflakes, ports, PEM, min lengths; runs fail-fast at startup via `layout.tsx` import; `getRequiredEnv()` replaces scattered `process.env.X!` in callback route) |
| R3-M13 / R4-H6 | R3, R4 | 🟢 Medium | PG SSL validation | ✅ FIXED |
| R3-L6 / R4-PP-8 | R3, PP | 🟡 Medium | Missing DB indexes (owner/submitted_by/fav + discord_id) | ✅ DONE (Aug 1) |
| R3-M1 / R4-H9 | R3, R4 | 🟡 Medium | UserTagEditor radio mutual exclusion | ✅ FIXED (R4 H9) |
| R3-M12 (old) / R4-M13 | R3, R4 | 🟡 Medium | Env var validation | ✅ FIXED (same as above) |
| R4-H7 / R4-PP-3 | R4, PP | 🔴 Critical | OAuth callback unthrottled | ✅ FIXED (Aug 6: covered by proxy `loginLimiter` 5/min/IP via `src/proxy.ts:15`; verified live 429) |
| R4-L18 / R4-PP | R4, PP | 🟢 Low | Inconsistent error response envelope | 🔴 OPEN |
| R4-H4-CSRF | R4 | 🟡 Medium | Cookie `SameSite=Strict` not enforced | ✅ DONE (Strict + Turnstile on critical mutations) |
| R5-1 | R5 | 🟡 Medium | Bad-IP blocklist (FireHOL + blocklist.de, 503 + Retry-After) | 🔴 OPEN (deferred — plan: `docs/plans/bad-ip-blocklist-503.md`) |
| R5-2 | R5 | 🟢 Low | QA suite has no P2-G11 rate-limit coverage case (429 on rapid `check-duplicate`) | 🔴 OPEN (limiter works, verified manually — untested in suite) |
| R5-3 | R5 | 🟢 Low | `QA_TEST_PLAN.md` stale counts (e.g. P1-U2a My Ships = 350, live DB has 1107) | 🔴 OPEN (suite compares dynamically, doc is stale) |
