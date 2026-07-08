"use client";

import { useState } from "react";
import { GMAIL_COLOR_ROWS } from "@/lib/gmailPalette";

// Shared, presentational label-list editor: a color-swatch dot + name input +
// remove control per row, plus an "add" button. It owns no business logic —
// the parent supplies the rows and the mutation callbacks. Used by the config
// LabelsCard and (Stage 4) the onboarding personalize step, so both surfaces
// render identical editing UI from one source.

/** Only the fields the editor reads. Parents may carry extra fields (displayHex, etc.). */
export type LabelEditorRow = { shortName: string; colorKey: string };

type Props = {
  rows: LabelEditorRow[];
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
  namePlaceholder?: string;
};

export default function LabelEditor({
  rows,
  onColorChange,
  onNameChange,
  onNameCommit,
  onAdd,
  onRemove,
  minRows = 1,
  addLabelText = "+ Add label",
  namePlaceholder = "follow-up",
}: Props) {
  return (
    <>
      <div className="mt-2 space-y-2">
        {rows.map((label, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <ColorPickerDot
              selectedHex={label.colorKey}
              onPick={(hex) => onColorChange(idx, hex)}
            />
            <input
              type="text"
              value={label.shortName}
              onChange={(e) => onNameChange(idx, e.target.value)}
              onBlur={onNameCommit}
              placeholder={namePlaceholder}
              className="flex-1 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-1.5 text-sm text-white placeholder:text-white/30"
            />
            <button
              type="button"
              onClick={() => onRemove(idx)}
              disabled={rows.length <= minRows}
              aria-label="Remove label"
              className="px-2 text-base leading-none text-white/30 transition-colors hover:text-red-400/70 disabled:opacity-30 disabled:hover:text-white/30"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 text-[11px] text-white/40 transition-colors hover:text-white/70"
      >
        {addLabelText}
      </button>
    </>
  );
}

function ColorPickerDot({
  selectedHex,
  onPick,
}: {
  selectedHex: string;
  onPick: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-5 w-5 rounded-full border border-white/20 ring-1 ring-black/40"
        style={{ backgroundColor: selectedHex }}
        aria-label="Pick color"
      />
      {open && (
        <div className="absolute left-0 top-7 z-20 space-y-1.5 rounded-btn border border-[color:var(--border-subtle)] bg-[#1f1f1f] p-2 shadow-lg">
          {GMAIL_COLOR_ROWS.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1.5">
              {row.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => {
                    onPick(hex);
                    setOpen(false);
                  }}
                  className={`h-4 w-4 rounded-full transition-transform ${
                    hex.toLowerCase() === selectedHex.toLowerCase()
                      ? "scale-125 ring-1 ring-white/50"
                      : "opacity-80 hover:scale-110 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: hex }}
                  aria-label={hex}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
