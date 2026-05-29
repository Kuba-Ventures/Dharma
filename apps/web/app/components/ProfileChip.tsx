import Link from "next/link";
import { signOut } from "../../lib/auth";
import { type Badge } from "../../lib/badges";
import {
  BADGE_COLOR_BG,
  BADGE_ICON_PATHS,
  BASQUIAT_OUTLINE,
  BASQUIAT_YELLOW,
} from "../../lib/badgeIcons";

type Props = {
  user: {
    image?: string | null;
    firstName?: string | null;
    name?: string | null;
    email?: string | null;
    tier?: string | null;
  };
  displayBadge?: Badge | null;
};

export default function ProfileChip({ user, displayBadge }: Props) {
  const displayName =
    user.firstName ?? user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "You";
  const tier = user.tier ?? "Apprentice";

  return (
    <div className="mt-3 flex items-center gap-1.5 border-t border-[color:var(--border-subtle)] pt-3">
      <Link
        href="/profile"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-card p-1.5 transition-colors hover:bg-white/[0.04]"
      >
        <div className="relative shrink-0">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={displayName}
              width={28}
              height={28}
              className="h-7 w-7 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-400/30 text-[11px] font-medium text-brand-100">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          {displayBadge && (
            <div
              className={`absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[color:var(--bg-sidebar)] ${BADGE_COLOR_BG[displayBadge.color]}`}
              aria-label={displayBadge.title}
            >
              <svg width="8" height="8" viewBox="0 0 14 14" fill="none">
                <path
                  d={BADGE_ICON_PATHS[displayBadge.icon]}
                  stroke={displayBadge.color === "yellow" ? BASQUIAT_OUTLINE : "currentColor"}
                  strokeWidth={displayBadge.color === "yellow" ? 1.8 : 1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={displayBadge.color === "yellow" ? BASQUIAT_YELLOW : "currentColor"}
                  fillOpacity={displayBadge.color === "yellow" ? 1 : 0.3}
                />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-white">{displayName}</p>
          <p className="text-[10px] uppercase tracking-wide text-brand-200">{tier}</p>
        </div>
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          aria-label="Sign out"
          className="flex h-7 w-7 items-center justify-center rounded-card text-white/30 transition-colors hover:bg-white/[0.04] hover:text-white/70"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M5 1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M7 8l3-2-3-2M10 6H5"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}
