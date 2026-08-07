# Plan: Bad-IP Blocklist with 503 (Vercel, dual free sources, analytics)

## Context
- Deploy target: **Vercel** (Hobby cron available). Dev server runs locally.
- Sources: **both** FireHOL level1 + blocklist.de, enabled by default.
- Emergency off-switch: `IP_BLOCKLIST_ENABLED` env flag — enabled by default when unset; `false` disables all checks with zero overhead.
- Light on DB: in-memory cache is source-of-truth for lookups; DB touched only during refresh + hit counters.
- Analytics: expose `blocked_ips_total` + `blocked_ip_hits_24h` on `/api/analytics/dashboard`.

## Data sources (free, no API key, raw text)
| Source | URL | Format | ~Count |
|--------|-----|--------|--------|
| FireHOL level1 | `https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset` | CIDR | ~4,600 (conservative) |
| blocklist.de | `https://www.blocklist.de/downloads/export-ips_all.txt` | single IP → /32 | ~10k (aggressive) |

## 503 strategy
- Middleware checks blocklist **before** existing rate-limit (429) and CORS logic.
- Blocked IP → `503 Service Unavailable` + `Retry-After: 86400`.
  - Signals "service down" → bots rotating IPs keep hitting 503 across the (large) list → waste time / abandon.
  - `Retry-After` makes polite clients back off.
- Non-blocked IPs → normal flow (existing 429 limiter unchanged).
- `IP_BLOCKLIST_ENABLED=false` → lookup skipped entirely (no lookup cost).

## Architecture
```
[vercel.json cron every 12h] ──POST x-internal-token──► /api/internal/update-blocklist
        │
        ▼
 src/lib/ip-block/update.ts :: refreshBlocklist()
   fetch FireHOL level1  ─┐
   fetch blocklist.de    ├─► DB upsert (dedup, single tx per source) ──► cache.reloadFromDb()
   [lazy startup refresh: 1st request, 30-min staleness check, NOT per-request]
        │
        ▼
 src/proxy.ts
   getClientIp(req) ──► cache.lookup(ip)
        │ hit  ──► 503 + Retry-After  + deferred hits++ (fire-and-forget DB UPDATE)
        │ miss ──► existing CORS / rate-limit (429) / route handler
```

## Files — create / change

### NEW
1. `src/lib/db/ip-blocks.ts`
   - Lazy `CREATE TABLE IF NOT EXISTS ip_blocks (ip cidr PK, source text, first_seen timestamptz, last_seen timestamptz, hits int default 0, reason text)` (guarded by module flag; no migration runner exists).
   - `upsertIp(ip, source)` — skip existing (refresh `last_seen` only) → low churn.
   - `recordHit(ip)` — `hits += 1` for analytics.
   - `blockedCount()`, `hitsIn24h()` — analytics reads.
2. `src/lib/ip-block/cache.ts`
   - `IpBlockCache`: parsed CIDR list in memory; `lookup(ip): boolean` (masked prefix compare, sub-ms for ~14k entries); `loadFromDb()` bulk fill; `addIp`/`removeIp` for manual ops.
3. `src/lib/ip-block/sources.ts`
   - `loadFireholLevel1()` / `loadBlocklistDe()` — fetch + parse (timeout, no key).
4. `src/lib/ip-block/update.ts`
   - `refreshBlocklist()` — both sources → dedup upsert → `cache.loadFromDb()`.
5. `src/app/api/internal/update-blocklist/route.ts`
   - `POST`, checks `x-internal-token === INTERNAL_API_TOKEN`, calls `refreshBlocklist()`, returns `{added, total, sources}`. 401 otherwise.
6. `vercel.json` (project root) — scheduled cron + headers for the internal route.
7. `scripts/unblock-ip.ts` (proposed) — `DELETE FROM ip_blocks WHERE ip = $1` one-off CLI.
8. `docs/plans/bad-ip-blocklist-503.md` (this file)

### MODIFY
1. `src/proxy.ts`
   - Add IP-block lookup at top of `proxy()`, before CORS/limiter. 503 + Retry-After on hit; deferred hit counter.
2. `src/lib/env.ts` / `.env.example`
   - `INTERNAL_API_TOKEN` (require in prod; warn in dev if unset).
   - `IP_BLOCKLIST_ENABLED` (optional; default "true").
3. `src/lib/analytics-db.ts` (+ dashboard shape)
   - Add `blocked_ips_total`, `blocked_ip_hits_24h`.
4. `scripts/qa-suite.ts`
   - P2-G13: insert `127.0.0.1/32` → `GET /` → 503 → cleanup.
   - P2-G14: `IP_BLOCKLIST_ENABLED=false` → 200 on `/`.
   - P2-G15: `/api/internal/update-blocklist` auth (no token 401; wrong 401; good 200 + counts).
5. `QA_TEST_PLAN.md`
   - Document P2-G13/G14/G15 + 503 rationale.
6. `CODE_REVIEW_FINDINGS.md`
   - Note new finding (or new entry) for this feature once implemented.
7. `.vercelignore`
   - Ensure `vercel.json` is NOT ignored (must deploy for cron). Verify excludes `node_modules` only.

## Risks / mitigations
| Risk | Mitigation |
|------|-----------|
| False-positive 503 | FireHOL = conservative default; `IP_BLOCKLIST_ENABLED=false`; instant `DELETE FROM ip_blocks WHERE ip='<x>'` or `scripts/unblock-ip.ts` |
| Vercel serverless — no boot hook | Cron HTTP call + lazy first-request refresh (staleness timestamp, not per-request) |
| List fetch fails mid-cron | try/catch per source; keep existing cache/DB; return `{"added":0,"total":N,"note":"fetch failed, kept existing"}` |
| DB write churn | Upsert-dedup (refresh `last_seen` only); single tx per source |
| Hit-counter write load | Fire-and-forget `UPDATE ip_blocks SET hits = hits + 1` (swallowed; never delays 503) |
| 503 SEO noise | Acceptable for this app; UA-allowlist for crawlers is future-work, not now |

## Deferred (post-MVP)
- `Retry-After` value tuning (default proposed: 86400s).
- Optional Apache BB bad-UA layer on `/api` headers.
- Admin UI to list/remove blocked IPs (DB table is ready for this).

## Status
Saved. Not yet implemented. Awaiting go-ahead to enter Execution Mode.
