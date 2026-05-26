"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand-400 hover:bg-brand-600 text-white",
  secondary:
    "bg-white/[0.05] hover:bg-white/[0.09] text-white border border-[color:var(--border-subtle)]",
  ghost: "text-white/70 hover:text-white hover:bg-white/[0.05]",
  danger:
    "bg-[color:var(--label-3)]/15 hover:bg-[color:var(--label-3)]/25 text-[color:var(--label-3)] border border-[color:var(--label-3)]/30",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-1.5 rounded-btn font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    />
  );
});

export default Button;
