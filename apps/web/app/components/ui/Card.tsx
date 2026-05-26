import { HTMLAttributes } from "react";

type Variant = "default" | "elevated";

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
};

export default function Card({
  variant = "default",
  className = "",
  ...props
}: Props) {
  const surface =
    variant === "elevated"
      ? "bg-[color:var(--bg-card-elevated)]"
      : "bg-[color:var(--bg-card)]";
  return (
    <div
      className={`rounded-card border border-[color:var(--border-subtle)] p-5 ${surface} ${className}`}
      {...props}
    />
  );
}
