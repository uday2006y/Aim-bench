export const THEME_STORAGE_KEY = "aimbench-theme-v2";
export const LEGACY_THEME_KEY = "aimbench-theme";
export const THEME_EVENT = "aimbench-theme-change";

export const RADII = ["sharp", "soft", "round"] as const;
export const DENSITIES = ["compact", "comfortable", "spacious"] as const;
export const SIZES = ["sm", "md", "lg"] as const;
export const FONTS = [
  "geist", "inter", "grotesk", "orbitron", "rajdhani",
  "jetbrains", "playfair", "system", "mono", "serif",
] as const;
export const BACKGROUNDS = ["solid", "glow", "grid", "aurora", "mesh", "dots"] as const;
export const CARDS = ["solid", "glass", "outline"] as const;
export const EDGES = ["soft", "neon", "none"] as const;
export const MOTIONS = ["full", "reduced"] as const;

export type Radius = (typeof RADII)[number];
export type Density = (typeof DENSITIES)[number];
export type Size = (typeof SIZES)[number];
export type FontChoice = (typeof FONTS)[number];
export type BackgroundStyle = (typeof BACKGROUNDS)[number];
export type CardStyle = (typeof CARDS)[number];
export type Edge = (typeof EDGES)[number];
export type Motion = (typeof MOTIONS)[number];
export type Mode = "dark" | "light";

export const FONT_LABELS: Record<FontChoice, string> = {
  geist: "Geist",
  inter: "Inter",
  grotesk: "Space Grotesk",
  orbitron: "Orbitron",
  rajdhani: "Rajdhani",
  jetbrains: "JetBrains Mono",
  playfair: "Playfair",
  system: "System",
  mono: "Mono",
  serif: "Serif",
};

/** Used for the live font previews in the theme studio. */
export const FONT_STACKS: Record<FontChoice, string> = {
  geist: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  inter: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  grotesk: "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif",
  orbitron: "var(--font-orbitron), ui-sans-serif, system-ui, sans-serif",
  rajdhani: "var(--font-rajdhani), ui-sans-serif, system-ui, sans-serif",
  jetbrains: "var(--font-jetbrains), ui-monospace, Menlo, Consolas, monospace",
  playfair: "var(--font-playfair), ui-serif, Georgia, serif",
  system: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "var(--font-geist-mono), ui-monospace, Menlo, Consolas, monospace",
  serif: "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
};

export interface Theme {
  preset: string;
  mode: Mode;
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accent2: string;
  radius: Radius;
  density: Density;
  size: Size;
  font: FontChoice;
  background: BackgroundStyle;
  cards: CardStyle;
  edge: Edge;
  /** Neon glow strength, 0 to 100. */
  glow: number;
  /** Glass blur in px, 0 to 40. */
  glassBlur: number;
  /** How solid glass panels are, 10 to 95 percent. */
  glassOpacity: number;
  /** Optional wallpaper image URL (https only). Empty for none. */
  wallpaper: string;
  /** How much the page colour covers the wallpaper, 0 to 90 percent. */
  wallpaperDim: number;
  motion: Motion;
}

export interface Preset {
  id: string;
  name: string;
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accent2?: string;
  background?: BackgroundStyle;
  cards?: CardStyle;
  edge?: Edge;
  glow?: number;
  glassBlur?: number;
  glassOpacity?: number;
  radius?: Radius;
}

