import Link from "next/link";

// Live Google Workspace Marketplace listing for the Dharma Gmail add-on.
const MARKETPLACE_URL =
  "https://workspace.google.com/marketplace/app/dharma/63757021962";

const SECTIONS = [
  {
    href: "/dashboard?tour=1",
    title: "Replay the product tour",
    description: "Walk through the dashboard features again for a refresher.",
  },
  {
    href: "/settings/hidden-stats",
    title: "Hidden stats",
    description: "Restore dashboard tiles you've dismissed.",
  },
  {
    href: "/settings/advanced",
    title: "Advanced",
    description: "Chrome extension token and other power-user options.",
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Settings
        </p>
        <h1 className="font-display text-3xl text-white">Account and preferences</h1>
      </header>

      <section className="mb-4 rounded-card border border-[color:var(--border-brand)] bg-brand-400/[0.06] p-5">
        <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Get Dharma in Gmail
        </p>
        <h2 className="mt-1 font-display text-base text-white">
          Install the Gmail add-on
        </h2>
        <p className="mt-1 text-[12px] text-white/55">
          Draft replies right inside Gmail&apos;s sidebar. Labeling and sorting
          already run automatically. This adds the in-Gmail compose experience.
        </p>
        <ol className="mt-3 space-y-1.5 text-[12px] text-white/50">
          <li>
            1. Open the Workspace Marketplace listing, click{" "}
            <span className="text-white/70">Install</span>, and approve the Google
            permissions.
          </li>
          <li>2. Reload Gmail, and the Dharma icon appears in the right sidebar.</li>
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={MARKETPLACE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-btn border border-[color:var(--border-brand)] bg-brand-400/15 px-4 py-2 text-sm font-medium text-brand-100 transition-colors hover:bg-brand-400/25"
          >
            Install the Gmail add-on ↗
          </a>
        </div>
      </section>

      <div className="space-y-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-start justify-between gap-4 rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-4 transition-colors hover:bg-[color:var(--bg-card-elevated)]"
          >
            <div>
              <p className="font-display text-base text-white">{s.title}</p>
              <p className="mt-0.5 text-[12px] text-white/50">{s.description}</p>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="mt-1 text-white/30"
            >
              <path
                d="M5 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
