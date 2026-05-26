import { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  trailing?: ReactNode;
};

export default function SectionHeader({ eyebrow, title, trailing }: Props) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-brand-200">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-xl text-white">{title}</h2>
      </div>
      {trailing && <div>{trailing}</div>}
    </div>
  );
}