export const PRESETS: Preset[] = [
  { id: "midnight", name: "Midnight", bg: "#08090c", surface: "#101218", text: "#f4f6fa", accent: "#b9f2fe", accent2: "#8b5cf6", background: "glow", glow: 25 },
  { id: "neon-pink", name: "Neon Pink", bg: "#07030d", surface: "#14091d", text: "#fdf2ff", accent: "#ff2bd6", accent2: "#00f0ff", background: "grid", cards: "glass", edge: "neon", glow: 85, glassOpacity: 45 },
  { id: "cyber-lime", name: "Cyber Lime", bg: "#050805", surface: "#0b120a", text: "#f2ffe8", accent: "#b6ff00", accent2: "#00ffa3", background: "grid", cards: "outline", edge: "neon", glow: 70 },
  { id: "synthwave", name: "Synthwave", bg: "#0d0221", surface: "#180638", text: "#f8f0ff", accent: "#ff4d8d", accent2: "#ffb000", background: "mesh", cards: "glass", edge: "neon", glow: 75, glassOpacity: 40 },
  { id: "glass-ice", name: "Glass Ice", bg: "#0a1220", surface: "#18263e", text: "#eef6ff", accent: "#7dd3fc", accent2: "#a5b4fc", background: "mesh", cards: "glass", glassBlur: 28, glassOpacity: 38, radius: "round", glow: 20 },
  { id: "frosted", name: "Frosted Light", bg: "#e6edf7", surface: "#ffffff", text: "#0f172a", accent: "#2563eb", accent2: "#7c3aed", background: "mesh", cards: "glass", glassBlur: 22, glassOpacity: 55, radius: "round", glow: 0 },
  { id: "classic", name: "Classic Gray", bg: "#292929", surface: "#111111", text: "#ffffff", accent: "#b9f2fe", background: "solid", glow: 0 },
  { id: "volt", name: "Volt", bg: "#090a08", surface: "#12140f", text: "#f5f7ee", accent: "#d4ff3a", accent2: "#22d3ee", background: "grid", glow: 40 },
  { id: "violet", name: "Violet", bg: "#0b0913", surface: "#141120", text: "#f3f0ff", accent: "#a78bfa", accent2: "#f472b6", background: "aurora", glow: 35 },
  { id: "ocean", name: "Ocean", bg: "#050d14", surface: "#0c1822", text: "#eaf6ff", accent: "#38bdf8", accent2: "#34d399", background: "glow", glow: 30 },
  { id: "emerald", name: "Emerald", bg: "#06100c", surface: "#0d1c16", text: "#ecfdf5", accent: "#34d399", accent2: "#22d3ee", background: "glow", glow: 30 },
  { id: "crimson", name: "Crimson", bg: "#100707", surface: "#1b0e0e", text: "#fff1f1", accent: "#f87171", accent2: "#fb923c", background: "aurora", glow: 35 },
  { id: "amber", name: "Amber", bg: "#0e0a04", surface: "#1a140a", text: "#fff8eb", accent: "#fbbf24", accent2: "#f87171", background: "glow", glow: 30 },
  { id: "rose", name: "Rose", bg: "#110912", surface: "#1d1120", text: "#fff0f8", accent: "#f472b6", accent2: "#a78bfa", background: "aurora", glow: 35 },
  { id: "oled", name: "OLED", bg: "#000000", surface: "#0a0a0a", text: "#ffffff", accent: "#ffffff", accent2: "#a1a1aa", background: "solid", cards: "outline", glow: 0 },
  { id: "paper", name: "Paper", bg: "#f5f3ee", surface: "#ffffff", text: "#1a1a1c", accent: "#2563eb", accent2: "#7c3aed", background: "solid", glow: 0 },
  { id: "snow", name: "Snow", bg: "#f4f4f6", surface: "#ffffff", text: "#0b0b10", accent: "#7c3aed", accent2: "#2563eb", background: "glow", glow: 0 },
];

export const DEFAULT_PRESET_ID = "midnight";

