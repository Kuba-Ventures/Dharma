"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

type Props = {
  initial: {
    toneProfile: string | null;
    toneSummary: string | null;
    toneExample: string | null;
  };
};

export default function ToneTrainer({ initial }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "training" | "done" | "error">(
    initial.toneProfile ? "done" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState(initial.toneSummary ?? initial.toneProfile);
  const [example, setExample] = useState(initial.toneExample);

  async function train() {
    setStatus("training");
    setError(null);
    try {
      const res = await fetch("/api/preferences/tone/sync", { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Training failed");
      }
      const data = (await res.json()) as { summary?: string; example?: string };
      if (data.summary) setSummary(data.summary);
      if (data.example) setExample(data.example);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Training failed");
      setStatus("error");
    }
  }

  async function next() {
    await fetch("/api/onboarding/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ step: 3 }),
    });
    router.push("/onboarding/step-4-labels");
  }

  return (
    <div className="space-y-4">
      <Card variant="elevated">
        {status === "idle" && (
          <>
            <p className="text-sm text-white">
              Ready when you are. This takes about 20 seconds.
            </p>
            <Button variant="primary" onClick={train} className="mt-3">
              Train tone
            </Button>
          </>
        )}

        {status === "training" && (
          <>
            <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-400" />
            </div>
            <p className="text-sm text-white/70">
              Reading your sent mail and listening for patterns…
            </p>
          </>
        )}

        {status === "done" && summary && (
          <>
            <p className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
              Your voice, summarized
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white">{summary}</p>
            {example && (
              <pre className="mt-4 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.04] p-3 font-sans text-[12px] text-white/70">
                {example}
              </pre>
            )}
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-sm text-[color:var(--label-3)]">{error}</p>
            <Button variant="secondary" onClick={train} className="mt-3">
              Try again
            </Button>
          </>
        )}
      </Card>

      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={status !== "done"}
          onClick={next}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
