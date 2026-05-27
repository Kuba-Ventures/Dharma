import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import StepShell from "../components/StepShell";
import Card from "../../components/ui/Card";

export default async function StepOne() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cred = await prisma.googleCredential.findUnique({
    where: { userId: session.user.id },
    select: { email: true },
  });

  const connected = !!cred;

  async function advance() {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    await prisma.user.update({
      where: { id: s.user.id },
      data: { onboardingStep: 1 },
    });
    redirect("/onboarding/step-2-city");
  }

  return (
    <StepShell
      step={0}
      total={4}
      eyebrow="Welcome to Dharma"
      title="Let's get you set up"
      description="Four quick steps. About three minutes. Your dashboard unlocks when you're done."
    >
      <Card variant="elevated">
        <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Connect Gmail & Calendar
        </p>
        {connected ? (
          <>
            <p className="mt-2 text-sm text-white">
              Connected as <span className="text-brand-200">{cred?.email}</span>.
            </p>
            <p className="mt-1 text-[12px] text-white/50">
              Dharma reads your sent emails to learn your voice and creates
              drafts in Gmail. Nothing is sent without you.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-white/70">
            You'll need to sign in with Google to continue.
          </p>
        )}
      </Card>

      <form action={advance} className="mt-4 flex justify-end gap-2">
        <Link
          href="/login"
          className="rounded-btn px-4 py-2 text-sm text-white/60 hover:text-white"
        >
          Sign in with a different account
        </Link>
        <button
          type="submit"
          disabled={!connected}
          className="rounded-btn bg-brand-400 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
        >
          Continue
        </button>
      </form>
    </StepShell>
  );
}
