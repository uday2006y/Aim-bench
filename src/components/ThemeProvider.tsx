"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_THEME,
  LEGACY_THEME_KEY,
  PRESETS,
  THEME_EVENT,
  THEME_STORAGE_KEY,
  applyTheme,
  normalizeTheme,
  parseStoredTheme,
  themeFromPreset,
  type Theme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  update: (changes: Partial<Theme>) => void;
  applyPreset: (id: string) => void;
  replace: (next: Theme) => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const COLOUR_KEYS: (keyof Theme)[] = ["bg", "surface", "text", "accent"];

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

function getSnapshot(): string {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) return raw;
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    return legacy ? `legacy:${legacy}` : "";
  } catch {
    return "";
  }
}

function decode(snapshot: string): Theme {
  if (snapshot.startsWith("legacy:")) {
    return parseStoredTheme(null, snapshot.slice("legacy:".length));
  }
  return parseStoredTheme(snapshot || null, null);
}

function save(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    applyTheme(theme, document.documentElement);
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const theme = useMemo(() => decode(snapshot), [snapshot]);

  useEffect(() => {
    applyTheme(theme, document.documentElement);
  }, [theme]);

  const update = useCallback(
    (changes: Partial<Theme>) => {
      const touchesColour = COLOUR_KEYS.some((key) => key in changes);
      save(
        normalizeTheme({
          ...theme,
          ...changes,
          preset: changes.preset ?? (touchesColour ? "custom" : theme.preset),
        })
      );
    },
    [theme]
  );

  const applyPreset = useCallback(
    (id: string) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (preset) save(themeFromPreset(preset, theme));
    },
    [theme]
  );

  const replace = useCallback((next: Theme) => save(normalizeTheme(next)), []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
      localStorage.removeItem(LEGACY_THEME_KEY);
    } catch {
      /* nothing to clear */
    }
    applyTheme(DEFAULT_THEME, document.documentElement);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const value = useMemo(
    () => ({ theme, update, applyPreset, replace, reset }),
    [theme, update, applyPreset, replace, reset]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}