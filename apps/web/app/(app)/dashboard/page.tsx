import Link from "next/link";
import { redirect } from "next/navigation";
import { google, type calendar_v3 } from "googleapis";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { makeAuthForUser } from "../../../lib/gmail";
import { listVisibleCalendarIds } from "../../../lib/googleCalendars";
import { isInvalidGrant } from "../../../lib/googleErrors";
import { isDharmaBlockEvent } from "../../../lib/dharmaBlock";
import { mergeCalendarEvents } from "../../../lib/calendarFanout";
import { eventDisplayTitle } from "../../../lib/eventTitle";
import { getRecentActivity } from "../../../lib/recentActivity";
import { resolvePresetSpec, HIGH_PRIORITY_NAME } from "../../../lib/labelPresets";
import Greeting from "../../components/dashboard/Greeting";
import SyncInboxButton from "../../components/dashboard/SyncInboxButton";
import ActivityFeed from "../../components/dashboard/ActivityFeed";
import DashboardMetrics from "../../components/dashboard/DashboardMetrics";
import TimeSavedChart from "../../components/metrics/TimeSavedChart";
import ConfigStatusCard from "../../components/dashboard/ConfigStatusCard";
import NpsPrompt from "../../components/dashboard/NpsPrompt";
import InstallNudge from "../../components/dashboard/InstallNudge";
import ProductTour from "../../components/dashboard/ProductTour";

