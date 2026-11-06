"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "./AccountProvider";

/**
 * The site navigation, shared by every page.
 *
 * It is a left sidebar on desktop and a top bar with a slide-in sheet on
 * mobile. The player's account sits at the bottom-left: signed out it is the
 * Login and Create Account buttons, signed in it is only the Discord avatar and
 * the EasyAim name in bold (a fixed font, so it never changes with the theme).
 *
 * Pages still render <SiteHeader loggedIn /> exactly as before; `width` and
 * `withBorder` are accepted for compatibility and no longer needed.
 */

const NAV = [
  { href: "/benchmarks", label: "Benchmarks", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/create-benchmark", label: "Create benchmark", icon: "M12 5v14M5 12h14" },
  { href: "/leaderboard", label: "Leaderboard", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" },
  { href: "/rank-history", label: "Rank History", icon: "M3 17l6-6 4 4 8-8M15 7h6v6" },
  { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" },
  { href: "/theme-settings", label: "Theme", icon: "M12 3a9 9 0 1 0 0 18 2 2 0 0 0 2-2c0-.6-.2-1-.5-1.4a2 2 0 0 1 1.5-3.3H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3ZM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01" },
] as const;

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function Brand() {
  return (
    <Link href="/" className="side-brand" aria-label="AimBench home">
      <svg width="28" height="28" viewBox="0 0 128 128" aria-hidden="true">
        <g fill="none" strokeLinecap="round" stroke="var(--accent)">
          <circle cx="64" cy="64" r="40" strokeWidth="9" strokeDasharray="40.83 22" strokeDashoffset="51.83" />
          <path d="M64 6V30M64 98V122M6 64H30M98 64H122" strokeWidth="8" />
        </g>
        <rect x="46" y="68" width="10" height="16" rx="3" fill="var(--text)" />
        <rect x="60" y="56" width="10" height="28" rx="3" fill="var(--text)" />
        <rect x="74" y="44" width="10" height="40" rx="3" fill="var(--accent)" />
      </svg>
      <span>
        AIM<span className="side-brand-dim">BENCH</span>
      </span>
    </Link>
  );
}

export default function SiteHeader({
  loggedIn = false,
}: {
  loggedIn?: boolean;
  /** Kept so existing pages compile unchanged; the sidebar does not need them. */
  width?: string;
  withBorder?: boolean;
}) {
  const pathname = usePathname();
  const account = useAccount();
  const signedIn = loggedIn || Boolean(account);

  // Both the mobile sheet and the account menu remember the route they were
  // opened on and only count as open while it is still the current one, so
  // navigating closes them without an effect watching the route.
  const [ui, setUi] = useState({ sheet: false, menu: false, route: pathname });
  const sheetOpen = ui.sheet && ui.route === pathname;
  const menuOpen = ui.menu && ui.route === pathname;

  const setSheet = useCallback(
    (next: boolean) => setUi((s) => ({ ...s, sheet: next, route: pathname })),
    [pathname]
  );
  const setMenu = useCallback(
    (next: boolean) => setUi((s) => ({ ...s, menu: next, route: pathname })),
    [pathname]
  );

  useEffect(() => {
    if (!sheetOpen && !menuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSheet(false);
        setMenu(false);
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!(event.target as HTMLElement).closest("[data-account]")) setMenu(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [sheetOpen, menuOpen, setSheet, setMenu]);

  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const name = account?.name ?? "Account";

  const accountBlock = (
    <div className="side-account-wrap" data-account>
      {signedIn ? (
        <>
          {menuOpen && (
            <div className="side-pop" role="menu">
              <Link href="/profile" role="menuitem">Profile</Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" role="menuitem">Log out</button>
              </form>
            </div>
          )}
          <button
            type="button"
            className="side-account"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenu(!menuOpen)}
          >
            {account?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.avatar} alt="" className="side-avatar" />
            ) : (
              <span className="side-avatar side-avatar-fallback" aria-hidden="true">
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="fixed-name">{name}</span>
          </button>
        </>
      ) : (
        <div className="side-auth">
          <Link href="/login" className="btn btn-ghost">Login</Link>
          <Link href="/register" className="btn btn-primary">Create Account</Link>
        </div>
      )}
    </div>
  );

  const body = (
    <>
      <Brand />
      <nav className="side-nav" aria-label="Main">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="side-link"
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            <Icon d={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="side-spacer" />
      {accountBlock}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="app-sidebar">{body}</aside>

      {/* Mobile top bar + sheet */}
      <div className="mobile-topbar">
        <Brand />
        <button
          type="button"
          onClick={() => setSheet(!sheetOpen)}
          aria-expanded={sheetOpen}
          aria-label={sheetOpen ? "Close menu" : "Open menu"}
          className="side-burger"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {sheetOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {sheetOpen && (
        <>
          <button type="button" aria-hidden="true" tabIndex={-1} className="side-scrim" onClick={() => setSheet(false)} />
          <aside className="app-sidebar app-sidebar-sheet">{body}</aside>
        </>
      )}

      {/* Scores only move when the sync engine runs. One line, above the
          content, on every page except the profile (where the button is). */}
      {signedIn && !pathname.startsWith("/profile") && (
        <div className="sync-note">
          <span>Scores update when you sync.</span>
          <Link href="/profile">Go to Profile and click “Sync now”</Link>
        </div>
      )}
    </>
  );
}
