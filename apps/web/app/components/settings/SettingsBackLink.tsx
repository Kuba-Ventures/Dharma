import Link from "next/link";

// Back link for Settings subpages so users can return to the Settings index
// without reaching for the sidebar tab again.
export default function SettingsBackLink() {
  return (
    <Link
      href="/settings"
      className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-white/45 transition-colors hover:text-white/80"
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M9 3L5 7l4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Settings
    </Link>
  );
}
