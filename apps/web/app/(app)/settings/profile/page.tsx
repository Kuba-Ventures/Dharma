import { redirect } from "next/navigation";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { identityBadgesForEmail, earnedAchievementBadges } from "../../../../lib/badges";
import {
  effectiveMilestones,
  effectiveUnlockedMilestoneIds,
} from "../../../../lib/milestoneResolution";
import IdentityCard from "../../../components/profile/IdentityCard";
import TierLadder from "../../../components/profile/TierLadder";
import BadgeCase from "../../../components/profile/BadgeCase";
import MilestoneLibrary from "../../../components/profile/MilestoneLibrary";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [user, emailsTagged, userBadges] = await Promise.all([
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
        cumulativeSecondsSaved: true,
        toneSummary: true,
        toneProfile: true,
        onboardingCompletedAt: true,
        createdAt: true,
      },
    }),
    prisma.classifiedThread.count({ where: { userId } }),
    prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    }),
  ]);

  if (!user) redirect("/login");

  const [unlocked, allMilestones] = await Promise.all([
    effectiveUnlockedMilestoneIds(user.cumulativeSecondsSaved, user.homeCity),
    effectiveMilestones(user.homeCity),
  ]);
  const geoMilestoneAchieved = unlocked.some((id) => {
    const m = allMilestones.find((m) => m.id === id);
    return !!m?.requiredCity;
  });

  // Three sources, deduped: sheet-granted (UserBadge), env allowlist
  // (legacy fallback), and derived-from-state.
  const earnedBadges = Array.from(
    new Set([
      ...userBadges.map((b) => b.badgeId),
      ...identityBadgesForEmail(user.email),
      ...earnedAchievementBadges({
        onboardingComplete: !!user.onboardingCompletedAt,
        hasToneSummary: !!(user.toneSummary || user.toneProfile),
        emailsTaggedTotal: emailsTagged,
        cumulativeSecondsSaved: user.cumulativeSecondsSaved,
        achievedGeographicMilestone: geoMilestoneAchieved,
      }),
    ]),
  );

  const firstName = user.firstName ?? user.name?.split(" ")[0] ?? null;

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
          tier: user.tier,
          createdAt: user.createdAt.toISOString(),
        }}
      />

      <TierLadder secondsSaved={user.cumulativeSecondsSaved} />

      <BadgeCase earnedIds={earnedBadges} />

      <MilestoneLibrary
        secondsSaved={user.cumulativeSecondsSaved}
        homeCity={user.homeCity}
        firstName={firstName}
        tier={user.tier}
        milestones={allMilestones}
      />
    </div>
  );
}
