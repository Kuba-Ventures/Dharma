import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { forcedDisplayBadge } from "../../../lib/badges";
import IdentityCard from "../../components/profile/IdentityCard";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      image: true,
      name: true,
      firstName: true,
      email: true,
      homeCity: true,
      timezone: true,
      createdAt: true,
    },
  });

  if (!user) redirect("/login");

  // Only the pinned Founder accounts show a badge; everyone else shows none.
  const displayBadge = forcedDisplayBadge(user.email);

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
          createdAt: user.createdAt.toISOString(),
        }}
        displayBadge={displayBadge}
      />
    </div>
  );
}
