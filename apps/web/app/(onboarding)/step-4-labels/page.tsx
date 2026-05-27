import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import StepShell from "../components/StepShell";
import LabelPresetPicker from "./LabelPresetPicker";

export default async function StepFour() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const labelPreset = await prisma.labelPreset.findUnique({
    where: { userId: session.user.id },
    select: { preset: true, customName: true },
  });

  return (
    <StepShell
      step={3}
      total={4}
      eyebrow="Welcome to Dharma"
      title="Pick a label preset"
      description="Dharma classifies new mail into these labels and provisions them in Gmail. You can switch or customize anytime in Configuration."
    >
      <LabelPresetPicker
        initial={{
          preset: (labelPreset?.preset as "VC" | "PE" | "Legal" | "General" | "Custom" | undefined) ?? null,
          customName: labelPreset?.customName ?? "",
        }}
      />
    </StepShell>
  );
}
