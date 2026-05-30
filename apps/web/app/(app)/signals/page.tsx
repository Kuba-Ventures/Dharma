import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import type { SignalPayload } from "../../../lib/signalDetector";

// Kind chip mapping. Includes today's active kind (buried_intent), the
// reserved-but-not-yet-firing kind (cold_thread), and a legacy fallback for
// any rows persisted by the pre-rewrite detector
// (deal_flow / term_sheet / transaction).
const KIND_LABEL: Record<string, string> = {
  buried_intent: "Buried intent",
  cold_thread: "Cold thread",
  deal_flow: "Deal flow",
  term_sheet: "Term sheet",
  transaction: "Transaction",
};

const KIND_CHIP: Record<string, string> = {
  buried_intent: "bg-violet-500/15 text-violet-200 border-violet-500/30",
  cold_thread: "bg-slate-500/15 text-slate-200 border-slate-500/30",
  deal_flow: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  term_sheet: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  transaction: "bg-sky-500/15 text-sky-200 border-sky-500/30",
};

export default async function SignalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const signals = await prisma.signal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Signals
        </p>
        <h1 className="font-display text-3xl text-white">Worth your attention</h1>
        <p className="mt-2 text-sm text-white/60">
          Latent intent your inbox would otherwise bury — separate from rule-based
          labels. Cold threads (overdue replies) and pattern shifts are coming.
        </p>
      </header>

      {signals.length === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-8 text-center">
          <p className="text-sm text-white/50">
            No signals yet. We'll surface emails here when Dharma spots
            something worth your attention.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {signals.map((s) => {
            const p = (s.payload ?? {}) as Partial<SignalPayload>;
            const kindLabel = KIND_LABEL[s.kind] ?? s.kind;
            const chipClass =
              KIND_CHIP[s.kind] ?? "bg-white/10 text-white/70 border-white/20";
            const threadId = p.threadId ?? s.threadId;
            const inner = (
              <div
                className={`rounded-card border bg-[color:var(--bg-card)] p-4 ${
                  s.readAt
                    ? "border-[color:var(--border-subtle)] opacity-70"
                    : "border-brand-500/40"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${chipClass}`}
                  >
                    {kindLabel}
                  </span>
                  <p className="text-[11px] text-white/40">
                    {new Date(s.createdAt).toLocaleString()}
                  </p>
                </div>
                {p.title && (
                  <p className="text-sm font-medium text-white">{p.title}</p>
                )}
                {p.subject && (
                  <p className={`text-[12px] ${p.title ? "text-white/55" : "text-white"}`}>
                    {p.subject}
                  </p>
                )}
                {p.from && (
                  <p className="mt-0.5 text-[11px] text-white/45">{p.from}</p>
                )}
                {p.whyItMatters && (
                  <p className="mt-2 text-[13px] text-white/80">
                    {p.whyItMatters}
                  </p>
                )}
                {p.summary && !p.whyItMatters && (
                  <p className="mt-2 text-[13px] text-white/75">{p.summary}</p>
                )}
                {p.evidence && (
                  <p className="mt-2 border-l-2 border-white/15 pl-2 text-[12px] italic text-white/45">
                    "{p.evidence}"
                  </p>
                )}
              </div>
            );
            return (
              <li key={s.id}>
                {threadId ? (
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${threadId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block transition hover:brightness-110"
                  >
                    {inner}
                  </a>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
