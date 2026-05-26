import { ReactNode } from "react";

type Tone = "brand" | "brand-deep" | "brand-deeper";

const TONE: Record<Tone, string> = {
  brand: "bg-brand-400/15 text-brand-200",
  "brand-deep": "bg-brand-600/20 text-brand-100",
  "brand-deeper": "bg-brand-800/30 text-brand-100",
};

type Props = {
  tone?: Tone;
  children: ReactNode;
};

export default function IconTile({ tone = "brand", children }: Props) {
  return (
    <div
      className={`flex h-9 w-9 items-center justify-center rounded-card ${TONE[tone]}`}
    >
      {children}
    </div>
  );
}
