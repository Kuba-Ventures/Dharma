"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "../../components/ui/Card";

type City = {
  name: string;
  state: string;
  lat: number;
  lng: number;
  timezone: string;
};

type Props = {
  initial: string;
  detectedTimezone: string;
};

export default function CityPicker({ initial, detectedTimezone }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initial);
  const [matches, setMatches] = useState<City[]>([]);
  const [selected, setSelected] = useState<City | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/geo/cities?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: { matches: City[] }) => {
        if (!cancelled) setMatches(d.matches);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function confirm(city: City) {
    setSelected(city);
    setSaving(true);
    await fetch("/api/onboarding/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        step: 2,
        city: { name: city.name, state: city.state },
      }),
    });
    setSaving(false);
    router.push("/onboarding/step-3-tone");
  }

  return (
    <Card variant="elevated">
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
          Your city
        </span>
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          placeholder="Start typing — e.g. San Francisco, Boston, Austin"
          className="mt-2 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/30"
        />
      </label>

      {matches.length > 0 && !selected && (
        <ul className="mt-3 max-h-56 overflow-y-auto rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-app)]">
          {matches.map((c) => (
            <li key={`${c.name}-${c.state}`}>
              <button
                onClick={() => confirm(c)}
                disabled={saving}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/[0.05]"
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

      <p className="mt-3 text-[11px] text-white/40">
        We detected your timezone as{" "}
        <span className="text-brand-200">{detectedTimezone}</span>. Pick a city
        to confirm — you can change this any time in Settings → Profile.
      </p>
    </Card>
  );
}
