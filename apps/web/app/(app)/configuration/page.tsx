import { redirect } from "next/navigation";
import { google } from "googleapis";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { makeAuthForUser } from "../../../lib/gmail";
import ToneCard from "../../components/configuration/ToneCard";
import LabelsCard from "../../components/configuration/LabelsCard";
import SchedulingCard from "../../components/configuration/SchedulingCard";
import SignalsSection from "../../components/configuration/SignalsSection";
import ConfigTabs, { type ConfigSection } from "../../components/configuration/ConfigTabs";
import GuidedTour, { type TourStep } from "../../components/GuidedTour";

type Preset = "VC" | "PE" | "Legal" | "General" | "Personal" | "Custom";

const CONFIG_TOUR: TourStep[] = [
  {
    selector: '[data-tour="config-tabs"]',
    title: "Everything Dharma runs",
    description:
      "Tone, labels, scheduling, and signals live here. Switch between them with these tabs, and pause any one anytime.",
  },
];

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
        signalDetectionEnabled: true,
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

  // Average meetings/week over the last 4 weeks. Wrapped in try/catch so a
  // Calendar API blip doesn't break the config page render — we just pass
  // null and the card hides the stat.
  const averageMeetingsPerWeek = await (async (): Promise<number | null> => {
    if (!user.schedulingEnabled) return null;
    try {
      const now = new Date();
      const fourWeeksAgo = new Date(now);
      fourWeeksAgo.setUTCDate(now.getUTCDate() - 28);

      const { auth: oauthClient } = await makeAuthForUser(userId);
      const calendar = google.calendar({ version: "v3", auth: oauthClient });
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: fourWeeksAgo.toISOString(),
        timeMax: now.toISOString(),
        maxResults: 2500,
        singleEvents: true,
        eventTypes: ["default"],
      });
      const count = (res.data.items ?? []).filter(
        (e) => e.status !== "cancelled" && e.start?.dateTime,
      ).length;
      return Math.round((count / 4) * 10) / 10; // one decimal place
    } catch (err) {
      console.error("[configuration] avg meetings/week query failed:", err);
      return null;
    }
  })();

  const sections: ConfigSection[] = [
    {
      key: "tone",
      label: "Tone",
      node: (
        <ToneCard
          initial={{
            tone: user.tone,
            toneProfile: user.toneProfile,
            toneSummary: user.toneSummary,
            toneExample: user.toneExample,
            inferredSignOff: user.inferredSignOff,
          }}
        />
      ),
    },
    {
      key: "labels",
      label: "Labels",
      node: (
        <LabelsCard
          initial={{
            preset: (labelPreset?.preset as Preset | undefined) ?? null,
            enabled: labelPreset?.enabled ?? false,
            customName: labelPreset?.customName ?? null,
            customLabels: (labelPreset?.customLabels as unknown) ?? null,
            provisioned: mappingCount,
            uncategorizedEnabled: labelPreset?.uncategorizedEnabled ?? true,
          }}
        />
      ),
    },
    {
      key: "scheduling",
      label: "Scheduling",
      node: (
        <SchedulingCard
          initial={{
            enabled: user.schedulingEnabled,
            schedulingPreferences: user.schedulingPreferences,
            timezone: user.timezone,
            homeCity: user.homeCity,
            hours,
            averageMeetingsPerWeek,
          }}
        />
      ),
    },
    {
      key: "signals",
      label: "Signals",
      node: <SignalsSection enabled={user.signalDetectionEnabled} />,
    },
  ];

  return (
    <div className="max-w-3xl">
      <GuidedTour id="config" steps={CONFIG_TOUR} />

      <ConfigTabs
        sections={sections}
        eyebrow="Configuration"
        title="Tone, labels, scheduling & signals"
        subtitle="Everything Dharma runs on your behalf. Pause any of it anytime."
      />
    </div>
  );
}
