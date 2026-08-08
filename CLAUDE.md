<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

## Merge policy

This repo runs a supervised PR factory. A PR auto-merges only when the factory review
returns `APPROVE-LOWRISK` against this policy. Auto-merge is **disabled** until the repo
variable `FACTORY_AUTOMERGE` is set to `true` (turned on only after a supervised soak).

Paths below are relative to the repo root. This is a paying client's product (Gmail/Calendar
access, OAuth, AI drafting). When in doubt, **escalate**. The reviewer
(`.claude/agents/pr-reviewer.md`) enforces this block; tighten it whenever something slips through.

**Low-risk surfaces — eligible for auto-merge** (static copy and pure helpers, covered by tests in
`apps/web/lib/*.test.ts` and `apps/web/app/{privacy,terms,support}/page.test.tsx`):

- `apps/web/app/privacy/**`, `apps/web/app/terms/**`, `apps/web/app/support/**` — static legal /
  support pages (copy + markup only).
- `apps/web/lib/timeSaved.ts` — pure time-saved math.
- `apps/web/lib/cities.ts`, `apps/web/lib/citiesExtended.ts` — pure city data + lookup helpers.
- `apps/web/lib/labelPresets.ts` — pure label-preset data + resolver (no I/O).
- `apps/web/lib/sampleScenarios.ts` — static sample-prompt data + pure selectors.

**Always escalate to a human — never auto-merge, regardless of how small the change:**

- **Auth / identity / sessions:** `apps/web/lib/auth.ts`, `apps/web/lib/auth.config.ts`,
  `apps/web/lib/extension-token.ts`, `apps/web/lib/apple-crypto.ts`, `apps/web/app/login/**`,
  `apps/web/middleware.ts`.
- **Data / DB:** `schema.prisma`, `apps/web/lib/prisma.ts`, `apps/web/lib/adapter.ts`,
  `apps/web/lib/usage.ts`, any Prisma migration.
- **Money / tiers / entitlements:** `apps/web/lib/tiers.ts`, `apps/web/lib/effectiveTier.ts`,
  `apps/web/lib/badges*.ts`, `apps/web/lib/milestone*.ts`.
- **AI behavior:** `packages/reply-generation/**`, `apps/web/lib/anthropicEndpoint.ts`,
  `apps/web/lib/classify.ts`, `apps/web/lib/signalDetector.ts`, `apps/web/app/onboarding/**`.
- **Product surfaces:** all `apps/web/app/api/**`, `apps/web/app/components/**`,
  `apps/web/lib/gmail.ts`, `apps/web/lib/calendar.ts`, `apps/web/lib/adminSheet.ts`,
  `apps/web/app/share/**`, the landing page `apps/web/app/page.tsx` (embeds the waitlist form).
- **Integrations / other apps:** `packages/providers-*/**`, `packages/calendar-core/**`,
  `packages/types/**`, `apps/gmail-addon/**`, `apps/chrome-extension/**`.
- **CI / build / deps:** `.github/**`, `apps/web/next.config.*`, `apps/web/vercel.json`,
  any `package.json` / `package-lock.json` / `tsconfig*.json`.
- **Anything not explicitly listed as low-risk above.**


<!-- BEGIN STANDARD -->
## Response style
- Lead with the concrete next action, before context or caveats.
- Number multi-step work.
- Restate what's done and what's left each turn.
- No tangents or "you might also consider."
- Time estimates as specifics ("~5 min").
- Call out completed steps explicitly.

## Design and UI work
Any product or feature change with a visual surface: present exactly three
options (A, B, C), one-line rationale each. Render them — never describe
them in prose. Build each as a working preview and open all three side by
side in a browser. `/design-shotgun` does this end to end.
Stop and wait for a choice before building anything further.

## Git workflow
- Never commit to `main`. Branch as `claude/<description>`.
- One PR per logical change — don't mix chores into feature branches.
- Delete the branch after merge.
<!-- END STANDARD -->
