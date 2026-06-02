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
} from "../../lib/badges";
import { sheetIdentityBadgesForEmail } from "../../lib/adminSheet";
import Sidebar from "../components/Sidebar";
import ProfileChip from "../components/ProfileChip";
import FeedbackButton from "../components/ui/FeedbackButton";

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
    ];
    redirect(stepUrls[Math.min(user.onboardingStep, stepUrls.length - 1)]);
  }

  // Signal producers aren't live yet, so the sidebar badge would only ever
  // reflect seeded test rows. Omit the count until the Signals surface ships.
  const [emailsTagged, userBadges, sheetBadgeIds] = await Promise.all([
    prisma.classifiedThread.count({ where: { userId: session.user.id } }),
    prisma.userBadge.findMany({
      where: { userId: session.user.id },
      select: { badgeId: true },
    }),
    sheetIdentityBadgesForEmail(user.email),
  ]);

  // Compute the display badge for the sidebar avatar. Same logic as the
  // Profile page so what the user picks there reflects in the chip too.
  const earnedIds = new Set([
    ...userBadges.map((b) => b.badgeId),
    ...identityBadgesForEmail(user.email),
    ...sheetBadgeIds,
    ...earnedAchievementBadges({
      onboardingComplete: !!user.onboardingCompletedAt,
      hasToneSummary: !!(user.toneSummary || user.toneProfile),
      emailsTaggedTotal: emailsTagged,
      cumulativeSecondsSaved: user.cumulativeSecondsSaved,
      // homeCity drives geographic milestone derivation; we don't run that
      // full resolution here, so this approximation is conservative.
      achievedGeographicMilestone: false,
    }),
  ]);
  const displayBadge =
    (user.displayBadgeId &&
    getBadge(user.displayBadgeId) &&
    earnedIds.has(user.displayBadgeId)
      ? getBadge(user.displayBadgeId)
      : null) ??
    BADGES.find((b) => b.kind === "identity" && earnedIds.has(b.id)) ??
    null;
  const locked = false;

  return (
    <div className="flex min-h-screen bg-[color:var(--bg-app)]">
      <aside className="flex w-52 shrink-0 flex-col border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-sidebar)] px-3 py-7">
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
          <ProfileChip user={user} displayBadge={displayBadge} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-10 py-8">{children}</main>
      </div>
    </div>
  );
}
