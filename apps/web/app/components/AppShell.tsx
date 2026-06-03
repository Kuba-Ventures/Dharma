"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

// App chrome wrapper. On desktop (md+) the sidebar is a static column exactly
// as before. On mobile it becomes an off-canvas drawer: a top bar with a
// hamburger reveals it, a backdrop dims the page, and it auto-closes on
// navigation, on Escape, or on backdrop tap.
export default function AppShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (i.e. a nav link was tapped).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While the drawer is open on mobile, lock body scroll and wire up Escape.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex min-h-screen bg-[color:var(--bg-app)]">
      {/* Sidebar — static column on desktop, slide-in drawer on mobile. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[82vw] shrink-0 flex-col border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-sidebar)] px-3 py-7 transition-transform duration-300 ease-out md:static md:z-auto md:w-52 md:max-w-none md:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
        aria-hidden={!open ? undefined : false}
      >
        {sidebar}
      </aside>

      {/* Backdrop — mobile only, only while the drawer is open. */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — hidden on desktop. */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-app)]/85 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M2.5 4.5h13M2.5 9h13M2.5 13.5h13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Image src="/logo.png" alt="Dharma" width={24} height={24} priority />
            <span className="text-sm font-bold text-white">Dharma</span>
          </Link>
        </header>

        <main className="flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
      </div>
    </div>
  );
}
