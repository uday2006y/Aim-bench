import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
            {/* Curved left edge sweeping up to a point at the top right. */}
            <clipPath id="aim-bar-ribbon" clipPathUnits="objectBoundingBox">
              <path d="M 0.02 1 C 0 0.74, 0.05 0.3, 0.22 0 L 1 0 L 0.83 1 Z" />
            </clipPath>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
