import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import StepShell from "../components/StepShell";
import CityPicker from "./CityPicker";

export default async function StepTwo() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { homeCity: true, timezone: true },
  });

  // Auto-detect timezone if user has none set.
  const detectedTimezone = user?.timezone ?? "America/New_York";

  return (
    <StepShell
      step={1}
      total={4}
      eyebrow="Welcome to Dharma"
      title="Where do you call home?"
      description="Your home city personalizes the milestones Dharma surfaces — local trails, peaks, and cross-town distances tied to time you save."
    >
      <CityPicker initial={user?.homeCity ?? ""} detectedTimezone={detectedTimezone} />
    </StepShell>
  );
}
