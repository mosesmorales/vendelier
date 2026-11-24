import type { CSSProperties } from "react";

interface Palette {
  background: string;
  surface: string;
  text: string;
  accent: string;
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

export function textContrast(palette: Palette) {
  return Math.min(contrast(palette.text, palette.background), contrast(palette.text, palette.surface));
}

function accentText(accent: string) {
  return contrast(accent, "#000000") >= contrast(accent, "#FFFFFF") ? "#000000" : "#FFFFFF";
}

function statusColor(palette: Palette, ...candidates: string[]) {
  return candidates.find((text) => textContrast({ ...palette, text }) >= 4.5) ?? palette.text;
}

export function appearanceStyle({ light, dark }: { light: Palette; dark: Palette }): CSSProperties {
  const byMode = (lightColor: string, darkColor: string) => `light-dark(${lightColor}, ${darkColor})`;
  return {
    "--vd-theme-background": byMode(light.background, dark.background),
    "--vd-theme-surface": byMode(light.surface, dark.surface),
    "--vd-theme-text": byMode(light.text, dark.text),
    "--vd-theme-accent": byMode(light.accent, dark.accent),
    "--vd-theme-on-accent": byMode(accentText(light.accent), accentText(dark.accent)),
    "--vd-theme-danger": byMode(
      statusColor(light, "#9E2525", "#FF9B9B"),
      statusColor(dark, "#FF9B9B", "#9E2525"),
    ),
    "--vd-theme-success": byMode(
      statusColor(light, "#28623D", "#A0DDB2"),
      statusColor(dark, "#A0DDB2", "#28623D"),
    ),
  } as CSSProperties;
}
