import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Brunson, self-hosted.
 *
 * Not on Google Fonts — it is a freeware display face from Dafont by "The
 * Branded Quotes", so it has to be shipped as a file rather than fetched
 * from a font CDN. Used for the cutoff numbers inside the progress bars,
 * where a poster face at 12px is what the bars were asking for.
 *
 * next/font rather than a plain @font-face: it emits a hashed filename, a
 * size-adjusted fallback metric so the numbers do not reflow while it
 * loads, and a preload link. Declared as weight 400 because that is the
 * Regular cut; there is also a Rough, which would need its own file.
 */
const brunson = localFont({
  src: "./fonts/Brunson.ttf",
  variable: "--font-brunson",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "AIMBENCH — Aim Benchmark Tracker",
  description:
    "Profiles, compete on scenarios, track your scores and compare your performance with other players.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${brunson.variable} h-full antialiased`}
    >
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
        {children}
      </body>
    </html>
  );
}
