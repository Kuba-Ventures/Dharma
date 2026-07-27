"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Badge } from "../../../lib/badges";
import {
  BADGE_ICON_PATHS,
  BADGE_COLOR_BG,
  JEWEL_FILL,
  JEWEL_STROKE,
} from "../../../lib/badgeIcons";

type Props = {
  user: {
    image: string | null;
    name: string | null;
    firstName: string | null;
    email: string | null;
    createdAt: string;
  };
  displayBadge: Badge | null;
};

export default function IdentityCard({ user, displayBadge }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName ?? user.name?.split(" ")[0] ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [imageBroken, setImageBroken] = useState(false);

  async function saveName() {
    setSaving(true);
    await fetch("/api/profile/update", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName }),
    });
    setSaving(false);
    setSavedAt(Date.now());
    router.refresh();
  }

  const initials = (user.firstName ?? user.name ?? user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          {user.image && !imageBroken ? (
            // Plain <img> bypasses Next.js Image's domain rules. Google avatar
            // URLs occasionally fail (CORS, expired token); onError falls back
            // to the initials circle.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "You"}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover"
              onError={() => setImageBroken(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-400/30 text-2xl font-medium text-brand-100">
              {initials}
            </div>
          )}
          {displayBadge && (
            <span
              aria-label={displayBadge.title}
              className={`absolute -bottom-3 -right-3 ${displayBadge.color === "yellow" ? "" : BADGE_COLOR_BG[displayBadge.color].split(" ").filter((c) => c.startsWith("text-")).join(" ")}`}
            >
              {displayBadge.iconImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayBadge.iconImage} alt="" width={42} height={42} />
              ) : (
                <svg width="42" height="42" viewBox="0 0 14 14" fill="none">
                  <path
                    d={BADGE_ICON_PATHS[displayBadge.icon]}
                    stroke={JEWEL_STROKE[displayBadge.color]}
                    strokeWidth={displayBadge.color === "yellow" ? 1.6 : 1.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill={JEWEL_FILL[displayBadge.color]}
                    fillOpacity={1}
                  />
                </svg>
              )}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/40">
              First name
            </p>
            <div className="flex gap-2">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={saveName}
                className="flex-1 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-2 text-sm text-white"
              />
            </div>
            <p className="mt-0.5 text-[11px] text-white/40">{user.email}</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-white/30">
            Joined {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      {savedAt && (
        <p className="mt-3 text-[11px] text-[color:var(--label-2)]">Saved.</p>
      )}
      {saving && (
        <p className="mt-3 text-[11px] text-white/40">Saving…</p>
      )}
    </div>
  );
}
