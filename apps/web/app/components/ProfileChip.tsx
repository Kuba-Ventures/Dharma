import Link from "next/link";
import { signOut } from "../../lib/auth";
import { type Badge } from "../../lib/badges";
import {
  BADGE_COLOR_BG,
  BADGE_ICON_PATHS,
  BASQUIAT_OUTLINE,
  BASQUIAT_YELLOW,
  JEWEL_FILL,
  JEWEL_STROKE,
} from "../../lib/badgeIcons";

type Props = {
  user: {
    image?: string | null;
    firstName?: string | null;
    name?: string | null;
    email?: string | null;
  };
  displayBadge?: Badge | null;
};

export default function ProfileChip({ user, displayBadge }: Props) {
  const displayName =
    user.firstName ?? user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "You";

  return (
    <div className="mt-3 flex items-center gap-1.5 border-t border-[color:var(--border-subtle)] pt-3">
      <Link
        href="/settings"
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
            <span
              className={`absolute -bottom-2 -right-2 ${displayBadge.color === "yellow" ? "" : BADGE_COLOR_BG[displayBadge.color].split(" ").filter((c) => c.startsWith("text-")).join(" ")}`}
              aria-label={displayBadge.title}
            >
              {displayBadge.iconImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayBadge.iconImage} alt="" width={22} height={22} />
              ) : (
                <svg width="22" height="22" viewBox="0 0 14 14" fill="none">
                  <path
                    d={BADGE_ICON_PATHS[displayBadge.icon]}
                    stroke={JEWEL_STROKE[displayBadge.color]}
                    strokeWidth={displayBadge.color === "yellow" ? 1.8 : 1.4}
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
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-white">{displayName}</p>
          {displayBadge && (
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-200">
              {displayBadge.title}
            </p>
          )}
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
