import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import StepShell from "../components/StepShell";
import Card from "../../components/ui/Card";

// Live Google Workspace Marketplace listing for the Dharma Gmail add-on.
const MARKETPLACE_URL =
  "https://workspace.google.com/marketplace/app/dharma/63757021962";

export default async function StepFive() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Final step: stamp completion and release the user to the dashboard. Mirrors
  // the server-action pattern used by step 1.
  async function finish() {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    await prisma.user.update({
      where: { id: s.user.id },
      data: { onboardingCompletedAt: new Date(), onboardingStep: 4 },
    });
    redirect("/dashboard");
  }

  return (
    <StepShell
      step={4}
      total={5}
      eyebrow="Welcome to Dharma"
      title="What Dharma does, and one quick install"
      description="A 20-second tour, then add Dharma to Gmail. Your dashboard unlocks right after."
    >
      <div className="space-y-2.5">
        <FeatureRow
          title="Smart labels"
          body="New mail is sorted automatically into the preset labels you just picked, inside your own Gmail."
        />
        <FeatureRow
          title="Replies in your voice"
          body="Dharma drafts on-brand responses you can edit and send. Nothing goes out without you."
        />
        <FeatureRow
          title="Scheduling, handled"
          body="Back-and-forth scheduling threads become ready-to-send time proposals from your calendar."
        />
      </div>

      <Card variant="elevated" className="mt-5">
        <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Add Dharma to Gmail
        </p>
        <p className="mt-2 text-sm text-white/70">
          Install the Gmail add-on to draft replies right inside Gmail&apos;s
          sidebar. Labeling and sorting already work without it. This adds the
          in-Gmail compose experience.
        </p>
        <ol className="mt-3 space-y-1.5 text-[12px] text-white/50">
          <li>
            1. Open the Workspace Marketplace listing, click{" "}
            <span className="text-white/70">Install</span>, and approve the Google
            permissions.
          </li>
          <li>2. Reload Gmail, and the Dharma icon appears in the right sidebar.</li>
        </ol>
        <a
          href={MARKETPLACE_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-btn border border-[color:var(--border-brand)] bg-brand-400/15 px-4 py-2 text-sm font-medium text-brand-100 transition-colors hover:bg-brand-400/25"
        >
          Install the Gmail add-on ↗
        </a>
      </Card>

      <form action={finish} className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[12px] text-white/40">
          No rush. You can install this anytime from Support.
        </p>
        <button
          type="submit"
          className="shrink-0 rounded-btn bg-brand-400 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          Finish &amp; go to dashboard
        </button>
      </form>
    </StepShell>
  );
}

function FeatureRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-white/[0.02] px-4 py-3">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-0.5 text-[12px] text-white/55">{body}</p>
    </div>
  );
}
