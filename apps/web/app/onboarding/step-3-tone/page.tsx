import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import StepShell from "../components/StepShell";
import ToneTrainer from "./ToneTrainer";

export default async function StepThree() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { toneProfile: true, toneSummary: true, toneExample: true },
  });

  return (
    <StepShell
      step={2}
      total={5}
      eyebrow="Welcome to Dharma"
      title="Train your tone"
      description="Dharma reads 15 of your sent emails and writes a summary of how you sound. Editable after. Nothing is shared."
    >
      <ToneTrainer
        initial={{
          toneProfile: user?.toneProfile ?? null,
          toneSummary: user?.toneSummary ?? null,
          toneExample: user?.toneExample ?? null,
        }}
      />
    </StepShell>
  );
}
