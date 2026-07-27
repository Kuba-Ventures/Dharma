import { auth } from "../../lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { forcedDisplayBadge } from "../../lib/badges";
import { resolveOnboardingFlow, onboardingStepUrl } from "../../lib/onboardingFlow";
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
      onboardingCompletedAt: true,
      onboardingStep: true,
      onboardingFlow: true,
    },
  });
  if (!user) redirect("/login");

  // Bounce new users into the onboarding flow, resuming on their pinned flow's
  // step (null pin → v1, matching pre-v2 behavior). Existing users were
  // backfilled with onboardingCompletedAt by scripts/backfill-onboarding.mjs.
  if (!user.onboardingCompletedAt) {
    const flow = resolveOnboardingFlow(user.onboardingFlow);
    redirect(onboardingStepUrl(flow, user.onboardingStep));
  }

  // The nav chip shows a badge only for the pinned Founder accounts; everyone
  // else shows no badge (badges were removed from the profile surfaces).
  const displayBadge = forcedDisplayBadge(user.email);
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
        <ProfileChip user={user} displayBadge={displayBadge} />
      </div>
    </>
  );

  return <AppShell sidebar={sidebar}>{children}</AppShell>;
}
