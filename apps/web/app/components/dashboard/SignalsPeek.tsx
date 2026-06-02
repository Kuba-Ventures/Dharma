// Worth-your-attention surface on the dashboard. Renders unread signal count
// + the 3 most recent and a "View all" link to /signals.

import Link from "next/link";

type SignalRow = {
  id: string;
  kind: string;
  createdAt: Date;
  threadId: string | null;
  payload: unknown;
};

type Props = {
  signals: SignalRow[];
  unreadCount: number;
};

const KIND_LABEL: Record<string, string> = {
  deal_flow: "Deal flow",
  term_sheet: "Term sheet",
  transaction: "Transaction",
  buried_intent: "Buried intent",
  cold_thread: "Cold thread",
};

const KIND_CHIP: Record<string, string> = {
  deal_flow: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  term_sheet: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  transaction: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  buried_intent: "bg-violet-500/15 text-violet-200 border-violet-500/30",
  cold_thread: "bg-slate-500/15 text-slate-200 border-slate-500/30",
};

function relativeTime(then: Date): string {
  const seconds = Math.max(1, Math.round((Date.now() - then.getTime()) / 1000));
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function SignalsPeek({ signals, unreadCount }: Props) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
            Worth your attention
          </p>
          {unreadCount > 0 && (
            <span className="rounded-full bg-brand-400/20 px-2 py-0.5 text-[10px] text-brand-100">
              {unreadCount} new
            </span>
          )}
        </div>
        <Link
          href="/signals"
          className="text-[11px] text-white/50 hover:text-white/80"
        >
          View all →
        </Link>
      </div>

      {signals.length === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5 text-center">
          <p className="text-sm text-white/50">
            Coming soon. Dharma will surface buried intent and cold threads here
            as they come in.{" "}
            <Link href="/signals" className="text-brand-200 hover:text-brand-100">
              See examples
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {signals.map((s) => {
            const payload = (s.payload ?? {}) as {
              subject?: string;
              from?: string;
              summary?: string;
            };
            const kindLabel = KIND_LABEL[s.kind] ?? s.kind;
            const chip =
              KIND_CHIP[s.kind] ?? "bg-white/10 text-white/70 border-white/20";
            const inner = (
              <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${chip}`}
                  >
                    {kindLabel}
                  </span>
                  <span className="text-[11px] text-white/35">
                    {relativeTime(s.createdAt)}
                  </span>
                </div>
                {payload.subject && (
                  <p className="truncate text-sm text-white">{payload.subject}</p>
                )}
                {payload.summary && (
                  <p className="mt-0.5 truncate text-[12px] text-white/55">
                    {payload.summary}
                  </p>
                )}
              </div>
            );
            return (
              <li key={s.id}>
                {s.threadId ? (
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${s.threadId}`}
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
    </section>
  );
}
