# AI cost / abuse guardrails

Every Anthropic call path is gated by `apps/web/lib/aiGuard.ts`, built on the
`UsageEvent` cost data that `logUsage()` already records. This protects the
Anthropic bill once signup is open to the public (task #8).

## Layers

1. **Kill switch** — set `AI_DISABLED=true` to block every AI path instantly
   (incident lever). User routes return 503; pipelines (classify/signal) skip.
2. **Global spend ceiling** — total spend across ALL users in the trailing 24h.
   Once hit, user routes return 503 and pipelines pause until spend rolls off.
3. **Per-user limits** — burst (per-minute), daily action count, and daily
   cost, sized by plan (free vs paid). User routes return 429.

Checks are trailing (read already-logged usage), so a call may overshoot a cap
by at most one call's cost. This keeps the guard off the AI request's hot path.

## Where it's wired

| Path | Type | Guard |
|------|------|-------|
| `api/emails/thread-draft` | user | `checkAiGuard` → 429/503 |
| `api/emails/[id]/draft` | user | `checkAiGuard` |
| `api/preferences/tone/sample` | user | `checkAiGuard` |
| `api/preferences/tone/sync` | user | `checkAiGuard` |
| `api/calendar/google/schedule` | user | `checkAiGuard` |
| `api/calendar/rsvp` (reschedule only) | user | `checkAiGuard` |
| `lib/classify.ts` (`callClaude` choke point) | pipeline | `pipelineAiAllowed` → skip |
| `lib/signalDetector.ts` | pipeline | `pipelineAiAllowed` (+ existing `SIGNAL_DAILY_LIMIT`) |

## Environment variables (all optional; sane defaults)

| Var | Default | Meaning |
|-----|---------|---------|
| `AI_DISABLED` | `false` | `true` blocks all AI |
| `AI_GLOBAL_COST_DAY` | `50` | Global trailing-24h USD ceiling |
| `AI_FREE_PER_MIN` | `8` | Free: max AI actions / 60s |
| `AI_FREE_PER_DAY` | `60` | Free: max AI actions / 24h |
| `AI_FREE_COST_DAY` | `0.75` | Free: max USD / 24h |
| `AI_PAID_PER_MIN` | `30` | Paid: max AI actions / 60s |
| `AI_PAID_PER_DAY` | `600` | Paid: max AI actions / 24h |
| `AI_PAID_COST_DAY` | `8` | Paid: max USD / 24h |
| `AI_PAID_USER_IDS` | (empty) | Comma-separated user ids treated as paid |

## The Stripe seam

`planForUser(userId)` is the only place that decides free vs paid. Until
billing (task #7) lands, it reads the `AI_PAID_USER_IDS` allowlist. Replace its
body with a real entitlement lookup once Stripe exists — nothing else changes.

## Follow-ups

- The global-ceiling query sums `UsageEvent.costUsd` by `createdAt` alone; add a
  `@@index([createdAt])` before high volume (a Prisma migration — escalate).
- Consider surfacing a friendly "daily limit reached" UI state on the client
  when a 429 with code `rate_daily` / `cost_daily` comes back.
