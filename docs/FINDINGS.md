# Analytics — Code Findings & Next Steps

Status of analytics improvements identified during the exclude/anon work.

## Resolved

| # | Finding | Fix | Status |
|---|---------|-----|--------|
| 1 | `anon_id` column missing → anonymous users indistinguishable | `migrations/001-analytics-anon-id.sql` + idempotent `ensureAnalyticsSchema` fallback | done |
| 2 | Dashboard exclusion didn't cover the owner (legacy `poney5850` username rows leaked) | exclude by `user_id` + `username` (`?exclude` / `?excludeUserId`) | done |
| 3 | QA anonymous runs pollute the dashboard | pinned deterministic anon_id (`scripts/qa-lib.ts` `QA_ANON_ID`) + `ANALYTICS_EXCLUDE_ANON_IDS`; `P4-N2` drift guard | done |
| 4 | Turnstile single-use token reuse → 403 → home redirect on date zoom | fresh one-shot token per dashboard fetch + 403 retry (`admin/page.tsx`) | done |
| 5 | `GET /api/analytics/dashboard?exclude=…` 500 (`syntax error at or near "AND"`) | `build()`/`where()` predicate composer in `analytics-db.ts` | done |
| 6 | 5 dashboard queries ran sequentially | `Promise.all` in `getDashboardData` | done |
| 7 | `/api/analytics/log` accepted unbounded `event_type`/`url`/`metadata` | length caps + 400 on bad shapes + `ship_id` int4 range guard | done |
| 8 | `P4-N2` left a `/qa-anon-id-check` marker row per run | suite `DELETE`s the marker after asserting | done |
| 9 | schema ensured via per-process ALTER only | added `scripts/migrate.ts` + `npm run migrate` (runtime fallback kept) | done |

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
- Migrations: `npm run migrate` (apply pending `migrations/*.sql`).
