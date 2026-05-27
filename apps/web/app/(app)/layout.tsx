import { auth } from "../../lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import Sidebar from "../components/Sidebar";
import ProfileChip from "../components/ProfileChip";

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

  const signalCount = await prisma.signal.count({
    where: { userId: session.user.id, readAt: null },
  });
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
        <Sidebar locked={locked} signalCount={signalCount} />
        <div className="mt-auto">
          <ProfileChip user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-10 py-8">{children}</main>
      </div>
    </div>
  );
}
