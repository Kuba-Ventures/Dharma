"use client";

import { useState } from "react";
import Button from "../../../components/ui/Button";

type Item = { id: string; label: string };

type Props = {
  items: Item[];
};

export default function HiddenStatsList({ items: initial }: Props) {
  const [items, setItems] = useState(initial);

  async function restore(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch("/api/user/dismiss/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function clearAll() {
    setItems([]);
    await fetch("/api/user/dismiss/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-6 text-center text-sm text-white/50">
        Nothing dismissed yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] px-4 py-3"
          >
            <p className="text-sm text-white">{item.label}</p>
            <Button variant="secondary" size="sm" onClick={() => restore(item.id)}>
              Restore
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Restore all
        </Button>
      </div>
    </div>
  );
}
