import { redirect } from "next/navigation";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import HiddenStatsList from "./HiddenStatsList";
import SettingsBackLink from "../../../components/settings/SettingsBackLink";

const TILE_LABELS: Record<string, string> = {
  "metric-drafts-week": "Drafts this week",
  "metric-reply-rate": "Reply rate (7d)",
  "metric-time-saved": "Time saved (week)",
  "milestone-hero-welcome": "Welcome milestone",
  "metrics-replyrate-hero": "Reply rate hero",
  "metrics-timesaved-chart": "Time saved chart",
  "metrics-by-label": "Volume by label",
};

export default async function HiddenStatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dismissedTiles: true },
  });
  if (!user) redirect("/login");

  // Best-effort label lookup for dismissed tiles. Anything that starts with a
  // known prefix gets a friendly label; everything else shows the raw id so
  // the user can still restore it.
  const items = user.dismissedTiles.map((id) => ({
    id,
    label:
      TILE_LABELS[id] ??
      (id.startsWith("milestone-hero-")
        ? `Milestone hero (${id.replace("milestone-hero-", "")})`
        : id),
  }));

  return (
    <div className="max-w-3xl">
      <SettingsBackLink />
      <header className="mb-6">
        <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Hidden stats
        </p>
        <h1 className="font-display text-3xl text-white">Restore dismissed tiles</h1>
        <p className="mt-2 text-sm text-white/60">
          Anything you've dismissed from the Dashboard or Metrics page lives
          here. Restore individual tiles or clear everything.
        </p>
      </header>

      <HiddenStatsList items={items} />
    </div>
  );
}
