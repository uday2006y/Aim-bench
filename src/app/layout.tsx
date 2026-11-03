import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Orbitron,
  Playfair_Display,
  Rajdhani,
  Space_Grotesk,
} from "next/font/google";
import AccountProvider from "@/components/AccountProvider";
import DiscordLink from "@/components/DiscordLink";
import ThemeProvider from "@/components/ThemeProvider";
import { loadMe } from "@/lib/me";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The extra theme fonts are not preloaded: a font file only downloads once the
// player actually picks it, so the default theme costs nothing extra.
// (next/font needs each option written out literally, so no shared object.)
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap", preload: false });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], display: "swap", preload: false });
const orbitron = Orbitron({ variable: "--font-orbitron", subsets: ["latin"], display: "swap", preload: false });
const rajdhani = Rajdhani({ variable: "--font-rajdhani", weight: ["400", "500", "600", "700"], subsets: ["latin"], display: "swap", preload: false });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap", preload: false });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap", preload: false });

const FONT_VARS = [geistSans, geistMono, inter, grotesk, orbitron, rajdhani, jetbrains, playfair]
  .map((font) => font.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "AIMBENCH — Aim Benchmark Tracker",
  description:
    "Profiles, compete on scenarios, track your scores and compare your performance with other players.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const me = await loadMe();

  return (
    <html
      lang="en"
      className={`${FONT_VARS} h-full antialiased`}
      // The boot script below sets theme variables and data-* attributes on
      // <html> before React hydrates, so the attributes legitimately differ
      // from the server markup.
      suppressHydrationWarning
    >
      <head>
        {/* Paints the saved theme before first paint, so it never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/*
          Clip paths for the curved progress-bar styles.

          objectBoundingBox units are 0..1 on both axes, so these paths
          scale to whatever size the bar renders at. The slanted styles
          use clip-path polygon() in CSS and don't need an entry here.

          Not display:none — some engines refuse to resolve a clip-path
          reference from a hidden SVG.
        */}
        <svg
          aria-hidden="true"
          focusable="false"
          width="0"
          height="0"
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        >
          <defs>
            {/* Both ends carry the same curve, leaning right as they rise,
                so the right end is widest at the top and points up rather
                than down. The two curves are identical, offset by 0.84:
                the left runs (0,1)->(.16,0) and the right (1,0)->(.84,1),
                giving a constant 0.84 bar width at every height. */}
            <clipPath id="aim-bar-ribbon" clipPathUnits="objectBoundingBox">
              <path d="M 0 1 C 0 0.7, 0.03 0.25, 0.16 0 L 1 0 C 1 0.25, 0.97 0.7, 0.84 1 Z" />
            </clipPath>
          </defs>
        </svg>
        <ThemeProvider>
          <AccountProvider me={me}>
            <div className="flex flex-1 flex-col">{children}</div>
            <DiscordLink />
          </AccountProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}