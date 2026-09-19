"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DEFAULT_THEME = {
  bg: "#0a0a0a",
  text: "#ffffff",
  accent: "#b9f2fe",
};

export default function ThemeSettingsPage() {
  const [theme, setTheme] = useState({ ...DEFAULT_THEME });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("aimbench-theme");
      if (stored) {
        const parsed = JSON.parse(stored);
        setTheme({ ...DEFAULT_THEME, ...parsed });
      } else {
        setTheme({ ...DEFAULT_THEME });
      }
    } catch {
      setTheme({ ...DEFAULT_THEME });
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("aimbench-theme", JSON.stringify(theme));
    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.text;
  }, [theme, loaded]);

  const handleChange = (key: "bg" | "text" | "accent", value: string) => {
    setTheme((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <main className="min-h-screen text-white" style={{ backgroundColor: theme.bg, color: theme.text }}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Hero / Info */}
          <section>
            <Link href="/" className="inline-flex items-center gap-2 text-xs font-medium tracking-wide uppercase text-zinc-500 hover:text-white transition mb-8">
              ← Back
            </Link>
            <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
              Theme Settings
            </h1>
            <p className="mt-6 text-lg text-zinc-400 leading-relaxed">
              Customize colors. Changes apply instantly across the entire benchmark tracker.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <span className="inline-block rounded-full border border-white/10 px-4 py-1.5 text-sm text-zinc-300 bg-white/[0.02]">
                Background
              </span>
              <span className="inline-block rounded-full border border-white/10 px-4 py-1.5 text-sm text-zinc-300 bg-white/[0.02]">
                Text
              </span>
              <span className="inline-block rounded-full border border-white/10 px-4 py-1.5 text-sm text-zinc-300 bg-white/[0.02]">
                Accent
              </span>
            </div>
          </section>

          {/* Color Cards */}
          <section className="space-y-4">
            {[
              { key: "bg" as const, label: "Background", hex: theme.bg, desc: "Main page background color used globally." },
              { key: "text" as const, label: "Text", hex: theme.text, desc: "Primary text and heading color." },
              { key: "accent" as const, label: "Accent", hex: theme.accent, desc: "Highlight links and interactive elements." },
            ].map((item) => (
              <div
                key={item.key}
                className="rounded-3xl border border-white/10 p-6 transition hover:border-white/20"
                style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
              >
                <div className="flex items-center justify-between gap-6">
                  <div>
                    <h3 className="text-base font-semibold">{item.label}</h3>
                    <p className="text-sm text-zinc-500 mt-1">{item.desc}</p>
                    <p className="text-xs font-mono text-zinc-600 mt-2">{item.hex}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <input
                      type="color"
                      value={theme[item.key]}
                      onChange={(e) => handleChange(item.key, e.target.value)}
                      className="h-12 w-12 rounded-xl border border-white/10 bg-zinc-950 p-1 cursor-pointer shadow-lg"
                      aria-label={`${item.label} color`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
