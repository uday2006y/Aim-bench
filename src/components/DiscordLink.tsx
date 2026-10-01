import Link from "next/link";

/**
 * The community Discord invite, pinned to the bottom-right of every page.
 *
 * Lives in the root layout rather than SiteHeader because not every page
 * renders the header: login and register do not, and an invite is exactly the
 * thing someone on the login screen wants.
 *
 * The logo and the word are one link, not two. Two links to the same
 * destination doubles the tab stop for no gain, and a half-clickable pair
 * reads as a mistake.
 */
const INVITE_URL = "https://discord.gg/easyaim";

export default function DiscordLink() {
  return (
    <Link
      href={INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-zinc-950/90 px-3 py-2 shadow-2xl backdrop-blur transition hover:border-[#5865F2]/60 hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]"
    >
      {/* Inline SVG rather than an <img>: no network request, no layout shift,
          and it inherits currentColor so it tints with the hover state. */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="text-[#5865F2] transition group-hover:text-[#7b86f5]"
      >
        <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.79 19.79 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.006-.128C10.16 17.658 11 17.164 12 17.164c1 0 1.839.494 2.832 1.306a.077.077 0 0 0-.006.128c-.6.342-1.22.636-1.872.892a.076.076 0 0 0-.041.106c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.673-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176.996 2.176 2.42 0 1.333-.966 2.418-2.176 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176.996 2.176 2.42 0 1.333-.946 2.418-2.176 2.418Z" />
      </svg>

      <span className="text-sm font-bold tracking-wide">DISCORD</span>
    </Link>
  );
}