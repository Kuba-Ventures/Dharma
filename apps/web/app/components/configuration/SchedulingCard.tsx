"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Card from "../ui/Card";
import StatusPill from "../ui/StatusPill";
import IconTile from "../ui/IconTile";
import Toggle from "../ui/Toggle";
import ConfirmModal from "../ui/ConfirmModal";
import MeetingHoursGrid, {
  type MeetingHour,
} from "../MeetingHoursGrid";
import WeekAvailability from "./WeekAvailability";
import { isBlockExpired, nowISOInZone } from "../../../lib/expiredBlocks";

const CAL_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect
      x="2"
      y="3.5"
      width="12"
      height="11"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.4"
      fill="none"
    />
    <line x1="2" y1="6.5" x2="14" y2="6.5" stroke="currentColor" strokeWidth="1.4" />
    <line x1="5" y1="2" x2="5" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="11" y1="2" x2="11" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

type Recurrence = {
  freq: "none" | "daily" | "weekly" | "monthly";
  interval?: number; // every N; default 1
  days?: number[];   // 0=Sun..6=Sat — used when freq === "weekly"
  date?: string;     // "YYYY-MM-DD" — one-off date / optional anchor
  until?: string;    // "YYYY-MM-DD" — optional end date
};

type BlockedWindow = {
  start: string;
  end: string;
  label?: string;
  mirrorToCalendar?: boolean;
  calendarEventId?: string;
  recurrence?: Recurrence;
  colorId?: string;
};

type Prefs = {
  defaultDurationMin: number;
  bufferMin: number;
  maxPerDay: number;
  blockedWindows: BlockedWindow[];
};

const DEFAULT_PREFS: Prefs = {
  defaultDurationMin: 30,
  bufferMin: 15,
  maxPerDay: 5,
  blockedWindows: [],
};

// Client-side ceiling below the browser's (long) default, so a wedged save
// fails with a clear message instead of "loading" forever.
const SAVE_TIMEOUT_MS = 20000;

