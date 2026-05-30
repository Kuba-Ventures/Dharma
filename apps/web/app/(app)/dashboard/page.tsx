import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import Greeting from "../../components/dashboard/Greeting";
import MilestoneHero from "../../components/dashboard/MilestoneHero";
import DashboardMetrics from "../../components/dashboard/DashboardMetrics";
import ConfigStatusCard from "../../components/dashboard/ConfigStatusCard";
import QuickActions from "../../components/dashboard/QuickActions";
import NpsPrompt from "../../components/dashboard/NpsPrompt";
import InboxPanel from "../../components/InboxPanel";

const TONE_ICON = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 5v4M5 6v3M8 3v8M11 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const LABELS_ICON = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2.5 3h5.5L11 5.5 8 8H2.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
  </svg>
);
const CAL_ICON = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="3.5" width="10" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.4" fill="none" />
    <line x1="2" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [user, labelPreset, mappingCount, meetingHourCount, draftCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        name: true,
        email: true,
        timezone: true,
        tone: true,
        toneProfile: true,
        schedulingEnabled: true,
        nextNpsPromptAt: true,
      },
    }),
    prisma.labelPreset.findUnique({ where: { userId } }),
    prisma.labelMapping.count({ where: { userId } }),
    prisma.meetingHour.count({ where: { userId } }),
    prisma.usageEvent.count({ where: { userId, eventType: "draft" } }),
  ]);

  if (!user) redirect("/login");

  const firstName =
    user.firstName ?? user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";

  const toneActive = !!user.tone;
  const labelsActive = labelPreset?.enabled ?? false;
  const schedulingActive = user.schedulingEnabled;

  // Show the NPS card once the user has real product experience and we're not
  // in a cooldown window from a previous prompt.
  const showNps =
    draftCount >= 10 &&
    (!user.nextNpsPromptAt || user.nextNpsPromptAt < new Date());

  return (
    <div className="space-y-6">
      <Greeting
        firstName={firstName}
        email={user.email ?? ""}
        timezone={user.timezone}
      />

      <MilestoneHero />

      {showNps && <NpsPrompt firstName={firstName} />}

      <DashboardMetrics />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ConfigStatusCard
          icon={TONE_ICON}
          iconTone="brand"
          title="Tone"
          status={toneActive ? "Active" : "Paused"}
          stat={
            toneActive
              ? user.toneProfile
                ? "Trained on your sent mail"
                : `Using "${user.tone}" preset`
              : "Drafts use a neutral default"
          }
        />
        <ConfigStatusCard
          icon={LABELS_ICON}
          iconTone="brand-deep"
          title="Labels"
          status={labelsActive ? "Active" : "Paused"}
          stat={
            labelsActive
              ? `${mappingCount} provisioned in Gmail`
              : "Not classifying new mail"
          }
        />
        <ConfigStatusCard
          icon={CAL_ICON}
          iconTone="brand-deeper"
          title="Scheduling"
          status={schedulingActive ? "Active" : "Paused"}
          stat={
            schedulingActive
              ? meetingHourCount > 0
                ? `${meetingHourCount} day${meetingHourCount === 1 ? "" : "s"} with hours set`
                : "Set meeting hours in Configuration"
              : "Not proposing times"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_1fr]">
        <QuickActions />
        <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-4">
          <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-brand-200">
            Recent activity
          </p>
          <InboxPanel selectedTone={user.tone} />
        </div>
      </div>
    </div>
  );
}
