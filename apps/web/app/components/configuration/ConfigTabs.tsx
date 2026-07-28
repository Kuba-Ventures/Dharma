"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export type ConfigSection = {
  key: string;
  label: string;
  node: ReactNode;
};

// Unified configuration panel: the page header (eyebrow + title + subtitle),
// the section tabs, and the active section's content all live inside one
// bordered card, so nothing floats in dead space. All sections stay mounted
// and inactive ones are hidden, so switching is instant and in-progress edits
// survive a switch. The active section is mirrored to a `?section=` query param
// so links, refreshes, and the /signals redirect all land on the right tab.
export default function ConfigTabs({
  sections,
  defaultKey,
  eyebrow,
  title,
  subtitle,
}: {
  sections: ConfigSection[];
  defaultKey?: string;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const keys = sections.map((s) => s.key);
  const requested = params.get("section");
  const active =
    requested && keys.includes(requested) ? requested : defaultKey ?? keys[0];

  function select(key: string) {
    if (key === active) return;
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("section", key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="overflow-hidden rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)]">
      {/* Header banner — a subtle brand wash makes the title read as a hero
          rather than floating loose above the tabs. */}
      <div
        className="border-b border-[color:var(--border-subtle)] px-6 py-5"
        style={{
          backgroundImage:
            "radial-gradient(120% 150% at 0% 0%, rgba(127,119,221,0.22), transparent 55%), linear-gradient(180deg, rgba(127,119,221,0.10), transparent)",
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-200">
          {eyebrow}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-2 text-sm text-white/55">{subtitle}</p>
      </div>

      {/* Centered tabs, attached to the panel so they read as part of it. */}
      <div
        role="tablist"
        aria-label="Configuration section"
        data-tour="config-tabs"
        className="flex flex-wrap justify-center gap-1 border-b border-[color:var(--border-subtle)] bg-black/20 px-4 py-2.5"
      >
        {sections.map((s) => {
          const on = s.key === active;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(s.key)}
              className={`rounded-btn px-4 py-2 text-sm transition-colors ${
                on
                  ? "bg-[color-mix(in_srgb,var(--brand-400)_15%,transparent)] text-white"
                  : "text-white/55 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {sections.map((s) => (
          <div key={s.key} role="tabpanel" hidden={s.key !== active}>
            {s.node}
          </div>
        ))}
      </div>
    </div>
  );
}
