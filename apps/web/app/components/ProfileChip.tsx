import Image from "next/image";
import Link from "next/link";
import { signOut } from "../../lib/auth";

type Props = {
  user: {
    image?: string | null;
    firstName?: string | null;
    name?: string | null;
    email?: string | null;
    tier?: string | null;
  };
};

export default function ProfileChip({ user }: Props) {
  const displayName =
    user.firstName ?? user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "You";
  const tier = user.tier ?? "Apprentice";

  return (
    <div className="mt-3 flex items-center gap-1.5 border-t border-[color:var(--border-subtle)] pt-3">
      <Link
        href="/settings/profile"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-card p-1.5 transition-colors hover:bg-white/[0.04]"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={displayName}
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-400/30 text-[11px] font-medium text-brand-100">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
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
