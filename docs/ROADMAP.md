# CosmoShip — Development Roadmap

Remaining work consolidated from `docs/CODE_REVIEW_FINDINGS.md` (Rounds 3–5, Pre-Production),
`docs/QA_FINDINGS.md`, and `docs/PROJECT.md` known-limitations. Status legend:

| Mark | Meaning |
|------|---------|
| ⬜ TODO | Not started |
| 🚧 IN PROGRESS | Being worked on |
| ✅ DONE | Completed |
| 🔸 HOLD | Deferred / blocked by decision |

## Phase 1 — Quick wins: docs & QA hygiene

Small, safe, unblocks clean verification.

| # | Item | Source | Status |
|---|------|--------|--------|
| 1.1 | **Correct stale finding R5-2** — the suite *does* cover rate limiting: `P2-G11` (check-dup 429) + `P2-G12` (/callback 429) are in `scripts/qa-suite.ts` (43 cases). Mark R5-2 resolved in `CODE_REVIEW_FINDINGS.md`. | R5-2 | ⬜ |
| 1.2 | **Refresh stale counts** in `docs/QA_TEST_PLAN.md` (P1-U2a `350` ships vs ~1100 live; verify favorites/collections counts). Suite compares dynamically, so this is doc-only. | R5-3 | ⬜ |
| 1.3 | **Remove P3-S6 DEBUG leftover** block (`scripts/qa-suite.ts:553-555`) — dead diagnostic eval. | QA_FINDINGS | ⬜ |
| 1.4 | **Annotate `docs/QA_FINDINGS.md` as historical** (pre-P2-G11 38-case run): items about P2-G11 gap and P2-G2 label drift are already resolved. | QA_FINDINGS | ⬜ |

## Phase 2 — Deferred feature: Bad-IP blocklist

| # | Item | Source | Status |
|---|------|--------|--------|
| 2.1 | **Implement bad-IP blocklist**: FireHOL level1 + blocklist.de fetch, in-memory + DB hybrid, Vercel cron + `/api/internal/update-blocklist`, `IP_BLOCKLIST_ENABLED` default-on with emergency override, 503 + `Retry-After`, analytics `blocked_ips_total` / `blocked_ip_hits_24h`. | R5-1 | 🔸 |

Plan: `docs/plans/bad-ip-blocklist-503.md`. Requires Vercel cron + a token-protected internal route (reuses `proxy.ts`).

## Phase 3 — Abuse & memory hardening (Round 3 M-group)

Defense-in-depth for the binary decode path and unbounded client memory.

| # | Item | Source | Status |
|---|------|--------|--------|
| 3.1 | **Decompression size cap** — `cosmoShip.js` `DecompressionStream` / `server-decode.ts` `zlib.gunzipSync` have no max output size (zip-bomb vector). | M9 | ⬜ |
| 3.2 | **Allocation caps** — `readString`/`readVarint` length prefixes allocate without limit in `cosmoShip.js`. | M10 | ⬜ |
| 3.3 | **Log `SKIP` drops** — `processBinaryValue` silently drops unrecognized keys; log at debug level for format evolution. | M11 | ⬜ |
| 3.4 | **Circular-reference guard** in `normalize-ship.ts` recursive traversal (currently stack-overflows on cycles). | M8 | ⬜ |
| 3.5 | **Cache eviction policy** for module-level caches (`useShipDecode`, `ShipStats`, `ShipReconstruction`) — currently unbounded. | M5 | ⬜ |
| 3.6 | **AbortController** on remaining `useEffect` fetch sites (12+ locations; only `HomeContent` has it). | M24 | ⬜ |
| 3.7 | **Timer cleanup** in `CollectionPicker` `setTimeout`. | M20 | ⬜ |
| 3.8 | **Migrate `RichTextEditor` off deprecated `document.execCommand()`** (now also breaks with `unsafe-eval`/CSP cleanups). | M26 | ⬜ |
| 3.9 | **TurnstileWidget**: visual feedback when Cloudflare script fails to load [M6]; remove dead `readyState` script-element check [M21]. | M6, M21 | ⬜ |

## Phase 4 — Consistency & refactor

