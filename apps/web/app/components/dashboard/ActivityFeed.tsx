// Recent activity feed for the dashboard. Server-rendered mixed event stream
// (drafts + signals + recent classifications with label chips). Replaces the
// InboxPanel slot.

import { groupActivity, type ActivityEvent } from "../../../lib/activityGrouping";

type Props = {
  events: ActivityEvent[];
};

function relativeTime(then: Date): string {
  const seconds = Math.max(1, Math.round((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}

function eventIcon(kind: ActivityEvent["kind"]) {
  switch (kind) {
    case "draft":
      return (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 11l8-8 1.5 1.5L3.5 12.5 2 12V11z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "signal":
      return (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1l1.6 4.4L13 7l-4.4 1.6L7 13l-1.6-4.4L1 7l4.4-1.6L7 1z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "classified":
      return (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path
            d="M2.5 3h5.5L11 5.5 8 8H2.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

function tintForKind(kind: ActivityEvent["kind"]): string {
  switch (kind) {
    case "draft":
      return "text-brand-200";
    case "signal":
      return "text-amber-200";
    case "classified":
      return "text-white/45";
  }
}

export default function ActivityFeed({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-6 text-center">
        <p className="text-sm text-white/50">
          Nothing yet. Activity will show here as Dharma drafts, classifies, and
          spots signals.
        </p>
      </div>
    );
  }

  const rows = groupActivity(events);

  return (
    <ul className="divide-y divide-white/[0.06] rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)]">
      {rows.map((e, i) => (
        <li key={`${e.kind}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
          <span className={tintForKind(e.kind)}>{eventIcon(e.kind)}</span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {e.kind === "classified" && e.count > 1 && (
              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-1.5 text-[10px] tabular-nums text-white/50">
                {e.count}
              </span>
            )}
            <span className="truncate text-[13px] text-white/80">
              {e.kind === "draft"
                ? e.count === 1
                  ? "Drafted a reply"
                  : `Drafted ${e.count} replies`
                : e.kind === "classified"
                  ? e.count === 1
                    ? "Classified a thread"
                    : `Classified ${e.count} threads`
                  : e.title}
            </span>
          </span>
          {e.kind === "classified" && e.labelName && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
              style={{
                backgroundColor: e.labelColor ? `${e.labelColor}22` : "rgba(255,255,255,0.08)",
                color: e.labelColor ?? "rgba(255,255,255,0.6)",
              }}
            >
              {e.labelName}
            </span>
          )}
          <span className="shrink-0 text-[11px] text-white/35">
            {relativeTime(e.at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
