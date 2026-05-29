import Link from "next/link";

const SECTIONS = [
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
