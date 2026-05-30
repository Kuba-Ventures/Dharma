import { ReactNode } from "react";

type Tone = "brand" | "brand-deep" | "brand-deeper";
type Size = "md" | "lg";

const TONE: Record<Tone, string> = {
  brand: "bg-brand-400/15 text-brand-200",
  "brand-deep": "bg-brand-600/20 text-brand-100",
  "brand-deeper": "bg-brand-800/30 text-brand-100",
};

const SIZE: Record<Size, string> = {
  md: "h-9 w-9",
  lg: "h-[72px] w-[72px]",
};

type Props = {
  tone?: Tone;
  size?: Size;
  children: ReactNode;
};

export default function IconTile({ tone = "brand", size = "md", children }: Props) {
  return (
    <div
      className={`flex items-center justify-center rounded-card ${SIZE[size]} ${TONE[tone]}`}
    >
      {children}
    </div>
  );
}
