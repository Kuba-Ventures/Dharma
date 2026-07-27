"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Badge } from "../../../lib/badges";
import {
  BADGE_ICON_PATHS,
  BADGE_COLOR_BG,
  JEWEL_FILL,
  JEWEL_STROKE,
} from "../../../lib/badgeIcons";

type City = { name: string; state: string };

type Props = {
  user: {
    image: string | null;
    name: string | null;
    firstName: string | null;
    email: string | null;
    homeCity: string | null;
    timezone: string | null;
    createdAt: string;
  };
  displayBadge: Badge | null;
};

export default function IdentityCard({
  user,
  displayBadge,
}: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName ?? user.name?.split(" ")[0] ?? "");
  const [cityQuery, setCityQuery] = useState(user.homeCity ?? "");
  const [cityMatches, setCityMatches] = useState<Array<City & { timezone: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [imageBroken, setImageBroken] = useState(false);

  async function searchCity(q: string) {
    setCityQuery(q);
    if (!q.trim()) {
      setCityMatches([]);
      return;
    }
    const res = await fetch(`/api/geo/cities?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const d = (await res.json()) as { matches: Array<City & { timezone: string }> };
      setCityMatches(d.matches);
    }
  }

  async function selectCity(c: City) {
    setCityQuery(`${c.name}, ${c.state}`);
    setCityMatches([]);
    setSaving(true);
    await fetch("/api/profile/update", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ homeCity: c }),
    });
    setSaving(false);
    setSavedAt(Date.now());
    router.refresh();
  }

  // Fallback when the typed city isn't in the autocomplete list — small
  // towns and non-US cities. Parses "City, State" if the comma is present;
  // otherwise saves the whole string as the name. /api/profile/update keeps
  // it as free text (no lat/lng/timezone seeding).
  async function saveTypedCity() {
    const value = cityQuery.trim();
    if (!value || value === user.homeCity) return;
    // Skip if the typed value matches a dropdown option exactly — selectCity
    // will fire on click.
    if (cityMatches.some((c) => `${c.name}, ${c.state}` === value)) return;
    const [name, state] = value.split(",").map((s) => s.trim());
    setSaving(true);
    await fetch("/api/profile/update", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ homeCity: { name, state: state || "" } }),
    });
    setSaving(false);
    setSavedAt(Date.now());
    router.refresh();
  }

  async function saveName() {
    setSaving(true);
    await fetch("/api/profile/update", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName }),
    });
    setSaving(false);
    setSavedAt(Date.now());
    router.refresh();
  }

  const initials = (user.firstName ?? user.name ?? user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          {user.image && !imageBroken ? (
            // Plain <img> bypasses Next.js Image's domain rules. Google avatar
            // URLs occasionally fail (CORS, expired token); onError falls back
            // to the initials circle.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "You"}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover"
              onError={() => setImageBroken(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-400/30 text-2xl font-medium text-brand-100">
              {initials}
            </div>
          )}
          {displayBadge && (
            <span
              aria-label={displayBadge.title}
              className={`absolute -bottom-3 -right-3 ${displayBadge.color === "yellow" ? "" : BADGE_COLOR_BG[displayBadge.color].split(" ").filter((c) => c.startsWith("text-")).join(" ")}`}
            >
              {displayBadge.iconImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayBadge.iconImage} alt="" width={42} height={42} />
              ) : (
                <svg width="42" height="42" viewBox="0 0 14 14" fill="none">
                  <path
                    d={BADGE_ICON_PATHS[displayBadge.icon]}
                    stroke={JEWEL_STROKE[displayBadge.color]}
                    strokeWidth={displayBadge.color === "yellow" ? 1.6 : 1.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill={JEWEL_FILL[displayBadge.color]}
                    fillOpacity={1}
                  />
                </svg>
              )}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/40">
              First name
            </p>
            <div className="flex gap-2">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={saveName}
                className="flex-1 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-2 text-sm text-white"
              />
            </div>
            <p className="mt-0.5 text-[11px] text-white/40">{user.email}</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/40">
              Home city
            </p>
            <input
              value={cityQuery}
              onChange={(e) => searchCity(e.target.value)}
              onBlur={saveTypedCity}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveTypedCity();
                }
              }}
              placeholder="e.g. San Francisco, CA"
              className="w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-2 text-sm text-white"
            />
            {cityMatches.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-app)]">
                {cityMatches.map((c) => (
                  <li key={`${c.name}-${c.state}`}>
                    <button
                      type="button"
                      onClick={() => selectCity(c)}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-white/80 hover:bg-white/[0.05]"
                    >
                      <span>
                        {c.name}, {c.state}
                      </span>
                      <span className="text-[11px] text-white/40">{c.timezone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {cityQuery.trim() && cityMatches.length === 0 && cityQuery !== user.homeCity && (
              <p className="mt-1 text-[11px] text-white/50">
                Not in our list. Press Enter or tab away to save{" "}
                <span className="text-brand-200">{cityQuery}</span> as typed.
              </p>
            )}
            {user.timezone && (
              <p className="mt-1 text-[11px] text-white/40">
                Timezone: <span className="text-brand-200">{user.timezone}</span>
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-white/30">
            Joined {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      {savedAt && (
        <p className="mt-3 text-[11px] text-[color:var(--label-2)]">Saved.</p>
      )}
      {saving && (
        <p className="mt-3 text-[11px] text-white/40">Saving…</p>
      )}

      <p className="mt-4 rounded-btn border border-[color:var(--border-brand)] bg-brand-400/8 px-3 py-2 text-[11px] text-white/60">
        Dharma never shares your name, email, or city. Local data only, used to set your time zone.
      </p>
    </div>
  );
}
