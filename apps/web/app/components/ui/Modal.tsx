"use client";

import { ReactNode, useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ open, onClose, children }: Props) {
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
      className="w-full max-w-md rounded-hero border border-[color:var(--border-subtle)] bg-[color:var(--bg-app)] p-6 text-white backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      {children}
    </dialog>
  );
}
