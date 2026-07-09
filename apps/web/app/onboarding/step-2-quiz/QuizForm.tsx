"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "../../components/ui/Card";
import { ROLE_OPTIONS } from "../../../lib/rolePresets";

type City = { name: string; state: string; lat: number; lng: number; timezone: string };

type Props = {
  initialName: string;
  initialRole: string | null;
  initialCity: { query: string; name: string; state: string } | null;
};

export default function QuizForm({ initialName, initialRole, initialCity }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState<string | null>(initialRole);
  const [cityQuery, setCityQuery] = useState(initialCity?.query ?? "");
  const [selectedCity, setSelectedCity] = useState<{ name: string; state: string } | null>(
    initialCity ? { name: initialCity.name, state: initialCity.state } : null,
  );
  const [matches, setMatches] = useState<City[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = cityQuery.trim();
    // Don't re-query while a picked city is still showing in the field.
    if (!q || selectedCity) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/geo/cities?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: { matches: City[] }) => {
        if (!cancelled) setMatches(d.matches ?? []);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [cityQuery, selectedCity]);

  async function submit() {
    if (!role || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/advance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: 2,
          role,
          firstName: name.trim() || undefined,
          city: selectedCity ? { name: selectedCity.name, state: selectedCity.state } : undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
      setSubmitting(false);
      return;
    }

    // Kick tone sampling now (fire-and-forget) so it's ready by the personalize
    // step. Sequenced before the label back-scan (which runs there) to avoid
    // contending for the shared AI budget.
    void fetch("/api/preferences/tone/sync", { method: "POST" }).catch(() => {});

    router.push("/onboarding/step-3-personalize");
  }

  return (
    <Card variant="elevated">
      <div className="space-y-5">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
            Your first name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            className="mt-2 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/30"
          />
        </label>

        <div>
          <span className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
            What best describes you?
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRole(r.key)}
                aria-pressed={role === r.key}
                className={`rounded-btn border px-3 py-1.5 text-xs transition-colors ${
                  role === r.key
                    ? "border-[color:var(--border-brand)] bg-brand-400/15 text-brand-200"
                    : "border-[color:var(--border-subtle)] bg-white/[0.04] text-white/60 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-white/40">
            We use this to pick the right labels for your inbox.
          </p>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
            Your city{" "}
            <span className="text-white/30 normal-case tracking-normal">(optional)</span>
          </span>
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value);
              setSelectedCity(null);
            }}
            placeholder="Start typing, e.g. San Francisco"
            className="mt-2 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/30"
          />
          {matches.length > 0 && !selectedCity && (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-app)]">
              {matches.map((c) => (
                <li key={`${c.name}-${c.state}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCity({ name: c.name, state: c.state });
                      setCityQuery(`${c.name}, ${c.state}`);
                      setMatches([]);
                    }}
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
        </div>

        {error && <p className="text-[11px] text-red-300">{error}</p>}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/onboarding/step-1-connect")}
            disabled={submitting}
            className="rounded-btn px-3 py-2 text-sm text-white/50 transition-colors hover:text-white disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!role || submitting}
            className="rounded-btn bg-brand-400 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            {submitting ? "Setting up…" : "Continue"}
          </button>
        </div>
      </div>
    </Card>
  );
}
