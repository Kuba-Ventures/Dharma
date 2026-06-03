import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import {
  BADGES,
  getBadge,
  identityBadgesForEmail,
  earnedAchievementBadges,
  groupProgress,
  resolveBadgeId,
  type BadgeGroup,
} from "../../../lib/badges";
import { buildSnapshot } from "../../../lib/badgeSnapshot";
import { effectiveMilestones } from "../../../lib/milestoneResolution";
import { sheetIdentityBadgesForEmail } from "../../../lib/adminSheet";
import { effectiveTier } from "../../../lib/effectiveTier";
import IdentityCard from "../../components/profile/IdentityCard";
import TierLadder from "../../components/profile/TierLadder";
import BadgeCase from "../../components/profile/BadgeCase";
import MilestoneLibrary from "../../components/profile/MilestoneLibrary";
import GuidedTour, { type TourStep } from "../../components/GuidedTour";

const PROFILE_TOUR: TourStep[] = [
  {
    selector: '[data-tour="profile-tier"]',
    title: "Your tier",
    description:
      "Tiers level up as Dharma saves you more time. Here's where you are and what's next on the ladder.",
  },
  {
    selector: '[data-tour="profile-badges"]',
    title: "Badges",
    description:
      "Earn badges for milestones — training your tone, labeling mail, hitting time-saved goals, and more.",
  },
];

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [user, userBadges] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        image: true,
        name: true,
        firstName: true,
        email: true,
        homeCity: true,
        timezone: true,
        tier: true,
        displayBadgeId: true,
        cumulativeSecondsSaved: true,
        createdAt: true,
      },
    }),
    prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    }),
  ]);

  if (!user) redirect("/login");

  const [allMilestones, sheetBadgeIds, tierLabel, snapshot] = await Promise.all([
    effectiveMilestones(user.homeCity),
    sheetIdentityBadgesForEmail(user.email),
    effectiveTier(user.cumulativeSecondsSaved, user.email),
    buildSnapshot(userId),
  ]);

  // Merge persisted (sheet identity + prior awards), live env identity, and
  // freshly derived achievements; map retired ids forward.
  const earnedBadges = Array.from(
    new Set(
      [
        ...userBadges.map((b) => b.badgeId),
        ...identityBadgesForEmail(user.email),
        ...sheetBadgeIds,
        ...earnedAchievementBadges(snapshot),
      ].map(resolveBadgeId),
    ),
  );

  const badgeGroups = (
    ["drafts", "time_saved", "organization", "tone", "onboarding", "tenure", "geo"] as BadgeGroup[]
  ).map((g) => groupProgress(g, snapshot));

  const firstName = user.firstName ?? user.name?.split(" ")[0] ?? null;

  // Resolve which badge to highlight on the avatar.
  const earnedSet = new Set(earnedBadges);
  const earnedBadgeObjects = BADGES.filter((b) => earnedSet.has(b.id));
  const resolvedDisplayId = user.displayBadgeId ? resolveBadgeId(user.displayBadgeId) : null;
  const displayBadge =
    (resolvedDisplayId && getBadge(resolvedDisplayId) && earnedSet.has(resolvedDisplayId)
      ? getBadge(resolvedDisplayId)
      : null) ??
    // Default: highest-priority earned identity badge
    BADGES.find((b) => b.kind === "identity" && earnedSet.has(b.id)) ??
    null;

  return (
    <div className="max-w-3xl space-y-5">
      <header className="mb-2">
        <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Profile
        </p>
        <h1 className="font-display text-3xl text-white">Your account</h1>
      </header>

      <IdentityCard
        user={{
          image: user.image,
          name: user.name,
          firstName: user.firstName,
          email: user.email,
          homeCity: user.homeCity,
          timezone: user.timezone,
          tier: tierLabel,
          createdAt: user.createdAt.toISOString(),
        }}
        earnedBadges={earnedBadgeObjects}
        displayBadge={displayBadge}
      />

      <GuidedTour id="profile" steps={PROFILE_TOUR} />

      <div data-tour="profile-tier">
        <TierLadder secondsSaved={user.cumulativeSecondsSaved} />
      </div>

      <div data-tour="profile-badges">
        <BadgeCase
          earnedIds={earnedBadges}
          displayBadgeId={resolvedDisplayId}
          groupProgress={badgeGroups}
        />
      </div>

      <MilestoneLibrary
        secondsSaved={user.cumulativeSecondsSaved}
        homeCity={user.homeCity}
        firstName={firstName}
        tier={tierLabel}
        milestones={allMilestones}
      />
    </div>
  );
}
