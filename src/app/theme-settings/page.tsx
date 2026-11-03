"use client";

import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { useTheme } from "@/components/ThemeProvider";
import {
  BACKGROUNDS,
  CARDS,
  DENSITIES,
  EDGES,
  FONTS,
  FONT_LABELS,
  FONT_STACKS,
  MOTIONS,
  PRESETS,
  RADII,
  SIZES,
  exportTheme,
  importTheme,
  isHex,
  isWallpaperUrl,
  type Theme,
} from "@/lib/theme";

const COLOURS: { key: "bg" | "surface" | "text" | "accent" | "accent2"; label: string }[] = [
  { key: "accent", label: "Accent" },
  { key: "accent2", label: "Accent 2" },
  { key: "bg", label: "Background" },
  { key: "surface", label: "Panels" },
  { key: "text", label: "Text" },
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  names,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  names?: Partial<Record<T, string>>;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition ${
              value === option
                ? "border-accent bg-accent/15 text-accent"
                : "border-white/15 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {names?.[option] ?? option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-zinc-400">
        {label}
        <span className="font-mono normal-case tracking-normal text-zinc-300">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
        style={{ accentColor: "var(--accent)" }}
      />
    </label>
  );
}

function ColourField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} colour`}
          className="h-10 w-12 cursor-pointer rounded-lg border border-white/15 bg-transparent p-1"
        />
        <input
          value={shown}
          maxLength={7}
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (isHex(next)) onChange(next.toLowerCase());
          }}
          onBlur={() => setDraft(null)}
          className="field font-mono text-sm"
        />
      </div>
    </div>
  );
}

export default function ThemeStudioPage() {
  const { theme, update, applyPreset, replace, reset } = useTheme();
  const set = <K extends keyof Theme>(key: K, value: Theme[K]) => update({ [key]: value } as Partial<Theme>);

  const [wallDraft, setWallDraft] = useState<string | null>(null);
  const wall = wallDraft ?? theme.wallpaper;
  const wallValid = wall === "" || isWallpaperUrl(wall);

  const [io, setIo] = useState("");
  const [ioMessage, setIoMessage] = useState("");

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <p className="eyebrow">Theme studio</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Make it yours</h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">
          Every change applies instantly to the whole site and is saved on this device.
        </p>

        <div className="mt-8 grid gap-6">
          <Section title="Presets" hint="A starting point. Everything below can still be changed.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  aria-pressed={theme.preset === preset.id}
                  className={`rounded-xl border p-3 text-left transition ${
                    theme.preset === preset.id
                      ? "border-accent"
                      : "border-white/15 hover:border-white/30"
                  }`}
                  style={{ background: preset.bg }}
                >
                  <span className="flex gap-1.5">
                    {[preset.surface, preset.accent, preset.accent2 ?? preset.accent].map((c, i) => (
                      <span
                        key={i}
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                  <span className="mt-2 block text-sm font-medium" style={{ color: preset.text }}>
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Colours" hint="Pick any colour. Light backgrounds switch the whole site to light mode.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COLOURS.map(({ key, label }) => (
                <ColourField key={key} label={label} value={theme[key]} onChange={(v) => set(key, v)} />
              ))}
            </div>
          </Section>

          <Section title="Glass & neon" hint="Frosted panels, glowing edges, or flat and quiet.">
            <Segmented label="Panels" value={theme.cards} options={CARDS} onChange={(v) => set("cards", v)} names={{ solid: "Solid", glass: "Glass", outline: "Outline" }} />
            <Segmented label="Edges" value={theme.edge} options={EDGES} onChange={(v) => set("edge", v)} names={{ soft: "Soft", neon: "Neon", none: "None" }} />
            <div className="grid gap-5 sm:grid-cols-3">
              <Slider label="Neon glow" value={theme.glow} min={0} max={100} unit="%" onChange={(v) => set("glow", v)} />
              <Slider label="Glass blur" value={theme.glassBlur} min={0} max={40} unit="px" onChange={(v) => set("glassBlur", v)} />
              <Slider label="Glass opacity" value={theme.glassOpacity} min={10} max={95} unit="%" onChange={(v) => set("glassOpacity", v)} />
            </div>
          </Section>

          <Section title="Background" hint="A pattern, or your own wallpaper image.">
            <Segmented label="Pattern" value={theme.background} options={BACKGROUNDS} onChange={(v) => set("background", v)} />
            <div className="grid gap-5 sm:grid-cols-[1fr_16rem]">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">Wallpaper image URL</p>
                <input
                  value={wall}
                  placeholder="https://…/wallpaper.jpg"
                  spellCheck={false}
                  onChange={(event) => {
                    const next = event.target.value.trim();
                    setWallDraft(next);
                    if (next === "" || isWallpaperUrl(next)) set("wallpaper", next);
                  }}
                  onBlur={() => setWallDraft(null)}
                  className="field text-sm"
                />
                <p className={`mt-1.5 text-xs ${wallValid ? "text-zinc-500" : "text-red-400"}`}>
                  {wallValid ? "Direct image links only (https). Leave empty for none." : "That is not a valid https image link."}
                </p>
              </div>
              <Slider label="Wallpaper dimming" value={theme.wallpaperDim} min={0} max={90} unit="%" onChange={(v) => set("wallpaperDim", v)} />
            </div>
          </Section>

          <Section title="Typography" hint="The signed-in name in the sidebar always stays bold and ignores this.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {FONTS.map((font) => (
                <button
                  key={font}
                  type="button"
                  aria-pressed={theme.font === font}
                  onClick={() => set("font", font)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    theme.font === font ? "border-accent bg-accent/10" : "border-white/15 hover:border-white/30"
                  }`}
                >
                  <span className="block text-xl leading-none" style={{ fontFamily: FONT_STACKS[font] }}>
                    Aa
                  </span>
                  <span className="mt-2 block text-xs text-zinc-300" style={{ fontFamily: FONT_STACKS[font] }}>
                    {FONT_LABELS[font]}
                  </span>
                </button>
              ))}
            </div>
            <Segmented label="Text size" value={theme.size} options={SIZES} onChange={(v) => set("size", v)} names={{ sm: "Small", md: "Medium", lg: "Large" }} />
          </Section>

          <Section title="Shape & motion">
            <Segmented label="Corners" value={theme.radius} options={RADII} onChange={(v) => set("radius", v)} />
            <Segmented label="Spacing" value={theme.density} options={DENSITIES} onChange={(v) => set("density", v)} />
            <Segmented label="Animations" value={theme.motion} options={MOTIONS} onChange={(v) => set("motion", v)} names={{ full: "On", reduced: "Reduced" }} />
          </Section>

          <Section title="Preview" hint="A few of the things your theme styles.">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary">Primary</button>
              <button type="button" className="btn btn-ghost">Ghost</button>
              <span className="chip chip-accent">Accent chip</span>
              <span className="chip">Plain chip</span>
              <span className="eyebrow">Eyebrow</span>
              <span className="text-gradient text-xl font-bold">Gradient text</span>
              <input className="field max-w-[12rem]" placeholder="Input field" readOnly />
            </div>
          </Section>

          <Section title="Share or reset" hint="Copy your theme to send it to a friend, or paste one in.">
            <textarea
              value={io}
              onChange={(event) => setIo(event.target.value)}
              placeholder="Theme JSON appears here, or paste one to import"
              rows={5}
              spellCheck={false}
              className="field font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => { setIo(exportTheme(theme)); setIoMessage("Exported below. Copy it."); }}>
                Export
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  const next = importTheme(io);
                  if (next) {
                    replace(next);
                    setIoMessage("Theme imported.");
                  } else {
                    setIoMessage("That does not look like a theme.");
                  }
                }}
              >
                Import
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  reset();
                  setIo("");
                  setIoMessage("Back to the default theme.");
                }}
              >
                Reset to default
              </button>
              {ioMessage && <span className="text-xs text-zinc-400">{ioMessage}</span>}
            </div>
          </Section>
        </div>
      </main>
    </>
  );
}
