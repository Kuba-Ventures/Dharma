type Props = {
  firstName: string;
  timezone: string | null;
};

function dayPart(timezone: string | null): "morning" | "afternoon" | "evening" {
  const hour = parseInt(
    new Date().toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone ?? undefined,
    }),
    10,
  );
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formattedDate(timezone: string | null): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone ?? undefined,
  });
}

export default function Greeting({ firstName, timezone }: Props) {
  const part = dayPart(timezone);
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
        {formattedDate(timezone)}
      </p>
      <h1 className="mt-1 font-display text-3xl text-white">
        Good {part}, {firstName}.
      </h1>
    </div>
  );
}