const HEX = /^#[0-9a-f]{6}$/i;
const WALLPAPER = /^https:\/\/[^\s"'()\\]+$/i;

export function isHex(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

export function isWallpaperUrl(value: unknown): value is string {
  return typeof value === "string" && value.length <= 600 && WALLPAPER.test(value);
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

export function readableOn(hex: string): string {
  return luminance(hex) > 0.38 ? "#0a0a0c" : "#ffffff";
}

export function modeOf(bg: string): Mode {
  return luminance(bg) > 0.4 ? "light" : "dark";
}

export function themeFromPreset(preset: Preset, base?: Partial<Theme>): Theme {
  return {
    preset: preset.id,
    mode: modeOf(preset.bg),
    bg: preset.bg,
    surface: preset.surface,
    text: preset.text,
    accent: preset.accent,
    accent2: preset.accent2 ?? "#8b5cf6",
    radius: preset.radius ?? base?.radius ?? "soft",
    density: base?.density ?? "comfortable",
    size: base?.size ?? "md",
    font: base?.font ?? "geist",
    background: preset.background ?? base?.background ?? "solid",
    cards: preset.cards ?? "solid",
    edge: preset.edge ?? "soft",
    glow: preset.glow ?? 0,
    glassBlur: preset.glassBlur ?? 16,
    glassOpacity: preset.glassOpacity ?? 55,
    wallpaper: base?.wallpaper ?? "",
    wallpaperDim: base?.wallpaperDim ?? 55,
    motion: base?.motion ?? "full",
  };
}

export const DEFAULT_THEME: Theme = themeFromPreset(
  PRESETS.find((p) => p.id === DEFAULT_PRESET_ID) ?? PRESETS[0]
);

function pick<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function num(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

/** Turns anything from storage or an import box into a safe Theme. */
export function normalizeTheme(raw: unknown): Theme {
  const d = DEFAULT_THEME;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bg = isHex(r.bg) ? r.bg.toLowerCase() : d.bg;

  return {
    preset: typeof r.preset === "string" ? r.preset.slice(0, 32) : "custom",
    mode: modeOf(bg),
    bg,
    surface: isHex(r.surface) ? r.surface.toLowerCase() : d.surface,
    text: isHex(r.text) ? r.text.toLowerCase() : d.text,
    accent: isHex(r.accent) ? r.accent.toLowerCase() : d.accent,
    accent2: isHex(r.accent2) ? r.accent2.toLowerCase() : d.accent2,
    radius: pick(RADII, r.radius, d.radius),
    density: pick(DENSITIES, r.density, d.density),
    size: pick(SIZES, r.size, d.size),
    font: pick(FONTS, r.font, d.font),
    background: pick(BACKGROUNDS, r.background, d.background),
    cards: pick(CARDS, r.cards, d.cards),
    edge: pick(EDGES, r.edge, d.edge),
    glow: num(r.glow, 0, 100, d.glow),
    glassBlur: num(r.glassBlur, 0, 40, d.glassBlur),
    glassOpacity: num(r.glassOpacity, 10, 95, d.glassOpacity),
    wallpaper: isWallpaperUrl(r.wallpaper) ? r.wallpaper : "",
    wallpaperDim: num(r.wallpaperDim, 0, 90, d.wallpaperDim),
    motion: pick(MOTIONS, r.motion, d.motion),
  };
}

/** Reads the stored theme. Falls back to the old 3-colour format, then the default. */
export function parseStoredTheme(raw: string | null, legacy: string | null): Theme {
  if (raw) {
    try {
      return normalizeTheme(JSON.parse(raw));
    } catch {
      /* fall through */
    }
  }

  if (legacy) {
    try {
      const old = JSON.parse(legacy) as Record<string, unknown>;
      return normalizeTheme({
        preset: "custom",
        bg: old.bg,
        text: old.text,
        accent: old.accent,
        surface: undefined,
      });
    } catch {
      /* default */
    }
  }

  return { ...DEFAULT_THEME };
}

/** Writes a theme onto <html>. Safe to call repeatedly; nothing needs a reload. */
export function applyTheme(theme: Theme, el: HTMLElement) {
  const s = el.style;
  s.setProperty("--bg", theme.bg);
  s.setProperty("--surface", theme.surface);
  s.setProperty("--text", theme.text);
  s.setProperty("--accent", theme.accent);
  s.setProperty("--accent-2", theme.accent2);
  s.setProperty("--accent-fg", readableOn(theme.accent));
  s.setProperty("--glow", String(theme.glow / 100));
  s.setProperty("--glass-blur", `${theme.glassBlur}px`);
  s.setProperty("--glass-alpha", `${theme.glassOpacity}%`);
  s.setProperty("--wallpaper-dim", `${theme.wallpaperDim}%`);

  if (theme.wallpaper) {
    s.setProperty("--wallpaper", `url("${theme.wallpaper}")`);
  } else {
    s.removeProperty("--wallpaper");
  }

  el.dataset.mode = theme.mode;
  el.dataset.radius = theme.radius;
  el.dataset.density = theme.density;
  el.dataset.size = theme.size;
  el.dataset.font = theme.font;
  el.dataset.bg = theme.background;
  el.dataset.cards = theme.cards;
  el.dataset.edge = theme.edge;
  el.dataset.motion = theme.motion;
  el.dataset.wallpaper = theme.wallpaper ? "on" : "off";
}

/** Runs in <head> before first paint so a saved theme never flashes the default. */
export const THEME_BOOT_SCRIPT = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(!s)return;
var t=JSON.parse(s),e=document.documentElement,x=e.style,h=/^#[0-9a-f]{6}$/i;
function lum(c){var n=parseInt(c.slice(1),16);function f(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}return 0.2126*f((n>>16)&255)+0.7152*f((n>>8)&255)+0.0722*f(n&255)}
function n(v,a,b){return typeof v==="number"&&isFinite(v)?Math.min(b,Math.max(a,Math.round(v))):null}
if(h.test(t.bg)){x.setProperty("--bg",t.bg);e.dataset.mode=lum(t.bg)>0.4?"light":"dark"}
if(h.test(t.surface))x.setProperty("--surface",t.surface);
if(h.test(t.text))x.setProperty("--text",t.text);
if(h.test(t.accent)){x.setProperty("--accent",t.accent);x.setProperty("--accent-fg",lum(t.accent)>0.38?"#0a0a0c":"#ffffff")}
if(h.test(t.accent2))x.setProperty("--accent-2",t.accent2);
var g=n(t.glow,0,100);if(g!==null)x.setProperty("--glow",String(g/100));
var b=n(t.glassBlur,0,40);if(b!==null)x.setProperty("--glass-blur",b+"px");
var o=n(t.glassOpacity,10,95);if(o!==null)x.setProperty("--glass-alpha",o+"%");
var d=n(t.wallpaperDim,0,90);if(d!==null)x.setProperty("--wallpaper-dim",d+"%");
if(typeof t.wallpaper==="string"&&t.wallpaper.length<=600&&/^https:\\/\\/[^\\s"'()\\\\]+$/i.test(t.wallpaper)){x.setProperty("--wallpaper",'url("'+t.wallpaper+'")');e.dataset.wallpaper="on"}
var A={radius:["sharp","soft","round"],density:["compact","comfortable","spacious"],size:["sm","md","lg"],font:${JSON.stringify([...FONTS])},background:${JSON.stringify([...BACKGROUNDS])},cards:["solid","glass","outline"],edge:["soft","neon","none"],motion:["full","reduced"]};
for(var k in A){if(A[k].indexOf(t[k])>-1)e.dataset[k==="background"?"bg":k]=t[k]}
}catch(_){}})();`;

export function exportTheme(theme: Theme): string {
  return JSON.stringify({ aimbenchTheme: 3, ...theme }, null, 2);
}

/** Parses an exported theme. Returns null when the text is not a theme. */
export function importTheme(text: string): Theme | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const r = parsed as Record<string, unknown>;
    if (!["bg", "surface", "text", "accent"].some((k) => isHex(r[k]))) return null;
    return normalizeTheme(r);
  } catch {
    return null;
  }
}