const TONE_ICON = (
  <svg width="56" height="56" viewBox="0 0 14 14" fill="none">
    <path d="M2 5v4M5 6v3M8 3v8M11 5v4" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" />
  </svg>
);
const LABELS_ICON = (
  <svg width="56" height="56" viewBox="0 0 14 14" fill="none">
    <path d="M2.5 3h5.5L11 5.5 8 8H2.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="0.7" strokeLinejoin="round" fill="none" />
  </svg>
);
const CAL_ICON = (
  <svg width="56" height="56" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="3.5" width="10" height="9" rx="1.2" stroke="currentColor" strokeWidth="0.7" fill="none" />
    <line x1="2" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="0.7" />
  </svg>
);

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    user,
    labelPreset,
    mappingCount,
    draftCount,
    activity,
    classifiedThisWeek,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        name: true,
        email: true,
        timezone: true,
        tone: true,
        toneProfile: true,
        schedulingEnabled: true,
        nextNpsPromptAt: true,
        cumulativeSecondsSaved: true,
        homeCity: true,
        tourCompletedAt: true,
        addonInstalledAt: true,
      },
    }),
    prisma.labelPreset.findUnique({ where: { userId } }),
    prisma.labelMapping.count({ where: { userId } }),
    prisma.usageEvent.count({ where: { userId, eventType: "draft" } }),
    getRecentActivity(userId, 10),
    prisma.classifiedThread.findMany({
      where: { userId, classifiedAt: { gte: weekAgo } },
      select: { labelName: true },
    }),
  ]);

  // Tone-column-dependent queries run separately and tolerate failure —
  // the column is new and the DB may not be migrated yet in every
  // environment. If they throw, the dashboard still renders with the
  // tone/scheduling tiles in their "no data yet" state.
  const toneUsage = await prisma.usageEvent
    .groupBy({
      by: ["tone"],
      where: {
        userId,
        eventType: "draft",
        createdAt: { gte: weekAgo },
        tone: { not: null },
      },
      _count: { _all: true },
    })
    .catch((err) => {
      console.error("[dashboard] toneUsage groupBy failed:", err);
      return [];
    });

  const schedulingDraftsThisWeek = await prisma.usageEvent
    .count({
      where: {
        userId,
        eventType: "draft",
        createdAt: { gte: weekAgo },
        tone: "Scheduling",
      },
    })
    .catch((err) => {
      console.error("[dashboard] schedulingDrafts count failed:", err);
      return 0;
    });

  const taggedByLabel = new Map<string, number>();
  let taggedThisWeek = 0;
  for (const t of classifiedThisWeek) {
    if (!t.labelName) continue;
    taggedThisWeek += 1;
    taggedByLabel.set(t.labelName, (taggedByLabel.get(t.labelName) ?? 0) + 1);
  }
  // Source of truth is LabelPreset (what the Configuration page edits). The
  // legacy `Label` table can lag behind preset switches and is no longer the
  // canonical list.
  const presetSpec = labelPreset
    ? resolvePresetSpec({
        preset: labelPreset.preset,
        customName: labelPreset.customName,
        customLabels: labelPreset.customLabels,
        includeUncategorized: labelPreset.uncategorizedEnabled,
      })
    : null;
  const labelBreakdown = (presetSpec?.labels ?? [])
    .filter((l) => l.shortName !== HIGH_PRIORITY_NAME) // never a primary tag → always 0
    .map((l) => ({
      name: l.shortName,           // user-readable, no prefix
      color: l.displayHex,
      tagged: taggedByLabel.get(l.name) ?? 0,   // ClassifiedThread stores full Gmail name
    }));
  // For the condensed bar chart on the Labels card: longest bar normalizes the
  // widths; share is each label's portion of labeled volume this week (rows
  // sum to ~100%), mirroring the Metrics "Volume by label" chart.
  const labelMaxTagged = Math.max(1, ...labelBreakdown.map((r) => r.tagged));
  const labelLabeledTotal = labelBreakdown.reduce((sum, r) => sum + r.tagged, 0);

  if (!user) redirect("/login");

  // Meetings for the current calendar week (Sun-Sat, UTC) plus an upcoming
  // list. Read across every calendar the user has visible in Google Calendar
  // (Work, Personal, …), not just primary — otherwise the card shows only
  // Dharma's own blocks (which live on primary) and misses real meetings on
  // other calendars (issue #74). Dharma's own mirrored blocks are excluded
  // (issue #86). Wrapped in try/catch so a Calendar API blip doesn't fail the
  // whole dashboard render — falls back to null and the tile shows a graceful
  // message. `calendarError` distinguishes a transient blip (retry will fix it)
  // from a dead OAuth grant (invalid_grant), which never self-resolves — the
  // tile then shows an actionable reconnect prompt instead of "sync is catching
  // up".
  type UpcomingMeeting = { id: string; summary: string; startISO: string };
  const { meetingsThisWeek, upcomingMeetings, calendarError } = await (async (): Promise<{
    meetingsThisWeek: number | null;
    upcomingMeetings: UpcomingMeeting[];
    calendarError: "reconnect" | "blip" | null;
  }> => {
    if (!user.schedulingEnabled)
      return { meetingsThisWeek: null, upcomingMeetings: [], calendarError: null };
    try {
      const now = new Date();
      const startOfWeek = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()),
      );
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 7);

      const { auth: oauthClient } = await makeAuthForUser(userId);
      const calendar = google.calendar({ version: "v3", auth: oauthClient });
      const calendarIds = await listVisibleCalendarIds(calendar);

      // Fan out one events.list per visible calendar and merge. One calendar
      // being unreadable shouldn't blank the whole card, so tolerate individual
      // failures (Promise.allSettled) rather than failing the batch.
      const listAll = async (
        params: Omit<calendar_v3.Params$Resource$Events$List, "calendarId">,
      ): Promise<calendar_v3.Schema$Event[]> => {
        const results = await Promise.allSettled(
          calendarIds.map((calendarId) => calendar.events.list({ ...params, calendarId })),
        );
        // Tolerate a single unreadable calendar, but rethrow invalid_grant so a
        // dead grant surfaces the reconnect prompt instead of a fake "0" (#91).
        return mergeCalendarEvents(results);
      };

      const [weekEvents, upcomingEvents] = await Promise.all([
        listAll({
          timeMin: startOfWeek.toISOString(),
          timeMax: endOfWeek.toISOString(),
          maxResults: 250,
          singleEvents: true,
          eventTypes: ["default"],
        }),
        listAll({
          timeMin: now.toISOString(),
          maxResults: 25, // per calendar; headroom before we merge + slice to 10
          singleEvents: true,
          orderBy: "startTime",
          eventTypes: ["default"],
        }),
      ]);

      // A real meeting: not cancelled, timed (not all-day), and not one of
      // Dharma's own mirrored blocks (issue #86).
      const isRealMeeting = (e: calendar_v3.Schema$Event) =>
        e.status !== "cancelled" && !!e.start?.dateTime && !isDharmaBlockEvent(e);
      // Stable identity for de-duping the same event across calendars.
      const keyOf = (e: calendar_v3.Schema$Event) =>
        e.id ?? `${e.start?.dateTime}-${e.summary}`;

      // De-dupe by event id (an event added to two of the user's calendars
      // appears once) before counting.
      const weekSeen = new Set<string>();
      let count = 0;
      for (const e of weekEvents) {
        if (!isRealMeeting(e)) continue;
        const k = keyOf(e);
        if (weekSeen.has(k)) continue;
        weekSeen.add(k);
        count += 1;
      }

      // Merge upcoming across calendars: chronological sort (numeric, so mixed
      // UTC offsets compare correctly), de-dupe, then take the soonest 10.
      const upcomingSeen = new Set<string>();
      const upcoming: UpcomingMeeting[] = upcomingEvents
        .filter(isRealMeeting)
        .sort(
          (a, b) =>
            new Date(a.start!.dateTime!).getTime() - new Date(b.start!.dateTime!).getTime(),
        )
        .filter((e) => {
          const k = keyOf(e);
          if (upcomingSeen.has(k)) return false;
          upcomingSeen.add(k);
          return true;
        })
        .slice(0, 10)
        .map((e) => ({
          id: keyOf(e),
          summary: eventDisplayTitle(e),
          startISO: e.start!.dateTime!,
        }));

      return { meetingsThisWeek: count, upcomingMeetings: upcoming, calendarError: null };
    } catch (err) {
      console.error("[dashboard] calendar query failed:", err);
      return {
        meetingsThisWeek: null,
        upcomingMeetings: [],
        calendarError: isInvalidGrant(err) ? "reconnect" : "blip",
      };
    }
  })();

  // Tone usage breakdown — only tracked starting when the `tone` column
  // shipped, so legacy drafts are skipped (null filter above). Sorted
  // descending by count so the most-used preset reads first.
  const toneTotal = toneUsage.reduce((sum, row) => sum + row._count._all, 0);
  const toneBreakdown = toneUsage
    .map((row) => ({
      tone: row.tone ?? "Unknown",
      count: row._count._all,
      pct: toneTotal > 0 ? Math.round((row._count._all / toneTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
  // Tallest bar normalizes the vertical bar chart on the Tone card.
  const toneMax = Math.max(1, ...toneBreakdown.map((r) => r.count));
  // Every selectable tone mode (mirrors TONE_CARDS in ToneCard) so the chart
  // shows all four side by side, used or not. Short labels fit four columns.
  const TONE_MODES: { key: string; label: string }[] = [
    { key: "My Tone", label: "My tone" },
    { key: "Concise", label: "Concise" },
    { key: "Formal / Legal", label: "Formal" },
    { key: "Scheduling", label: "Sched." },
  ];
  const toneByKey = new Map(toneBreakdown.map((r) => [r.tone, r]));
  // Static, deliberately uneven skeleton heights for the empty-state preview —
  // decorative only (aria-hidden), never rendered as real percentages.
  const TONE_PREVIEW_HEIGHTS = [42, 60, 34, 52];

  const firstName =
    user.firstName ?? user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";

  const toneActive = !!user.tone;
  const labelsActive = labelPreset?.enabled ?? false;
  const schedulingActive = user.schedulingEnabled;

  const showNps =
    draftCount >= 10 &&
    (!user.nextNpsPromptAt || user.nextNpsPromptAt < new Date());

  return (
    <div className="space-y-6">
      <ProductTour completed={!!user.tourCompletedAt} />
      {/* Header: greeting + Sync inbox + tier strip */}
      <header className="space-y-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Greeting firstName={firstName} timezone={user.timezone} />
          <div className="flex w-full min-w-0 flex-col items-start gap-1.5 sm:w-auto sm:items-end">
            <span className="max-w-full truncate text-sm text-white/40">{user.email}</span>
            <SyncInboxButton />
          </div>
        </div>
      </header>

      {/* Dismissible nudge to install the Gmail add-on (existing users who
          never went through the onboarding install step). */}
      <InstallNudge installed={!!user.addonInstalledAt} />

      {/* How it's going — the two-tier metrics strip that opens the merged
          dashboard (the standalone Metrics tab folded into here). Metrics-first:
          the headline numbers read before the config cards. */}
      <section>
        <DashboardMetrics />
      </section>

      {/* Running for you */}
      <section data-tour="config">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
            Running for you
          </p>
          <Link
            href="/configuration"
            className="text-[11px] text-white/50 hover:text-white/80"
          >
            Click to expand →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ConfigStatusCard
            icon={TONE_ICON}
            iconTone="brand"
            title="Tone"
            status={toneActive ? "Active" : "Paused"}
            active={toneActive}
            stat={
              toneActive ? (
                <div className="flex flex-1 flex-col">
                  <p className="text-[11px] text-white/50">
                    {toneTotal > 0
                      ? `${toneTotal} draft${toneTotal === 1 ? "" : "s"} this week`
                      : `Using "${user.tone}" preset`}
                  </p>
                  {toneBreakdown.length > 0 ? (
                    <div className="mt-3 flex min-h-[7rem] flex-1 gap-3">
                      {TONE_MODES.map((mode) => {
                        const stat = toneByKey.get(mode.key);
                        const count = stat?.count ?? 0;
                        const pct = stat?.pct ?? 0;
                        const active = mode.key === user.tone;
                        return (
                          <div
                            key={mode.key}
                            className="flex min-w-0 flex-1 flex-col items-center gap-1"
                            title={`${mode.label}: ${count} draft${count === 1 ? "" : "s"} · ${pct}%`}
                          >
                            <span className="text-[10px] tabular-nums text-white/45">
                              {pct}%
                            </span>
                            <div className="flex w-full flex-1 items-end overflow-hidden rounded-sm bg-white/[0.04]">
                              <div
                                className={`w-full ${active ? "bg-brand-400" : "bg-white/20"}`}
                                style={{ height: `${(count / toneMax) * 100}%` }}
                              />
                            </div>
                            <span className="w-full truncate text-center text-[10px] text-white/60">
                              {mode.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 flex min-h-[7rem] flex-1 flex-col">
                      <span className="text-[10px] uppercase tracking-[0.08em] text-white/25">
                        Preview
                      </span>
                      {/* Ghost preview: brand-purple bars at reduced opacity so
                          the card reads as "waiting for data", not real usage.
                          Decorative only — no real percentages are shown. */}
                      <div
                        className="mt-2 flex flex-1 gap-3 opacity-60"
                        aria-hidden="true"
                      >
                        {TONE_MODES.map((mode, i) => (
                          <div
                            key={mode.key}
                            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                          >
                            <div className="flex w-full flex-1 items-end overflow-hidden rounded-sm bg-white/[0.04]">
                              <div
                                className="w-full bg-brand-400"
                                style={{ height: `${TONE_PREVIEW_HEIGHTS[i]}%` }}
                              />
                            </div>
                            <span className="w-full truncate text-center text-[10px] text-white/40">
                              {mode.label}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-white/30">
                        Ghost preview — fills in once you generate drafts.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                "Drafts use a neutral default"
              )
            }
          />
          <ConfigStatusCard
            icon={LABELS_ICON}
            iconTone="brand-deep"
            title="Labels"
            status={
              labelsActive
                ? `Active · ${presetSpec?.displayName ?? labelPreset?.preset ?? ""}`.trim()
                : "Paused"
            }
            active={labelsActive}
            stat={
              labelsActive ? (
                <div>
                  <p className="text-[11px] text-white/50">
                    {mappingCount} provisioned · {taggedThisWeek} tagged this week
                  </p>
                  {/* Labeled bar chart: label name, a proportional bar in the
                      label's own color, and count · share. Sorted busiest-first;
                      zero-volume labels are hidden to keep it tight. */}
                  {labelBreakdown.some((row) => row.tagged > 0) && (
                    <ul className="mt-3 space-y-1.5">
                      {labelBreakdown
                        .filter((row) => row.tagged > 0)
                        .sort((a, b) => b.tagged - a.tagged)
                        .map((row) => (
                          <li
                            key={row.name}
                            className="flex items-center gap-2 text-[11px]"
                          >
                            <span className="w-24 shrink-0 truncate text-white/70">
                              {row.name}
                            </span>
                            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                              <span
                                className="absolute left-0 top-0 h-full rounded-full"
                                style={{
                                  width: `${Math.max(6, (row.tagged / labelMaxTagged) * 100)}%`,
                                  backgroundColor: row.color,
                                }}
                              />
                            </span>
                            <span className="w-14 shrink-0 text-right tabular-nums text-white/40">
                              {row.tagged}
                              <span className="ml-1 text-white/25">
                                · {Math.round((row.tagged / labelLabeledTotal) * 100)}%
                              </span>
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ) : (
                "Not classifying new mail"
              )
            }
          />
          <ConfigStatusCard
            icon={CAL_ICON}
            iconTone="brand-deeper"
            title="Scheduling"
            status={schedulingActive ? "Active" : "Paused"}
            active={schedulingActive}
            stat={
              schedulingActive ? (
                <div className="flex flex-1 flex-col">
                  {meetingsThisWeek === null ? (
                    calendarError === "reconnect" ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-1 py-4 text-center">
                        <span className="text-[11px] text-white/50">
                          Google access expired
                        </span>
                        <span className="text-[11px] text-brand-200">
                          Sign out and back in to reconnect
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-center py-4 text-center text-[11px] text-white/25">
                        Calendar sync is catching up
                      </div>
                    )
                  ) : (
                    <>
                      <p className="font-display text-3xl leading-none text-white">
                        {meetingsThisWeek}
                      </p>
                      <p className="mt-1 text-[11px] text-white/50">
                        meeting{meetingsThisWeek === 1 ? "" : "s"} this week
                      </p>
                      {upcomingMeetings.length > 0 && (
                        <ul className="mt-3 space-y-1">
                      {upcomingMeetings.map((m) => {
                        const start = new Date(m.startISO);
                        // Vercel functions run in UTC. Without an explicit
                        // timeZone the dashboard renders 4 hours off in EDT.
                        const displayTz = user.timezone ?? "America/New_York";
                        const minuteInTz = Number(
                          start.toLocaleString("en-US", {
                            minute: "numeric",
                            timeZone: displayTz,
                          }),
                        );
                        const when = start.toLocaleString("en-US", {
                          weekday: "short",
                          hour: "numeric",
                          minute: minuteInTz === 0 ? undefined : "2-digit",
                          hour12: true,
                          timeZone: displayTz,
                        });
                        return (
                          <li
                            key={m.id}
                            className="flex items-center gap-2 text-[11px]"
                          >
                            <span className="flex-1 truncate text-white/70">
                              {m.summary}
                            </span>
                            <span className="shrink-0 tabular-nums text-white/40">
                              {when}
                            </span>
                          </li>
                        );
                      })}
                        </ul>
                      )}
                    </>
                  )}
                  <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px]">
                    <span className="text-white/40">Scheduled with Dharma</span>
                    <span className="tabular-nums text-white/60">
                      {schedulingDraftsThisWeek}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col">
                  <p className="text-[11px] text-white/50">Scheduling is paused</p>
                  <div className="mt-auto flex items-center gap-1.5 pt-4 text-[12px] font-medium text-brand-200">
                    Connect a calendar to book meetings
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M5 3l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              )
            }
          />
        </div>
      </section>

      {/* Time saved — the 30-day trend chart carried over from the old Metrics
          page. Sits below the config cards as the deeper "how it's going" read. */}
      <section>
        <TimeSavedChart days={30} />
      </section>

      {showNps && <NpsPrompt firstName={firstName} />}

      {/* Recent activity */}
      <section>
        <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Recent activity
        </p>
        <ActivityFeed events={activity} />
      </section>
    </div>
  );
}
