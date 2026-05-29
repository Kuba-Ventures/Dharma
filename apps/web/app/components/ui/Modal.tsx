"use client";

import { ReactNode, useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
};

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function Modal({ open, onClose, children, size = "md" }: Props) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`w-full ${SIZE_CLASS[size]} max-h-[85vh] overflow-hidden rounded-hero border border-[color:var(--border-subtle)] bg-[color:var(--bg-app)] p-6 text-white backdrop:bg-black/60 backdrop:backdrop-blur-sm`}
    >
      {children}
    </dialog>
  );
}
