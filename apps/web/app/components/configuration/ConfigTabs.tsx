"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export type ConfigSection = {
  key: string;
  label: string;
  node: ReactNode;
};

// Segmented control that swaps between the configuration sections (Tone,
// Labels, Scheduling, Signals). All sections stay mounted and inactive ones
// are hidden, so switching is instant and in-progress edits survive a switch.
// The active section is mirrored to a `?section=` query param so links,
// refreshes, and the /signals redirect all land on the right tab.
export default function ConfigTabs({
  sections,
  defaultKey,
}: {
  sections: ConfigSection[];
  defaultKey?: string;
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
    <>
      <div className="mb-6 flex justify-center">
        <div
          role="tablist"
          aria-label="Configuration section"
          data-tour="config-tabs"
          className="inline-flex flex-wrap justify-center gap-1 rounded-btn border border-[color:var(--border-subtle)] bg-black/30 p-1"
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
                    ? "border border-[color:var(--border-brand)] bg-brand-400/15 text-white"
                    : "border border-transparent text-white/55 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {sections.map((s) => (
        <div key={s.key} role="tabpanel" hidden={s.key !== active}>
          {s.node}
        </div>
      ))}
    </>
  );
}
