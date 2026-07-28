"use client";

import { useState } from "react";
import { GMAIL_COLOR_ROWS } from "@/lib/gmailPalette";
import { readableTextColor } from "@/lib/labelTextColor";

// Inbox-style label editor: renders each label as a solid Gmail-style tag
// (the color it will show as in the user's inbox), and opens a small popover to
// rename, recolor, or remove it. Same prop shape as <LabelEditor> so LabelsCard
// can swap between them; the older row editor is still used by onboarding.

export type LabelTagRow = { shortName: string; colorKey: string };

type Props = {
  rows: LabelTagRow[];
  /** Called with the picked palette hex for row `idx`. */
  onColorChange: (idx: number, hex: string) => void;
  /** Called on each keystroke in row `idx`'s name field. */
  onNameChange: (idx: number, name: string) => void;
  /** Called on blur of a name field (parent persists here). */
  onNameCommit?: () => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  /** Remove is disabled at/below this row count. Default 1. */
  minRows?: number;
  addLabelText?: string;
};

const DEFAULT_TAG_HEX = "#999999";

export default function LabelTags({
  rows,
  onColorChange,
  onNameChange,
  onNameCommit,
  onAdd,
  onRemove,
  minRows = 1,
  addLabelText = "+ Add label",
}: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {rows.map((label, idx) => {
        const hex = label.colorKey || DEFAULT_TAG_HEX;
        const open = openIdx === idx;
        return (
          <div key={idx} className="relative">
            <button
              type="button"
              data-testid="label-tag"
              onClick={() => setOpenIdx(open ? null : idx)}
              className="rounded-md px-2.5 py-1 text-xs font-medium leading-none transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: hex, color: readableTextColor(hex) }}
            >
              {label.shortName.trim() || "Untitled"}
            </button>

            {open && (
              <div className="absolute left-0 top-8 z-20 w-56 space-y-2.5 rounded-btn border border-[color:var(--border-subtle)] bg-[#1a1a24] p-3 shadow-xl">
                <input
                  type="text"
                  value={label.shortName}
                  autoFocus
                  onChange={(e) => onNameChange(idx, e.target.value)}
                  onBlur={onNameCommit}
                  placeholder="Label name"
                  className="w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2.5 py-1.5 text-sm text-white placeholder:text-white/30"
                />
                <div className="space-y-1.5">
                  {GMAIL_COLOR_ROWS.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex gap-1.5">
                      {row.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => onColorChange(idx, h)}
                          className={`h-4 w-4 rounded-full transition-transform ${
                            h.toLowerCase() === hex.toLowerCase()
                              ? "scale-125 ring-1 ring-white/50"
                              : "opacity-80 hover:scale-110 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: h }}
                          aria-label={h}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onRemove(idx);
                      setOpenIdx(null);
                    }}
                    disabled={rows.length <= minRows}
                    aria-label="Remove label"
                    className="text-[11px] text-white/40 transition-colors hover:text-red-400/70 disabled:opacity-30"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenIdx(null)}
                    className="text-[11px] text-white/40 transition-colors hover:text-white/70"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        className="rounded-md border border-dashed border-[color:var(--border-subtle)] px-2.5 py-1 text-xs text-white/45 transition-colors hover:text-white/75"
      >
        {addLabelText}
      </button>
    </div>
  );
}
