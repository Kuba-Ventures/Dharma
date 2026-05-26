"use client";

import Button from "./Button";
import Modal from "./Modal";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal open={open} onClose={onCancel}>
      <h3 className="font-display text-lg text-white mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-white/70 mb-5">{description}</p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
