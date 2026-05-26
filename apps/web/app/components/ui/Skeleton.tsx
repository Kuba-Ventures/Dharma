type Props = {
  className?: string;
};

export default function Skeleton({ className = "" }: Props) {
  return (
    <div
      className={`animate-pulse rounded-card bg-white/[0.04] ${className}`}
      aria-hidden="true"
    />
  );
}
