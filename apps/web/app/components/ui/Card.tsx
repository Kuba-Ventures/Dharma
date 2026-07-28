import { HTMLAttributes } from "react";

type Variant = "default" | "elevated" | "bare";

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
};

export default function Card({
  variant = "default",
  className = "",
  ...props
}: Props) {
  // `bare` drops the frame (border, padding, background) so the content can sit
  // flush inside a parent that already provides the surface — e.g. the unified
  // Configuration panel, where ConfigTabs owns the single card border.
  const frame =
    variant === "bare"
      ? ""
      : "rounded-card border border-[color:var(--border-subtle)] p-5";
  const surface =
    variant === "elevated"
      ? "bg-[color:var(--bg-card-elevated)]"
      : variant === "bare"
        ? ""
        : "bg-[color:var(--bg-card)]";
  return (
    <div className={`${frame} ${surface} ${className}`.trim()} {...props} />
  );
}
