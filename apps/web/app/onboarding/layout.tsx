import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // If they've already finished onboarding, bounce to the dashboard. Direct
  // URL access shouldn't let them re-enter the flow.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompletedAt: true },
  });
  if (user?.onboardingCompletedAt) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[color:var(--bg-app)] flex flex-col">
      <header className="border-b border-[color:var(--border-subtle)] px-10 py-5">
        <Link
          href="/"
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <Image src="/logo.png" alt="Dharma" width={26} height={26} priority />
          <span className="text-sm font-bold text-white">Dharma</span>
        </Link>
      </header>
      <main className="flex-1 px-10 py-12">
        <div className="mx-auto max-w-xl">{children}</div>
      </main>
    </div>
  );
}
