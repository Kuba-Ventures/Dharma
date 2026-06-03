// A thin radial progress ring drawn around a badge icon to show how far a user
// is toward the next tier in a group. Pure presentational — pct is 0..1.

export default function BadgeProgressRing({
  pct,
  color,
  size = 48,
}: {
  pct: number;
  color: string; // hex stroke for the progress arc
  size?: number;
}) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  const offset = circumference * (1 - clamped);
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0 -rotate-90"
      aria-hidden
    >
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-white/10"
      />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}
