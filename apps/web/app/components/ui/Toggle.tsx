"use client";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
};

export default function Toggle({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[18px] w-8 items-center rounded-full transition-colors duration-200 ${
        checked ? "bg-brand-400" : "bg-white/[0.12]"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[16px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}
