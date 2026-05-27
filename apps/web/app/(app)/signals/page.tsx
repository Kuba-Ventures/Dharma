import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export default async function SignalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const signals = await prisma.signal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Signals
        </p>
        <h1 className="font-display text-3xl text-white">Worth your attention</h1>
        <p className="mt-2 text-sm text-white/60">
          Emails Dharma flags as containing deal, term-sheet, or transactional
          language — separate from rule-based labels. Detection lands in a
          follow-up; this surface is here so the table and badge are wired.
        </p>
      </header>

      {signals.length === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-8 text-center">
          <p className="text-sm text-white/50">
            No signals yet. We'll surface emails here when Dharma spots
            something worth your attention.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {signals.map((s) => (
            <li
              key={s.id}
              className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white">{s.kind}</p>
                <p className="text-[11px] text-white/40">
                  {new Date(s.createdAt).toLocaleString()}
                </p>
              </div>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-[12px] text-white/60">
                {JSON.stringify(s.payload, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
