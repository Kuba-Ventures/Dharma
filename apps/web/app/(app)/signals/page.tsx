import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import SignalDetectionCard from "../../components/configuration/SignalDetectionCard";

// Illustrative signals shown while detection is still rolling out. These are
// fixed examples (not the viewer's mail) so every account sees the same
// preview of what the surface will look like once producers are live.
const EXAMPLE_SIGNALS: {
  kindLabel: string;
  chipClass: string;
  title: string;
  subject: string;
  from: string;
  whyItMatters: string;
  evidence: string;
}[] = [
  {
    kindLabel: "Buried intent",
    chipClass: "bg-violet-500/15 text-violet-200 border-violet-500/30",
    title: "A founder update that's really a soft raise",
    subject: "Q2 numbers + a few updates",
    from: "Founder <founder@example.com>",
    whyItMatters:
      "Traction is up and to the right and they're name-dropping new hires. The subtext is a round is coming; a warm reply now beats a cold pitch later.",
    evidence:
      "\"We're seeing strong pull and starting to think about what's next on the team side.\"",
  },
  {
    kindLabel: "Cold thread",
    chipClass: "bg-slate-500/15 text-slate-200 border-slate-500/30",
    title: "An overdue reply that's about to go stale",
    subject: "Re: intro to the Anderson team",
    from: "Counsel <counsel@example.com>",
    whyItMatters:
      "You said you'd loop back after the call. It's been nine days and the other side is waiting, which quietly stalls the intro.",
    evidence:
      "\"No rush, but let me know once you've had a chance to connect with them.\"",
  },
  {
    kindLabel: "Buried intent",
    chipClass: "bg-violet-500/15 text-violet-200 border-violet-500/30",
    title: "An ask hidden inside a thank-you note",
    subject: "Thanks again for yesterday",
    from: "LP <lp@example.com>",
    whyItMatters:
      "Reads like a courtesy note, but the last line is a real request to be introduced to one of your portfolio companies.",
    evidence:
      "\"Would love to hear more about how the Helix team is thinking about distribution.\"",
  },
];

export default async function SignalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { signalDetectionEnabled: true },
  });

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Signals
        </p>
        <h1 className="font-display text-3xl text-white">Worth your attention</h1>
        <p className="mt-2 text-sm text-white/60">
          Latent intent your inbox would otherwise bury, kept separate from
          rule-based labels. Cold threads (overdue replies) and pattern shifts
          are coming.
        </p>
      </header>

      <div className="mb-5">
        <SignalDetectionCard
          initial={{ enabled: user?.signalDetectionEnabled ?? false }}
        />
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-[0.08em] text-white/40">
          Coming soon
        </p>
        <p className="text-[11px] text-white/35">Example signals</p>
      </div>
      <p className="mb-4 text-sm text-white/55">
        Signal surfacing is still rolling out. Here's the kind of thing Dharma
        will flag once it's live. These are examples, not your mail.
      </p>

      <ul className="space-y-2">
        {EXAMPLE_SIGNALS.map((s) => (
          <li key={s.title}>
            <div className="rounded-card border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-4 opacity-80">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${s.chipClass}`}
                  >
                    {s.kindLabel}
                  </span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/40">
                    Example
                  </span>
                </div>
              </div>
              <p className="text-sm font-medium text-white">{s.title}</p>
              <p className="text-[12px] text-white/55">{s.subject}</p>
              <p className="mt-0.5 text-[11px] text-white/45">{s.from}</p>
              <p className="mt-2 text-[13px] text-white/80">{s.whyItMatters}</p>
              <p className="mt-2 border-l-2 border-white/15 pl-2 text-[12px] italic text-white/45">
                {s.evidence}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
