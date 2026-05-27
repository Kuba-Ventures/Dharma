"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";

export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!message.trim()) return;
    setSubmitting(true);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "feedback", message, page: pathname }),
    });
    setSubmitting(false);
    setSent(true);
    setTimeout(() => {
      setOpen(false);
      setSent(false);
      setMessage("");
    }, 1200);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-btn border border-transparent px-3 py-2 text-[12px] text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/70"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 3h10v6H6.5L3.5 11.5V9H2z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        Send feedback
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h3 className="font-display text-lg text-white">Send feedback</h3>
        <p className="mt-1 text-[12px] text-white/60">
          Anything broken, confusing, or worth keeping? We read every note.
        </p>
        <textarea
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="What's on your mind?"
          className="mt-3 w-full resize-none rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.04] p-3 text-sm text-white placeholder:text-white/30"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={submitting || sent || !message.trim()}
          >
            {sent ? "Sent" : submitting ? "Sending…" : "Send"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
