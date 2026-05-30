import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import ToneCard from "../../components/configuration/ToneCard";
import LabelsCard from "../../components/configuration/LabelsCard";
import SchedulingCard from "../../components/configuration/SchedulingCard";

type Preset = "VC" | "PE" | "Legal" | "General" | "Custom";

export default async function ConfigurationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [user, labelPreset, mappingCount, hours] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        tone: true,
        toneProfile: true,
        toneSummary: true,
        toneExample: true,
        inferredSignOff: true,
        schedulingEnabled: true,
        schedulingPreferences: true,
        timezone: true,
        homeCity: true,
      },
    }),
    prisma.labelPreset.findUnique({ where: { userId } }),
    prisma.labelMapping.count({ where: { userId } }),
    prisma.meetingHour.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: "asc" }, { hourStart: "asc" }],
      select: { dayOfWeek: true, hourStart: true, hourEnd: true },
    }),
  ]);

  if (!user) redirect("/login");

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Configuration
        </p>
        <h1 className="font-display text-3xl text-white">
          Tone, labels, scheduling
        </h1>
        <p className="mt-2 text-sm text-white/60">
          The three features Dharma runs on your behalf. Pause any of them anytime.
        </p>
      </header>

      <div className="space-y-5">
        <ToneCard
          initial={{
            tone: user.tone,
            toneProfile: user.toneProfile,
            toneSummary: user.toneSummary,
            toneExample: user.toneExample,
            inferredSignOff: user.inferredSignOff,
          }}
        />

        <LabelsCard
          initial={{
            preset: (labelPreset?.preset as Preset | undefined) ?? null,
            enabled: labelPreset?.enabled ?? false,
            customName: labelPreset?.customName ?? null,
            customLabels: (labelPreset?.customLabels as unknown) ?? null,
            provisioned: mappingCount,
          }}
        />

        <SchedulingCard
          initial={{
            enabled: user.schedulingEnabled,
            schedulingPreferences: user.schedulingPreferences,
            timezone: user.timezone,
            homeCity: user.homeCity,
            hours,
          }}
        />
      </div>
    </div>
  );
}
