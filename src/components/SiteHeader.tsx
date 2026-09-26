"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The site header, shared by every page.
 *
 * This replaces six copy-pasted <header> blocks. They had all drifted
 * apart (different max-widths, different active-link handling, some
 * showing a Groups link and some not) and every one of them hid the nav
 * behind `md:flex` with no mobile fallback, so below 768px there was no
 * navigation at all.
 *
 * Server pages read the session and pass `loggedIn` down; the interactive
 * bits (the mobile sheet) are client-side.
 */

const NAV = [
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/rank-history", label: "Rank History" },
  { href: "/groups", label: "Groups" },
] as const;

export default function SiteHeader({
  loggedIn = false,
  width = "max-w-7xl",
  withBorder = true,
}: {
  loggedIn?: boolean;
  /** Match the calling page's container so the header lines up with content. */
  width?: string;
  withBorder?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the sheet on navigation. Without this it stays open over the
  // page you just clicked into.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the sheet is open so the page behind doesn't
  // scroll on iOS.
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const isActive = (href: string) => pathname === href;

  const navLinks = NAV.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={
        isActive(item.href)
          ? "text-white transition-colors"
          : "text-zinc-400 transition-colors hover:text-white"
      }
    >
      {item.label}
    </Link>
  ));

  return (
    <header className={`border-b border-white/10 ${withBorder ? "" : "border-0"}`}>
      <div className={`mx-auto flex h-16 ${width} items-center justify-between px-4 sm:px-6`}>
        <Link href="/" className="shrink-0 text-xl font-bold tracking-tight">
          AIM<span className="text-zinc-500">BENCH</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 text-sm md:flex">{navLinks}</nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {loggedIn ? (
            <>
              <Link
                href="/profile"
                className="hidden rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 sm:block"
              >
                Profile
              </Link>
              <form action="/api/auth/logout" method="post" className="hidden sm:block">
                <button
                  type="submit"
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Log Out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 sm:px-4"
              >
                Create Account
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="-mr-2 rounded-lg p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white md:hidden"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {open ? (
                <>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </>
              ) : (
                <>
                  <path d="M3 12h18" />
                  <path d="M3 6h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-16 z-40 bg-black/60 md:hidden"
          />
          <div
            id="mobile-nav"
            className="animate-fade-in fixed inset-x-0 top-16 z-50 border-b border-white/10 bg-[#0a0a0a] shadow-2xl md:hidden"
          >
            <nav className="flex flex-col px-4 py-2 text-base">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`border-b border-white/5 py-3.5 transition-colors last:border-0 ${
                    isActive(item.href) ? "text-white" : "text-zinc-400"
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              <div className="flex flex-col gap-2 py-4">
                {loggedIn ? (
                  <>
                    <Link
                      href="/profile"
                      className="rounded-lg bg-white px-4 py-2.5 text-center text-sm font-medium text-black"
                    >
                      Profile
                    </Link>
                    <form action="/api/auth/logout" method="post">
                      <button
                        type="submit"
                        className="w-full rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white"
                      >
                        Log Out
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="rounded-lg border border-white/15 px-4 py-2.5 text-center text-sm font-medium text-white"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-lg bg-white px-4 py-2.5 text-center text-sm font-medium text-black"
                    >
                      Create Account
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
