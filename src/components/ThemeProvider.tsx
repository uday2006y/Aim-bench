"use client";

import { useEffect } from "react";

const DEFAULT_THEME = {
  bg: "#0a0a0a",
  text: "#ffffff",
  accent: "#b9f2fe",
};

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const stored = localStorage.getItem("aimbench-theme");
      let theme = DEFAULT_THEME;
      if (stored) {
        const t = JSON.parse(stored);
        theme = { ...DEFAULT_THEME, ...t };
      }
      document.body.style.backgroundColor = theme.bg;
      document.body.style.color = theme.text;
      document.body.style.transition = "background-color 0.3s ease, color 0.3s ease";
      document.documentElement.style.setProperty("--theme-bg", theme.bg);
      document.documentElement.style.setProperty("--theme-text", theme.text);
      document.documentElement.style.setProperty("--theme-accent", theme.accent);
    } catch {
      document.body.style.backgroundColor = DEFAULT_THEME.bg;
      document.body.style.color = DEFAULT_THEME.text;
    }
  }, []);

  return <>{children}</>;
}
