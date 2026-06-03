import { auth } from "../../lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import {
  BADGES,
  getBadge,
  identityBadgesForEmail,
  earnedAchievementBadges,
  resolveBadgeId,
} from "../../lib/badges";
import { sheetIdentityBadgesForEmail } from "../../lib/adminSheet";
import { effectiveTier } from "../../lib/effectiveTier";
import Sidebar from "../components/Sidebar";
import ProfileChip from "../components/ProfileChip";
import FeedbackButton from "../components/ui/FeedbackButton";
import AppShell from "../components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      name: true,
      email: true,
      image: true,
      tier: true,
      displayBadgeId: true,
      cumulativeSecondsSaved: true,
      toneSummary: true,
      toneProfile: true,
      homeCity: true,
      onboardingCompletedAt: true,
      onboardingStep: true,
    },
  });
  if (!user) redirect("/login");

  // Bounce new users into the onboarding flow. Existing users were backfilled
  // with onboardingCompletedAt by scripts/backfill-onboarding.mjs.
  if (!user.onboardingCompletedAt) {
    const stepUrls = [
      "/onboarding/step-1-connect",
      "/onboarding/step-2-city",
      "/onboarding/step-3-tone",
      "/onboarding/step-4-labels",
      "/onboarding/step-5-install",
    ];
    redirect(stepUrls[Math.min(user.onboardingStep, stepUrls.length - 1)]);
  }

  // Signal producers aren't live yet, so the sidebar badge would only ever
  // reflect seeded test rows. Omit the count until the Signals surface ships.
  const [emailsTagged, userBadges, sheetBadgeIds, tierLabel] = await Promise.all([
    prisma.classifiedThread.count({ where: { userId: session.user.id } }),
    prisma.userBadge.findMany({
      where: { userId: session.user.id },
      select: { badgeId: true },
    }),
    sheetIdentityBadgesForEmail(user.email),
    effectiveTier(user.cumulativeSecondsSaved, user.email),
  ]);

  // Compute the display badge for the sidebar avatar. Same logic as the
  // Profile page so what the user picks there reflects in the chip too.
  // Conservative snapshot — the sidebar only needs to pick the display badge,
  // and persisted UserBadge rows already supply earned achievements after the
  // awards cron. We avoid the extra per-request queries buildSnapshot would run
  // and leave the unfetched metrics at their conservative defaults.
  const earnedIds = new Set(
    [
      ...userBadges.map((b) => b.badgeId),
      ...identityBadgesForEmail(user.email),
      ...sheetBadgeIds,
      ...earnedAchievementBadges({
        draftsGenerated: 0,
        timeSavedSec: user.cumulativeSecondsSaved,
        threadsLabeled: emailsTagged,
        toneModesUsed: 0,
        gmailConnected: false,
        calendarConnected: false,
        toneTrained: !!(user.toneSummary || user.toneProfile),
        onboardingComplete: !!user.onboardingCompletedAt,
        dealHawk: false,
        dayOne: false,
        founding100: false,
        oneYear: false,
        geoMilestone: false,
      }),
    ].map(resolveBadgeId),
  );
  const resolvedDisplayId = user.displayBadgeId ? resolveBadgeId(user.displayBadgeId) : null;
  const displayBadge =
    (resolvedDisplayId && getBadge(resolvedDisplayId) && earnedIds.has(resolvedDisplayId)
      ? getBadge(resolvedDisplayId)
      : null) ??
    BADGES.find((b) => b.kind === "identity" && earnedIds.has(b.id)) ??
    null;
  const locked = false;

  const sidebar = (
    <>
      <Link
        href="/"
        className="mb-8 flex items-center gap-2.5 px-3 transition-opacity hover:opacity-80"
      >
        <Image src="/logo.png" alt="Dharma" width={26} height={26} priority />
        <span className="text-sm font-bold text-white">Dharma</span>
      </Link>
      <Sidebar locked={locked} />
      <div className="mt-auto space-y-1">
        <FeedbackButton />
        <ProfileChip user={{ ...user, tier: tierLabel }} displayBadge={displayBadge} />
      </div>
    </>
  );

  return <AppShell sidebar={sidebar}>{children}</AppShell>;
}
