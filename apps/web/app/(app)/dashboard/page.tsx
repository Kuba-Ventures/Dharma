import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { effectiveNextLockedMilestone } from "../../../lib/milestoneResolution";
import { applyTemplate } from "../../../lib/milestones";
import { getRecentActivity } from "../../../lib/recentActivity";
import Greeting from "../../components/dashboard/Greeting";
import TierStrip from "../../components/dashboard/TierStrip";
import SyncInboxButton from "../../components/dashboard/SyncInboxButton";
import NextMilestoneStrip from "../../components/dashboard/NextMilestoneStrip";
import ActivityFeed from "../../components/dashboard/ActivityFeed";
import SignalsPeek from "../../components/dashboard/SignalsPeek";
import DashboardMetrics from "../../components/dashboard/DashboardMetrics";
import ConfigStatusCard from "../../components/dashboard/ConfigStatusCard";
import NpsPrompt from "../../components/dashboard/NpsPrompt";

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

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    user,
    labelPreset,
    mappingCount,
    meetingHourCount,
    draftCount,
    recentSignals,
    unreadSignalCount,
    activity,
    taggedThisWeek,
  ] = await Promise.all([
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
        cumulativeSecondsSaved: true,
        homeCity: true,
      },
    }),
    prisma.labelPreset.findUnique({ where: { userId } }),
    prisma.labelMapping.count({ where: { userId } }),
    prisma.meetingHour.count({ where: { userId } }),
    prisma.usageEvent.count({ where: { userId, eventType: "draft" } }),
    prisma.signal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        kind: true,
        createdAt: true,
        threadId: true,
        payload: true,
      },
    }),
    prisma.signal.count({ where: { userId, readAt: null } }),
    getRecentActivity(userId, 10),
    prisma.classifiedThread.count({
      where: { userId, classifiedAt: { gte: weekAgo }, labelName: { not: null } },
    }),
  ]);

  if (!user) redirect("/login");

  const firstName =
    user.firstName ?? user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";

  const toneActive = !!user.tone;
  const labelsActive = labelPreset?.enabled ?? false;
  const schedulingActive = user.schedulingEnabled;

  // Resolve next milestone server-side so the dashboard renders without a
  // client fetch flash.
  const nextMilestoneRaw = await effectiveNextLockedMilestone(
    user.cumulativeSecondsSaved,
    user.homeCity,
  );
  const nextMilestone = nextMilestoneRaw
    ? {
        id: nextMilestoneRaw.id,
        title: applyTemplate(nextMilestoneRaw.title, {
          firstName,
          city: user.homeCity,
        }),
        threshold: nextMilestoneRaw.threshold,
      }
    : null;
  const showNps =
    draftCount >= 10 &&
    (!user.nextNpsPromptAt || user.nextNpsPromptAt < new Date());

  return (
    <div className="space-y-6">
      {/* Header: greeting + Sync inbox + tier strip */}
      <header className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <Greeting
            firstName={firstName}
            email={user.email ?? ""}
            timezone={user.timezone}
          />
          <SyncInboxButton />
        </div>
        <TierStrip cumulativeSecondsSaved={user.cumulativeSecondsSaved} />
      </header>

      {/* Running for you */}
      <section>
        <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Running for you
        </p>
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
                ? `${mappingCount} provisioned · ${taggedThisWeek} tagged this week`
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
      </section>

      {/* This week */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
            This week
          </p>
          <Link
            href="/metrics"
            className="text-[11px] text-white/50 hover:text-white/80"
          >
            Click to expand →
          </Link>
        </div>
        <DashboardMetrics />
      </section>

      {showNps && <NpsPrompt firstName={firstName} />}

      <NextMilestoneStrip
        next={nextMilestone}
        cumulativeSecondsSaved={user.cumulativeSecondsSaved}
      />

      {/* Recent activity */}
      <section>
        <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Recent activity
        </p>
        <ActivityFeed events={activity} />
      </section>

      {/* Worth your attention */}
      <SignalsPeek signals={recentSignals} unreadCount={unreadSignalCount} />
    </div>
  );
}
