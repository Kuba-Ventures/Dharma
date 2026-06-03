import { redirect } from "next/navigation";
import { google } from "googleapis";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { makeAuthForUser } from "../../../lib/gmail";
import ToneCard from "../../components/configuration/ToneCard";
import LabelsCard from "../../components/configuration/LabelsCard";
import SchedulingCard from "../../components/configuration/SchedulingCard";
import GuidedTour, { type TourStep } from "../../components/GuidedTour";

type Preset = "VC" | "PE" | "Legal" | "General" | "Personal" | "Custom";

const CONFIG_TOUR: TourStep[] = [
  {
    selector: '[data-tour="config-tone"]',
    title: "Your writing tone",
    description:
      "Dharma drafts replies in your voice. Pick a preset or let it learn from your sent mail, and tweak the summary anytime.",
  },
  {
    selector: '[data-tour="config-labels"]',
    title: "Labels & tabs",
    description:
      "Choose a preset (VC, Personal, and so on) and Dharma auto-sorts new mail into these labels in your own Gmail.",
  },
  {
    selector: '[data-tour="config-scheduling"]',
    title: "Scheduling",
    description:
      "Turn back-and-forth scheduling threads into ready-to-send time proposals pulled from your calendar.",
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

      <GuidedTour id="config" steps={CONFIG_TOUR} />

      <div className="space-y-5">
        <div data-tour="config-tone">
          <ToneCard
            initial={{
              tone: user.tone,
              toneProfile: user.toneProfile,
              toneSummary: user.toneSummary,
              toneExample: user.toneExample,
              inferredSignOff: user.inferredSignOff,
            }}
          />
        </div>

        <div data-tour="config-labels">
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
        </div>

        <div data-tour="config-scheduling">
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
        </div>
      </div>
    </div>
  );
}