function parsePrefs(raw: string | null): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const rawBlocks = Array.isArray(parsed.blockedWindows) ? parsed.blockedWindows : [];
    const blockedWindows: BlockedWindow[] = rawBlocks
      .map((b) => {
        const obj = b as Partial<BlockedWindow>;
        if (typeof obj.start !== "string" || typeof obj.end !== "string") return null;
        return {
          start: obj.start,
          end: obj.end,
          ...(typeof obj.label === "string" && obj.label.trim() ? { label: obj.label.trim() } : {}),
          ...(obj.mirrorToCalendar ? { mirrorToCalendar: true } : {}),
          ...(typeof obj.calendarEventId === "string" ? { calendarEventId: obj.calendarEventId } : {}),
          ...(obj.recurrence && typeof obj.recurrence === "object"
            ? { recurrence: sanitizeRecurrence(obj.recurrence as Partial<Recurrence>) }
            : {}),
          ...(typeof obj.colorId === "string" && /^([1-9]|1[01])$/.test(obj.colorId)
            ? { colorId: obj.colorId }
            : {}),
        };
      })
      .filter((b): b is BlockedWindow => b !== null);
    return {
      defaultDurationMin: parsed.defaultDurationMin ?? DEFAULT_PREFS.defaultDurationMin,
      bufferMin: parsed.bufferMin ?? DEFAULT_PREFS.bufferMin,
      maxPerDay: parsed.maxPerDay ?? DEFAULT_PREFS.maxPerDay,
      blockedWindows,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

type Props = {
  initial: {
    enabled: boolean;
    schedulingPreferences: string | null;
    timezone: string | null;
    homeCity: string | null;
    hours: MeetingHour[];
    averageMeetingsPerWeek: number | null;
  };
};

// Hours -> human summary. e.g. "Mon–Sat 7am–10pm; Sun off" or
// "Mon–Fri 9am–5pm" if all weekday rows match.
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function to12h(h: number): string {
  if (h === 0 || h === 24) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}
function summarizeHours(hours: MeetingHour[]): string | null {
  if (hours.length === 0) return null;
  const byDay = new Map<number, { start: number; end: number }>();
  for (const h of hours) byDay.set(h.dayOfWeek, { start: h.hourStart, end: h.hourEnd });

  // Group contiguous active days that share the same hours.
  // Walk Mon..Sun (1..6, 0), build runs.
  const walkOrder = [1, 2, 3, 4, 5, 6, 0];
  const runs: { days: number[]; start: number; end: number }[] = [];
  for (const d of walkOrder) {
    const cur = byDay.get(d);
    if (!cur) continue;
    const last = runs[runs.length - 1];
    if (last && last.start === cur.start && last.end === cur.end) {
      // Only extend if d is the next day in walkOrder after last.days[last.days.length-1]
      const lastDay = last.days[last.days.length - 1];
      const lastIdx = walkOrder.indexOf(lastDay);
      if (walkOrder[lastIdx + 1] === d) {
        last.days.push(d);
        continue;
      }
    }
    runs.push({ days: [d], start: cur.start, end: cur.end });
  }

  return runs
    .map((r) => {
      const dayLabel =
        r.days.length === 1
          ? DAY_NAMES[r.days[0]]
          : `${DAY_NAMES[r.days[0]]}-${DAY_NAMES[r.days[r.days.length - 1]]}`;
      return `${dayLabel} ${to12h(r.start)}-${to12h(r.end)}`;
    })
    .join(", ");
}

// ── Recurrence helpers ───────────────────────────────────────────────────────
const WD_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_INITIAL = ["S", "M", "T", "W", "T", "F", "S"];
const FREQ_LABELS: Record<Recurrence["freq"], string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

// One-click day selections for weekly recurrence. Each just sets `days`;
// the model (freq: "weekly" + days[]) already supports these — this is a
// shortcut so users don't have to tap each pill (0=Sun..6=Sat).
const DAY_PRESETS: { label: string; days: number[] }[] = [
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Weekends", days: [0, 6] },
];

// Order-independent set equality for two day arrays.
function sameDays(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((d) => set.has(d));
}

function sanitizeRecurrence(r: Partial<Recurrence>): Recurrence {
  const freq: Recurrence["freq"] =
    r.freq === "none" || r.freq === "daily" || r.freq === "weekly" || r.freq === "monthly"
      ? r.freq
      : "weekly";
  const days = Array.isArray(r.days)
    ? [...new Set(r.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : undefined;
  return {
    freq,
    ...(typeof r.interval === "number" && r.interval > 0 ? { interval: Math.floor(r.interval) } : {}),
    ...(days && days.length ? { days } : {}),
    ...(typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? { date: r.date } : {}),
    ...(typeof r.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.until) ? { until: r.until } : {}),
  };
}

// Google Calendar's fixed event-color palette (colorId "1".."11") with
// approximate hexes for swatches. "1" (Lavender) is Dharma's default — the
// nearest preset to the brand indigo.
const GOOGLE_EVENT_COLORS: { id: string; name: string; hex: string }[] = [
  { id: "1", name: "Lavender", hex: "#7986CB" },
  { id: "9", name: "Blueberry", hex: "#3F51B5" },
  { id: "3", name: "Grape", hex: "#8E24AA" },
  { id: "7", name: "Peacock", hex: "#039BE5" },
  { id: "2", name: "Sage", hex: "#33B679" },
  { id: "10", name: "Basil", hex: "#0B8043" },
  { id: "5", name: "Banana", hex: "#F6BF26" },
  { id: "6", name: "Tangerine", hex: "#F4511E" },
  { id: "4", name: "Flamingo", hex: "#E67C73" },
  { id: "11", name: "Tomato", hex: "#D50000" },
  { id: "8", name: "Graphite", hex: "#616161" },
];
const DEFAULT_COLOR_ID = "1";
function colorName(id: string | undefined): string {
  return GOOGLE_EVENT_COLORS.find((c) => c.id === (id ?? DEFAULT_COLOR_ID))?.name ?? "Lavender";
}

function defaultRecurrence(activeDays: number[]): Recurrence {
  const days = activeDays.length ? [...activeDays].sort((a, b) => a - b) : [1, 2, 3, 4, 5];
  return { freq: "weekly", interval: 1, days };
}

// "HH:MM" -> "12:00 PM"
function fmtTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  let h = Number(m[1]);
  const min = m[2];
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ap}`;
}

// "YYYY-MM-DD" -> "Tue, Jun 3"
function prettyDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Whether a recurrence is complete enough to create a calendar event.
function recurrenceValid(rec: Recurrence): boolean {
  if (rec.freq === "none") return !!rec.date;
  if (rec.freq === "weekly") return !!rec.days && rec.days.length > 0;
  return true;
}

// One-line, human-readable summary used in the confirm dialog and the row.
function recurrenceSummary(rec: Recurrence): string {
  const n = rec.interval && rec.interval > 1 ? rec.interval : 1;
  if (rec.freq === "none") return rec.date ? `once on ${prettyDate(rec.date)}` : "once (pick a date)";
  if (rec.freq === "daily") return n > 1 ? `every ${n} days` : "every day";
  if (rec.freq === "monthly") return n > 1 ? `every ${n} months` : "monthly";
  // weekly
  const dayList = (rec.days ?? []).slice().sort((a, b) => a - b).map((d) => WD_FULL[d]).join(", ");
  const every = n > 1 ? `every ${n} weeks` : "weekly";
  return dayList ? `${every} on ${dayList}` : every;
}

// Curated timezone list grouped by UTC offset. Each entry maps a
// human-friendly label to a representative IANA zone. Display labels
// like "(UTC-05:00) Eastern Standard Time (EST)" are unambiguous and
// give every user something to scan for. Saved value is the IANA zone.
type TzOption = { offset: string; label: string; zone: string };
const TZ_OPTIONS: TzOption[] = [
  { offset: "UTC-12:00", label: "Baker Island, Howland Island",            zone: "Etc/GMT+12" },
  { offset: "UTC-11:00", label: "Samoa Standard Time",                     zone: "Pacific/Pago_Pago" },
  { offset: "UTC-11:00", label: "Niue",                                    zone: "Pacific/Niue" },
  { offset: "UTC-10:00", label: "Hawaii-Aleutian Standard Time",           zone: "Pacific/Honolulu" },
  { offset: "UTC-10:00", label: "Tahiti",                                  zone: "Pacific/Tahiti" },
  { offset: "UTC-09:30", label: "Marquesas Islands",                       zone: "Pacific/Marquesas" },
  { offset: "UTC-09:00", label: "Alaska Standard Time",                    zone: "America/Anchorage" },
  { offset: "UTC-08:00", label: "Pacific Standard Time (PST)",             zone: "America/Los_Angeles" },
  { offset: "UTC-07:00", label: "Mountain Standard Time (MST)",            zone: "America/Denver" },
  { offset: "UTC-06:00", label: "Central Standard Time (CST)",             zone: "America/Chicago" },
  { offset: "UTC-06:00", label: "Central America",                         zone: "America/Costa_Rica" },
  { offset: "UTC-05:00", label: "Eastern Standard Time (EST)",             zone: "America/New_York" },
  { offset: "UTC-05:00", label: "Colombia",                                zone: "America/Bogota" },
  { offset: "UTC-05:00", label: "Peru",                                    zone: "America/Lima" },
  { offset: "UTC-04:00", label: "Atlantic Standard Time (AST)",            zone: "America/Halifax" },
  { offset: "UTC-04:00", label: "Bolivia",                                 zone: "America/La_Paz" },
  { offset: "UTC-04:00", label: "Chile",                                   zone: "America/Santiago" },
  { offset: "UTC-03:30", label: "Newfoundland Standard Time",              zone: "America/St_Johns" },
  { offset: "UTC-03:00", label: "Argentina",                               zone: "America/Argentina/Buenos_Aires" },
  { offset: "UTC-03:00", label: "Brazil",                                  zone: "America/Sao_Paulo" },
  { offset: "UTC-03:00", label: "Greenland",                               zone: "America/Godthab" },
  { offset: "UTC-02:00", label: "Fernando de Noronha",                     zone: "America/Noronha" },
  { offset: "UTC-02:00", label: "South Georgia",                           zone: "Atlantic/South_Georgia" },
  { offset: "UTC-01:00", label: "Azores",                                  zone: "Atlantic/Azores" },
  { offset: "UTC-01:00", label: "Cape Verde",                              zone: "Atlantic/Cape_Verde" },
  { offset: "UTC+00:00", label: "Greenwich Mean Time (GMT)",               zone: "Etc/GMT" },
  { offset: "UTC+00:00", label: "Western European Time",                   zone: "Europe/Lisbon" },
  { offset: "UTC+01:00", label: "Central European Time (CET)",             zone: "Europe/Paris" },
  { offset: "UTC+01:00", label: "West Africa Time",                        zone: "Africa/Lagos" },
  { offset: "UTC+02:00", label: "Eastern European Time (EET)",             zone: "Europe/Helsinki" },
  { offset: "UTC+02:00", label: "Central Africa Time",                     zone: "Africa/Maputo" },
  { offset: "UTC+03:00", label: "Moscow Standard Time",                    zone: "Europe/Moscow" },
  { offset: "UTC+03:00", label: "East Africa Time",                        zone: "Africa/Nairobi" },
  { offset: "UTC+03:30", label: "Iran Standard Time",                      zone: "Asia/Tehran" },
  { offset: "UTC+04:00", label: "Gulf Standard Time",                      zone: "Asia/Dubai" },
  { offset: "UTC+04:00", label: "Samara Time",                             zone: "Europe/Samara" },
  { offset: "UTC+04:30", label: "Afghanistan Time",                        zone: "Asia/Kabul" },
  { offset: "UTC+05:00", label: "Pakistan Standard Time",                  zone: "Asia/Karachi" },
  { offset: "UTC+05:00", label: "Yekaterinburg Time",                      zone: "Asia/Yekaterinburg" },
  { offset: "UTC+05:30", label: "Indian Standard Time (IST)",              zone: "Asia/Kolkata" },
  { offset: "UTC+05:30", label: "Sri Lanka",                               zone: "Asia/Colombo" },
  { offset: "UTC+05:45", label: "Nepal Time",                              zone: "Asia/Kathmandu" },
  { offset: "UTC+06:00", label: "Bangladesh Standard Time",                zone: "Asia/Dhaka" },
  { offset: "UTC+06:00", label: "Omsk Time",                               zone: "Asia/Omsk" },
  { offset: "UTC+06:30", label: "Cocos Islands",                           zone: "Indian/Cocos" },
  { offset: "UTC+06:30", label: "Myanmar Time",                            zone: "Asia/Yangon" },
  { offset: "UTC+07:00", label: "Indochina Time",                          zone: "Asia/Bangkok" },
  { offset: "UTC+07:00", label: "Krasnoyarsk Time",                        zone: "Asia/Krasnoyarsk" },
  { offset: "UTC+08:00", label: "China Standard Time",                     zone: "Asia/Shanghai" },
  { offset: "UTC+08:00", label: "Australian Western Time",                 zone: "Australia/Perth" },
  { offset: "UTC+08:45", label: "Central Western Time (Australia)",        zone: "Australia/Eucla" },
  { offset: "UTC+09:00", label: "Japan Standard Time (JST)",               zone: "Asia/Tokyo" },
  { offset: "UTC+09:00", label: "Korea Standard Time",                     zone: "Asia/Seoul" },
  { offset: "UTC+09:30", label: "Australian Central Standard Time (ACST)", zone: "Australia/Adelaide" },
  { offset: "UTC+10:00", label: "Australian Eastern Standard Time (AEST)", zone: "Australia/Sydney" },
  { offset: "UTC+10:00", label: "Vladivostok Time",                        zone: "Asia/Vladivostok" },
  { offset: "UTC+10:30", label: "Lord Howe Island",                        zone: "Australia/Lord_Howe" },
  { offset: "UTC+11:00", label: "Solomon Islands",                         zone: "Pacific/Guadalcanal" },
  { offset: "UTC+11:00", label: "Magadan Time",                            zone: "Asia/Magadan" },
  { offset: "UTC+11:30", label: "Norfolk Island",                          zone: "Pacific/Norfolk" },
  { offset: "UTC+12:00", label: "Fiji",                                    zone: "Pacific/Fiji" },
  { offset: "UTC+12:00", label: "New Zealand",                             zone: "Pacific/Auckland" },
  { offset: "UTC+12:00", label: "Kamchatka Time",                          zone: "Asia/Kamchatka" },
  { offset: "UTC+12:45", label: "Chatham Islands Standard Time",           zone: "Pacific/Chatham" },
  { offset: "UTC+13:00", label: "Tonga",                                   zone: "Pacific/Tongatapu" },
  { offset: "UTC+13:00", label: "Samoa Time",                              zone: "Pacific/Apia" },
  { offset: "UTC+14:00", label: "Line Islands, Kiribati",                  zone: "Pacific/Kiritimati" },
];

// Detect timezone if user has no value set yet (best-effort). Hoisted so the
// expired-block check can judge "now" in the user's own zone.
const detectedTz =
  typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

export default function SchedulingCard({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(() => parsePrefs(initial.schedulingPreferences));
  // "Now" in the user's zone, captured once on mount. Used to hide a
  // fully-passed block (a one-off past its end time, or a recurring block
  // whose repeats have run out) from the editable "No meetings between" list
  // below — the block stays in the data (and so stays drawn in the "Your
  // bookable week" grid), it just drops out of the actionable list.
  const [nowISO] = useState(() => nowISOInZone(initial.timezone ?? detectedTz));
  const [hours, setHours] = useState<MeetingHour[]>(initial.hours);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  // Index of the block awaiting "Add to calendar" confirmation, or null.
  const [confirmAddIdx, setConfirmAddIdx] = useState<number | null>(null);
  // Index of the most recently added block — it opens with its editor expanded;
  // every other block rests as a condensed summary until the user edits it.
  const [expandNewIdx, setExpandNewIdx] = useState<number | null>(null);
  // Per-block calendar sync errors returned by the last save.
  const [blockErrors, setBlockErrors] = useState<string[]>([]);
  // Save indicator for block/pref edits. Driven by sendPrefs (the single
  // network path all block edits funnel through) so the user gets visible
  // confirmation an auto-save landed. Errors are surfaced via blockErrors.
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss the error banner so a transient blip doesn't linger.
  useEffect(() => {
    if (blockErrors.length === 0) return;
    const t = setTimeout(() => setBlockErrors([]), 8000);
    return () => clearTimeout(t);
  }, [blockErrors]);

  // Days the user takes meetings — the default day-set for a new block.
  const activeDays = [...new Set(hours.map((h) => h.dayOfWeek))].sort((a, b) => a - b);

  const [tz, setTz] = useState<string>(initial.timezone ?? detectedTz);

  const hoursSummary = summarizeHours(hours);

  async function persistTimezone(next: string) {
    setTz(next);
    try {
      const res = await fetch("/api/preferences/scheduling", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timezone: next }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { schedulingPreferences?: string | null };
      // If the server re-reconciled mirrored blocks for the new tz, pick up
      // any patched calendarEventIds.
      if (typeof data.schedulingPreferences === "string") {
        setPrefs(parsePrefs(data.schedulingPreferences));
      }
    } catch (err) {
      console.error("[scheduling] persistTimezone failed:", err);
    }
  }

  // Debounced, race-safe persistence of scheduling prefs.
  //
  // Every edit updates local state immediately (so typing stays responsive),
  // but the network write is debounced + coalesced. Holding down a key used to
  // fire one POST per keystroke, flooding /api/preferences/scheduling; the
  // browser would reset some of those in-flight connections and surface a bogus
  // "Couldn't reach the server". A monotonic sequence guard additionally lets
  // only the newest in-flight save reconcile state from the server, so a slow
  // earlier response can't clobber fresher edits (the "year 0002" flap).
  const saveSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Prefs | null>(null);
  // Last prefs the server confirmed — the rollback target when an explicit
  // action (add/remove/Add-to-calendar) fails, so the optimistic state can't
  // get stuck (e.g. a block wedged on "Adding…").
  const serverPrefsRef = useRef<Prefs>(parsePrefs(initial.schedulingPreferences));

  const sendPrefs = useCallback(async (next: Prefs, immediate: boolean) => {
    const seq = ++saveSeqRef.current;
    const isLatest = () => seq === saveSeqRef.current;
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    setSaveStatus("saving");
    // Roll optimistic state back to the last server-confirmed prefs, but only
    // for explicit actions — debounced keystroke saves must keep what the user
    // has since typed rather than snap it back.
    const rollbackIfImmediate = () => {
      if (immediate) setPrefs(serverPrefsRef.current);
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
    try {
      const res = await fetch("/api/preferences/scheduling", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schedulingPreferences: JSON.stringify(next) }),
        signal: controller.signal,
      });
      // An expired session redirects the API call to /login (HTML), which
      // would otherwise surface as a confusing "couldn't reach server".
      if (res.redirected || /\/login/.test(res.url)) {
        if (isLatest()) {
          rollbackIfImmediate();
          setSaveStatus("idle");
          setBlockErrors(["Your session expired — refresh the page and sign in again."]);
        }
        return;
      }
      if (!res.ok) {
        if (isLatest()) {
          rollbackIfImmediate();
          setSaveStatus("idle");
          setBlockErrors(["Couldn’t save your changes — please try again."]);
        }
        return;
      }
      const data = (await res.json()) as {
        schedulingPreferences?: string | null;
        syncErrors?: string[];
      };
      // Only the newest save may reconcile local state from the server, so an
      // out-of-order earlier response can't overwrite what the user has since
      // typed. The server may have populated calendarEventIds on mirrored
      // blocks (or reverted ones that failed to sync); reflect those back so
      // the UI matches the server and edits patch the right event.
      if (!isLatest()) return;
      if (typeof data.schedulingPreferences === "string") {
        const reconciled = parsePrefs(data.schedulingPreferences);
        serverPrefsRef.current = reconciled;
        setPrefs(reconciled);
      }
      const hadSyncErrors = Array.isArray(data.syncErrors) && data.syncErrors.length > 0;
      setBlockErrors(hadSyncErrors ? data.syncErrors! : []);
      // Only confirm "Saved" on a clean save — a sync error surfaces its own
      // banner and shouldn't read as success.
      if (hadSyncErrors) {
        setSaveStatus("idle");
      } else {
        setSaveStatus("saved");
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      }
    } catch (err) {
      console.error("[scheduling] sendPrefs failed:", err);
      if (isLatest()) {
        rollbackIfImmediate();
        setSaveStatus("idle");
        const timedOut = err instanceof DOMException && err.name === "AbortError";
        setBlockErrors([
          timedOut
            ? "That took too long — please try again."
            : "Couldn’t reach the server — please try again.",
        ]);
      }
    } finally {
      clearTimeout(timer);
    }
  }, []);

  // Update local state now; persist to the server either immediately (explicit
  // actions like add/remove block or Add-to-calendar) or debounced (keystroke
  // edits inside a block).
  const persistPrefs = useCallback(
    (next: Prefs, opts?: { immediate?: boolean }) => {
      setPrefs(next);
      setBlockErrors([]);
      pendingRef.current = next;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const flush = (immediate: boolean) => {
        debounceRef.current = null;
        const p = pendingRef.current;
        pendingRef.current = null;
        if (p) void sendPrefs(p, immediate);
      };
      if (opts?.immediate) flush(true);
      else debounceRef.current = setTimeout(() => flush(false), 500);
    },
    [sendPrefs],
  );

  // Flush any pending debounced save on unmount so a last edit isn't lost.
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    [],
  );

  async function persistHours(next: MeetingHour[]) {
    setHours(next);
    try {
      const res = await fetch("/api/preferences/meeting-hours", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hours: next }),
      });
      // An expired session redirects to /login (HTML, still a 200), which
      // would otherwise look like a silent success — see persistPrefs above.
      if (res.redirected || /\/login/.test(res.url)) {
        setBlockErrors(["Your session expired — refresh the page and sign in again."]);
        return;
      }
      if (!res.ok) {
        setBlockErrors(["Couldn’t save your meeting hours — please try again."]);
      }
    } catch (err) {
      console.error("[scheduling] persistHours failed:", err);
      setBlockErrors(["Couldn’t reach the server — please try again."]);
    }
  }

  function onToggle(next: boolean) {
    if (!next) {
      setConfirmingOff(true);
      return;
    }
    setEnabled(true);
    fetch("/api/preferences/scheduling", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
  }

  async function syncCalendar() {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/calendar/google/sync", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        syncErrors?: string[];
      };
      if (res.ok) {
        // The resync re-mirrors blocks to Google Calendar; surface any
        // per-block failures instead of a misleading "resynced".
        const blockErrs = Array.isArray(data.syncErrors) ? data.syncErrors : [];
        if (blockErrs.length > 0) {
          setBlockErrors(blockErrs);
          setSyncMessage("Some blocks didn’t sync");
        } else {
          setSyncMessage("Calendar resynced");
        }
      } else {
        setSyncMessage(data.error ?? "Sync failed");
      }
    } catch {
      setSyncMessage("Sync failed");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  }

  async function confirmPause() {
    setEnabled(false);
    setConfirmingOff(false);
    await fetch("/api/preferences/scheduling", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
  }

  return (
    <>
      <Card variant="bare">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconTile tone="brand-deeper">
              <span className="text-brand-100">{CAL_ICON}</span>
            </IconTile>
            <div>
              <h3 className="font-display text-lg text-white">Scheduling</h3>
              <div className="mt-1">
                <StatusPill tone={enabled ? "active" : "muted"}>
                  {enabled ? "Active · calendar synced" : "Paused"}
                </StatusPill>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={syncCalendar}
              disabled={syncing}
              title="Re-sync your calendar availability"
              className="flex items-center gap-1.5 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2.5 py-1 text-xs text-white/75 transition-colors hover:bg-white/[0.09] disabled:opacity-60"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 14 14"
                fill="none"
                className={syncing ? "animate-spin" : ""}
              >
                <path
                  d="M2 7a5 5 0 0 1 9-3M12 7a5 5 0 0 1-9 3M11 2v3h-3M3 12V9h3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {syncing ? "Syncing…" : syncMessage ?? "Resync calendar"}
            </button>
            <Toggle checked={enabled} onChange={onToggle} aria-label="Toggle scheduling" />
          </div>
        </div>

        {enabled && (
          <div className="space-y-5">
            {(hoursSummary || initial.averageMeetingsPerWeek !== null) && (
              <div className="rounded-card border border-[color:var(--border-subtle)] bg-white/[0.03] px-4 py-3 text-[12px] text-white/70 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {hoursSummary && (
                  <span>
                    You take meetings <span className="text-white">{hoursSummary}</span>.
                  </span>
                )}
                {initial.averageMeetingsPerWeek !== null && (
                  <span className="text-white/55">
                    About <span className="text-white">{initial.averageMeetingsPerWeek}</span> /
                    week on average (last 4 wks).
                  </span>
                )}
              </div>
            )}

            <Card variant="elevated">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
                  Preferred meeting hours
                </span>
                <div className="flex items-center gap-2 text-[11px] text-white/40">
                  <select
                    value={tz}
                    onChange={(e) => persistTimezone(e.target.value)}
                    className="max-w-[260px] truncate rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-0.5 text-[11px] text-white"
                    aria-label="Time zone"
                  >
                    {!TZ_OPTIONS.some((o) => o.zone === tz) && (
                      <option value={tz}>(current) {tz}</option>
                    )}
                    {TZ_OPTIONS.map((o) => (
                      <option key={`${o.offset}-${o.zone}`} value={o.zone}>
                        ({o.offset}) {o.label}
                      </option>
                    ))}
                  </select>
                  {initial.homeCity ? <span>· {initial.homeCity}</span> : null}
                </div>
              </div>
              <MeetingHoursGrid initialHours={hours} onChange={persistHours} />
              <WeekAvailability
                hours={hours}
                blocks={prefs.blockedWindows.map((b) => ({
                  start: b.start,
                  end: b.end,
                  label: b.label,
                  recurrence: b.recurrence,
                  hex:
                    GOOGLE_EVENT_COLORS.find(
                      (c) => c.id === (b.colorId ?? DEFAULT_COLOR_ID),
                    )?.hex ?? "#7986CB",
                }))}
              />
            </Card>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <PrefChip
                label="Default duration"
                unit="min"
                value={prefs.defaultDurationMin}
                options={[15, 20, 30, 45, 60]}
                onChange={(v) => persistPrefs({ ...prefs, defaultDurationMin: v }, { immediate: true })}
              />
              <PrefChip
                label="Buffer between"
                unit="min"
                value={prefs.bufferMin}
                options={[0, 5, 10, 15, 30]}
                onChange={(v) => persistPrefs({ ...prefs, bufferMin: v }, { immediate: true })}
              />
              <PrefChip
                label="Max meetings / day"
                unit=""
                value={prefs.maxPerDay}
                options={[2, 3, 4, 5, 6, 8]}
                onChange={(v) => persistPrefs({ ...prefs, maxPerDay: v }, { immediate: true })}
              />
            </div>

            <Card variant="elevated">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
                    No meetings between
                  </span>
                  {saveStatus !== "idle" && (
                    <span
                      aria-live="polite"
                      className={`text-[10px] transition-opacity ${
                        saveStatus === "saved" ? "text-brand-200" : "text-white/40"
                      }`}
                    >
                      {saveStatus === "saving" ? "Saving…" : "Saved ✓"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExpandNewIdx(prefs.blockedWindows.length);
                    persistPrefs(
                      {
                        ...prefs,
                        blockedWindows: [
                          ...prefs.blockedWindows,
                          {
                            start: "12:00",
                            end: "13:00",
                            label: "",
                            recurrence: defaultRecurrence(activeDays),
                          },
                        ],
                      },
                      { immediate: true },
                    );
                  }}
                  className="rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/[0.09]"
                >
                  + Add block
                </button>
              </div>
              {(() => {
                // A fully-passed block (a one-off past its end time, or a
                // recurring block whose repeats have run out) drops out of this
                // actionable list, but stays in `prefs.blockedWindows` — so it's
                // still drawn in the "Your bookable week" grid above. Keep each
                // block's original index so edit/remove patch the right entry.
                const visible = prefs.blockedWindows
                  .map((b, idx) => [b, idx] as const)
                  .filter(([b]) => !isBlockExpired(b, nowISO));
                return visible.length === 0 ? (
                  <p className="text-[11px] text-white/40">
                    Recurring blocks like lunch, the gym, or a standing meeting. Set how each one
                    repeats, then <span className="text-white/60">Add to calendar</span> to create the
                    event in your Google Calendar.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {visible.map(([b, idx]) => (
                      <BlockRow
                        key={idx}
                        block={b}
                        activeDays={activeDays}
                        defaultExpanded={idx === expandNewIdx}
                        onChange={(nb) => {
                          const next = [...prefs.blockedWindows];
                          next[idx] = nb;
                          persistPrefs({ ...prefs, blockedWindows: next });
                        }}
                        onRemove={() => {
                          const next = prefs.blockedWindows.filter((_, i) => i !== idx);
                          persistPrefs({ ...prefs, blockedWindows: next }, { immediate: true });
                        }}
                        onRequestAdd={() => setConfirmAddIdx(idx)}
                      />
                    ))}
                  </ul>
                );
              })()}
              {blockErrors.length > 0 && (
                <div className="mt-3 space-y-1 rounded-card border border-red-500/30 bg-red-500/10 px-3 py-2">
                  {blockErrors.map((msg, i) => (
                    <p key={i} className="text-[11px] text-red-200">
                      {msg}
                    </p>
                  ))}
                </div>
              )}
            </Card>

            <p className="rounded-card border border-[color:var(--border-brand)] bg-brand-400/8 px-4 py-2 text-[12px] text-white/70">
              Dharma will never propose times outside this window, inside a blocked range, or
              back-to-back without buffer.
            </p>
          </div>
        )}
      </Card>

      <ConfirmModal
        open={confirmingOff}
        title="Pause Scheduling?"
        description="Dharma will stop proposing meeting times. Your calendar connections stay in place."
        confirmLabel="Pause"
        onConfirm={confirmPause}
        onCancel={() => setConfirmingOff(false)}
      />

      {(() => {
        const idx = confirmAddIdx;
        const block = idx !== null ? prefs.blockedWindows[idx] : null;
        const rec = block ? block.recurrence ?? defaultRecurrence(activeDays) : null;
        return (
          <ConfirmModal
            open={idx !== null && !!block && !!rec}
            title="Add to Google Calendar?"
            description={
              block && rec
                ? `This will create “${block.label?.trim() || "Dharma block"}” — ${fmtTime(
                    block.start,
                  )}-${fmtTime(block.end)}, ${recurrenceSummary(rec)}${
                    rec.until ? `, until ${prettyDate(rec.until)}` : ""
                  }, in ${colorName(block.colorId)}. You can edit or remove it anytime.`
                : undefined
            }
            confirmLabel="Add to calendar"
            onConfirm={() => {
              if (idx === null) return;
              const next = [...prefs.blockedWindows];
              const cur = next[idx];
              next[idx] = {
                ...cur,
                mirrorToCalendar: true,
                recurrence: cur.recurrence ?? defaultRecurrence(activeDays),
              };
              persistPrefs({ ...prefs, blockedWindows: next }, { immediate: true });
              setConfirmAddIdx(null);
            }}
            onCancel={() => setConfirmAddIdx(null)}
          />
        );
      })()}
    </>
  );
}

function BlockRow({
  block,
  activeDays,
  defaultExpanded,
  onChange,
  onRemove,
  onRequestAdd,
}: {
  block: BlockedWindow;
  activeDays: number[];
  defaultExpanded: boolean;
  onChange: (b: BlockedWindow) => void;
  onRemove: () => void;
  onRequestAdd: () => void;
}) {
  const rec = block.recurrence ?? defaultRecurrence(activeDays);
  const onCal = !!block.mirrorToCalendar;
  const synced = onCal && !!block.calendarEventId;
  const colorHex =
    GOOGLE_EVENT_COLORS.find((c) => c.id === (block.colorId ?? DEFAULT_COLOR_ID))?.hex ?? "#7986CB";

  // Expansion: every block defaults to a condensed summary so the full editor
  // is only visible while you're actually editing. A freshly-added block opens
  // expanded (defaultExpanded). `override` is the user's explicit toggle
  // (Edit ⇄ Minimize); it's cleared when calendar-sync state flips so adding a
  // block to the calendar collapses the editor back to its summary. The reset
  // is guarded against the mount pass so it can't wipe defaultExpanded.
  const [override, setOverride] = useState<boolean | null>(defaultExpanded ? true : null);
  const prevSynced = useRef(synced);
  useEffect(() => {
    if (prevSynced.current !== synced) {
      prevSynced.current = synced;
      setOverride(null);
    }
  }, [synced]);
  const expanded = override ?? false;

  function setRec(patch: Partial<Recurrence>) {
    onChange({ ...block, recurrence: sanitizeRecurrence({ ...rec, ...patch }) });
  }
  function toggleDay(d: number) {
    const set = new Set(rec.days ?? []);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    setRec({ days: [...set].sort((a, b) => a - b) });
  }
  function setDays(days: number[]) {
    setRec({ days: [...days].sort((a, b) => a - b) });
  }

  const intervalUnit =
    rec.freq === "daily" ? "day(s)" : rec.freq === "weekly" ? "week(s)" : "month(s)";
  const inputCls =
    "rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-1 text-sm text-white";
  const miniInputCls =
    "rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-1 text-xs text-white";

  // Condensed summary — the default resting state for every block. Tap it (or
  // Edit) to open the full editor; Minimize collapses back here.
  if (!expanded) {
    return (
      <li className="rounded-card border border-[color:var(--border-subtle)] bg-white/[0.02] px-3 py-2.5">
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: colorHex }}
            aria-hidden
          />
          <button
            type="button"
            onClick={() => setOverride(true)}
            className="min-w-0 flex-1 text-left"
            aria-label="Edit block"
          >
            <div className="flex items-baseline gap-2">
              <span className="truncate text-sm text-white">
                {block.label?.trim() || "Untitled block"}
              </span>
              <span className="shrink-0 text-[11px] text-white/45">
                {fmtTime(block.start)}-{fmtTime(block.end)}
              </span>
            </div>
            <div className="truncate text-[11px] text-white/40">
              {recurrenceSummary(rec)}
              {onCal ? " · ✓ on your calendar" : " · not on calendar"}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setOverride(true)}
            className="rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/60 hover:bg-white/[0.09]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-white/40 hover:text-white/80 text-sm leading-none px-1"
            aria-label="Remove block"
          >
            ×
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-card border border-[color:var(--border-subtle)] bg-white/[0.02] p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.06em] text-brand-200/70">
          Editing block
        </span>
        <button
          type="button"
          onClick={() => setOverride(false)}
          className="flex items-center gap-1 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/60 hover:bg-white/[0.09]"
          aria-label="Minimize block editor"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M2 5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Minimize
        </button>
      </div>
      {/* time + label + remove */}
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={block.start}
          onChange={(e) => onChange({ ...block, start: e.target.value })}
          className={inputCls}
        />
        <span className="text-white/40 text-xs">to</span>
        <input
          type="time"
          value={block.end}
          onChange={(e) => onChange({ ...block, end: e.target.value })}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="Lunch, gym, …"
          value={block.label ?? ""}
          onChange={(e) => onChange({ ...block, label: e.target.value })}
          className={`flex-1 ${inputCls} placeholder:text-white/30`}
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-white/40 hover:text-white/80 text-sm leading-none px-1"
          aria-label="Remove block"
        >
          ×
        </button>
      </div>

      {/* repeat mode + interval */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
        <span className="uppercase tracking-[0.06em] text-white/35">Repeat</span>
        <select
          value={rec.freq}
          onChange={(e) => setRec({ freq: e.target.value as Recurrence["freq"] })}
          className={miniInputCls}
          aria-label="Repeat frequency"
        >
          {(["none", "daily", "weekly", "monthly"] as const).map((f) => (
            <option key={f} value={f}>
              {FREQ_LABELS[f]}
            </option>
          ))}
        </select>
        {rec.freq !== "none" && (
          <span className="flex items-center gap-1">
            every
            <input
              type="number"
              min={1}
              step={1}
              value={rec.interval ?? 1}
              onChange={(e) => setRec({ interval: Math.max(1, parseInt(e.target.value || "1", 10)) })}
              className={`w-14 ${miniInputCls}`}
              aria-label="Repeat interval"
            />
            {intervalUnit}
          </span>
        )}
      </div>

      {/* weekly day chips + quick-select presets */}
      {rec.freq === "weekly" && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            {WD_INITIAL.map((lbl, d) => {
              const on = (rec.days ?? []).includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  aria-pressed={on}
                  aria-label={WD_FULL[d]}
                  className={`h-7 w-7 rounded-full text-[11px] transition-colors ${
                    on
                      ? "bg-brand-400 text-black font-medium"
                      : "border border-[color:var(--border-subtle)] bg-white/[0.04] text-white/55 hover:bg-white/[0.09]"
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5">
            {DAY_PRESETS.map((p) => {
              const active = sameDays(rec.days ?? [], p.days);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDays(p.days)}
                  aria-pressed={active}
                  className={`rounded-btn px-2 py-0.5 text-[10px] transition-colors ${
                    active
                      ? "border border-brand-400/60 bg-brand-400/15 text-brand-200"
                      : "border border-[color:var(--border-subtle)] bg-white/[0.04] text-white/50 hover:bg-white/[0.09]"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* one-off date */}
      {rec.freq === "none" && (
        <div className="flex items-center gap-2 text-[11px] text-white/60">
          <span className="uppercase tracking-[0.06em] text-white/35">On</span>
          <input
            type="date"
            value={rec.date ?? ""}
            onChange={(e) => setRec({ date: e.target.value })}
            className={miniInputCls}
            aria-label="Block date"
          />
        </div>
      )}

      {/* optional end date for recurring blocks */}
      {rec.freq !== "none" && (
        <div className="flex items-center gap-2 text-[11px] text-white/55">
          <span className="uppercase tracking-[0.06em] text-white/35">Ends</span>
          <input
            type="date"
            value={rec.until ?? ""}
            onChange={(e) => setRec({ until: e.target.value || undefined })}
            className={miniInputCls}
            aria-label="Recurrence end date"
          />
          {rec.until ? (
            <button
              type="button"
              onClick={() => setRec({ until: undefined })}
              className="text-white/40 hover:text-white/70"
            >
              clear
            </button>
          ) : (
            <span className="text-white/30">never</span>
          )}
        </div>
      )}

      {/* event color */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.06em] text-white/35">Color</span>
        <div className="flex items-center gap-1.5">
          {GOOGLE_EVENT_COLORS.map((c) => {
            const selected = (block.colorId ?? DEFAULT_COLOR_ID) === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange({ ...block, colorId: c.id })}
                title={c.id === DEFAULT_COLOR_ID ? `${c.name} (Dharma default)` : c.name}
                aria-label={c.name}
                aria-pressed={selected}
                className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${
                  selected ? "ring-2 ring-white ring-offset-2 ring-offset-[#0d0d12]" : ""
                }`}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      </div>

      {/* status + actions */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-[11px] text-white/40">{recurrenceSummary(rec)}</span>
        {synced ? (
          <span className="flex items-center gap-2 text-[11px]">
            <span className="text-brand-200">✓ On your calendar</span>
            <button
              type="button"
              onClick={() => onChange({ ...block, mirrorToCalendar: false })}
              className="rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-0.5 text-white/60 hover:bg-white/[0.09]"
            >
              Remove from calendar
            </button>
          </span>
        ) : onCal ? (
          <span className="text-[11px] text-white/40">Adding…</span>
        ) : (
          <button
            type="button"
            disabled={!recurrenceValid(rec)}
            onClick={onRequestAdd}
            className="rounded-btn border border-[color:var(--border-brand)] bg-brand-400/10 px-2.5 py-0.5 text-[11px] text-brand-100 hover:bg-brand-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add to calendar
          </button>
        )}
      </div>
    </li>
  );
}

function PrefChip({
  label,
  unit,
  value,
  options,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  // Datalist gives the user both a click-to-pick dropdown (native UI shows
  // a down-arrow on the input) and a free-form number entry. The id has to
  // be stable+unique, so we derive it from the label.
  const listId = `prefchip-${label.replace(/\W+/g, "-").toLowerCase()}-presets`;
  const [draft, setDraft] = useState<string>(String(value));

  // Keep the local input in sync if a parent prefs change overrides it.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <Card variant="elevated" className="!p-3">
      <p className="text-[10px] uppercase tracking-[0.08em] text-white/40">{label}</p>
      <div className="mt-1 flex items-center gap-1">
        <input
          type="number"
          min={0}
          step={1}
          list={listId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = parseInt(draft, 10);
            if (!Number.isNaN(n) && n >= 0 && n !== value) onChange(n);
            else setDraft(String(value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-1.5 text-sm text-white"
        />
        {unit && <span className="shrink-0 text-xs text-white/40">{unit}</span>}
      </div>
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </Card>
  );
}