| # | Item | Source | Status |
|---|------|--------|--------|
| 4.1 | **Uniform response envelope** `{ ok, data? | error? }` across all routes (some still return `{ data: … }` bare / inconsistent shapes). | R4-L18 | ⬜ |
| 4.2 | **Collections API shapes** — `GET /api/collections` returns `{data}` for `?shipId=X` but `{data,page,max_page,total_count}` for the paginated path. | M2 | ⬜ |
| 4.3 | **`price.ts` module-level side effect** (eager `partCostCache` fill on import) + `MISSILE_MAPPING` duplicate of `missileTagMap`. | M3 | ⬜ |
| 4.4 | **Delete `src/lib/db.old.ts`** (693-line pre-modularization file, zero references). | PROJECT | ⬜ |
| 4.5 | **Slim `getImageData` projection** for ownership/check-duplicate paths (avoid pulling full `data` blob). | PP | ⬜ |
| 4.6 | *(Optional)* **Shared binary helpers** between `cosmoShip.js` and `server-decode.ts` (currently two overlapping decoders). | R2 pattern | 🔸 |

## Phase 5 — SEO, metadata & polish

| # | Item | Source | Status |
|---|------|--------|--------|
| 5.1 | **Open Graph + Twitter metadata** (`openGraph`, `twitter`, `metadataBase`). | M15 | ⬜ |
| 5.2 | **Canonical URL** in metadata. | L1 | ⬜ |
| 5.3 | **`engines` + `.nvmrc`** (Node ≥20). | L2 | ⬜ |
| 5.4 | **`tsconfig` target → ES2022**. | L10 | ⬜ |
| 5.5 | **`@next/bundle-analyzer` + `sharp`**. | L9 | ⬜ |
| 5.6 | **`AnalyticsTracker` inside `<Suspense>`** (currently outside, may force client rendering of layout). | M14 | ⬜ |
| 5.7 | **bfcache refresh** on back-navigation for all list pages (only collections does it today). | M16 | ⬜ |
| 5.8 | **`ShipStatsPanel`** — add `"use client"` / drop the `dynamic(..., {ssr:false})` inconsistency. | M18 | ⬜ |
| 5.9 | **a11y pass** — aria-labels, roles, keyboard handlers across filters/drawers/buttons. | L18 | ⬜ |
| 5.10 | **Cross-tab login sync** (`isLoggedIn` checked once on mount only). | L13 | ⬜ |
| 5.11 | **Blank-render edge case** on ship detail when both `error` and `ship` are null. | L5 | ⬜ |
| 5.12 | **`searchFromQueryString`** — replace fragile manual URL parsing with `URLSearchParams`. | L4 | ⬜ |
| 5.13 | **`Number(qty)` NaN guard** in `price.ts`. | L17 | ⬜ |
| 5.14 | **`turnstile.ts` fetch timeout** to Cloudflare. | L20 | ⬜ |

## Phase 6 — Production launch checklist

Deploy-blocking operations; most require prod env/DB access.

| # | Item | Source | Status |
|---|------|--------|--------|
| 6.1 | **Set a random `ANALYTICS_ANON_SALT` in production** (default `cosmo-anon-v1` is public). | PROJ-lim | ⬜ |
| 6.2 | **Generate the prod-specific pinned QA anon id** (current pin is derived from loopback + dev UA; `P4-N2` fails loudly if wrong). | PROJ-lim | ⬜ |
| 6.3 | **Verify `x-forwarded-for` trust boundary** on Vercel (platform-set; fine now, but audit if moved behind a plain reverse proxy). | PROJ-lim | ⬜ |
| 6.4 | **JWT-probing observability** — count silent `getUserFromRequest` nulls (brute-force detection). | PP-9 | ⬜ |
| 6.5 | **Session TTL / token rotation** decision (7d JWT; consider shorter + rotation). | PP-10 | ⬜ |
| 6.6 | **Finalize CORS allowlist** (`ALLOWED_ORIGINS` — currently returns empty headers when unset). | PP-11 | ⬜ |
| 6.7 | **Confirm live DB indexes** (`idx_shipdb_discord_id`, `idx_collections_discord_id`, `idx_favoritedb_discord_id`, `idx_*_submitted_by/owner/name`) exist in production. | R4-PP-8 | ⬜ |

## By design / not changing (documented limitations)

- **Unidentifiable legacy analytics rows** (~2,048 of ~3,241 with NULL `user_id` AND `anon_id`):
  can't be excluded or counted in `unique_users`. Accepted.
- **Turnstile scope** — only on critical mutations; favorites/add-remove-collection-ship are
  intentionally un-gated (high-frequency, low-stakes).
- **Rate limits** — in-memory buckets reset on server restart (acceptable at this scale).

---

**Sources** — IDs map to: Round 3 `M*`/`L*`, Round 4 `L18`, Pre-Production `PP-*`, Round 5
`R5-*`, `PROJ-lim` = `docs/PROJECT.md` documented limitations, `QA_FINDINGS` =
`docs/QA_FINDINGS.md`. Full detail in `docs/CODE_REVIEW_FINDINGS.md`.
