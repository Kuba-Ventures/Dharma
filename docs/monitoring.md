# Monitoring & alerting

What's in place to keep Dharma healthy at public scale, and how to wire the
external pieces.

## Health check — `GET /api/health`

Public, unauthenticated, uncached. Verifies database reachability and reports
admin-sheet config presence.

- `200 {ok:true, checks:{database:"ok", adminSheetConfigured:"ok"}, ts}` — healthy.
- `503 {ok:false, checks:{database:"fail", ...}}` — DB unreachable (the outage
  that takes the whole product down).

**Wire an external uptime monitor** (Better Uptime, Cronitor, Pingdom, or
Vercel's own) to poll `https://www.dharmaautomations.com/api/health` every
1–5 min and alert on non-200. This catches full outages the in-app alerts can't
(the app can't page you if the app is down).

## Ops alerts — `sendOpsAlert()`

`lib/opsAlert.ts` posts to `OPS_ALERT_WEBHOOK_URL` (Slack/Discord/any JSON
incoming webhook) and always mirrors to `console.error`. Best-effort; never
throws. Set `OPS_ALERT_WEBHOOK_URL` in Vercel env to receive pages.

Currently fires on:
- **Gmail watch renewal failure** (`cron/renew-watches`) — a lapsed watch stops
  real-time labeling until the poll fallback catches up.
- **Poll cron total failure** (`gmail/poll`) — e.g. DB unreachable. Per-message
  classification errors are handled inline and intentionally don't page.

## Cron jobs (see `vercel.json`)

| Path | Schedule (UTC) | Purpose | Alerts on failure |
|------|----------------|---------|-------------------|
| `/api/gmail/poll` | every 30 min | Fallback label sweep | ✅ total failure |
| `/api/cron/renew-watches` | 07:00 daily | Renew Gmail Pub/Sub watches | ✅ |
| `/api/cron/awards` | 08:00 daily | Badge/milestone awards | ⚠️ console only |

## Follow-ups (not yet done)

- Add ops alert to `cron/awards` total failure (currently console-only).
- Consider an alert when trailing-24h AI spend crosses a **warning** threshold
  (e.g. 80% of `AI_GLOBAL_COST_DAY`) so you hear about it before the guard trips.
- `@vercel/otel` traces (per CLAUDE.md) for request-level observability.
