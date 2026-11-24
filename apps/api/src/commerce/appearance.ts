import { BadRequestException } from "@nestjs/common";
import type { Prisma, ThemeScope } from "@vendelier/database";
import { isUUID } from "class-validator";

export const HEX_COLOR = /^#[\da-fA-F]{6}$/;

type Palette = {
  background: string;
  surface: string;
  text: string;
  accent: string;
};

type AppearanceTheme = {
  displayName: string;
  logoId: string | null;
  bannerId: string | null;
  light: Palette;
  dark: Palette;
};

type AppearanceRow = {
  draftJson: Prisma.JsonValue;
  publishedJson: Prisma.JsonValue;
  version: number;
  draftRevision: number;
};

const lightDefaults: Palette = { background: "#F4F2ED", surface: "#FFFFFF", text: "#141414", accent: "#D6F36A" };
const darkDefaults: Palette = { background: "#111111", surface: "#242424", text: "#FFFFFF", accent: "#D6F36A" };

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function mediaId(value: unknown): string | null {
  return typeof value === "string" && isUUID(value) ? value.toLowerCase() : null;
}

function palette(value: unknown, fallback: Palette): Palette {
  const settings = record(value);
  return {
    background: color(settings.background, fallback.background),
    surface: color(settings.surface, fallback.surface),
    text: color(settings.text, fallback.text),
    accent: color(settings.accent, fallback.accent),
  };
}

export function normalizeAppearance(value: unknown, tenantName: string): AppearanceTheme {
  const settings = record(value);
  const name = settings.displayName ?? settings.name;
  return {
    displayName: typeof name === "string" && name.trim() ? name.trim() : tenantName,
    logoId: mediaId(settings.logoId),
    bannerId: mediaId(settings.bannerId),
    light: palette(settings.light, lightDefaults),
    dark: palette(settings.dark, darkDefaults),
  };
}

export function appearanceState(row: AppearanceRow | undefined, tenantName: string) {
  return {
    draft: normalizeAppearance(row?.draftJson, tenantName),
    published: row?.publishedJson == null ? null : normalizeAppearance(row.publishedJson, tenantName),
    version: row?.version ?? 0,
    revision: row?.draftRevision ?? 0,
  };
}

export async function publishedAppearance(
  tx: Prisma.TransactionClient,
  tenantId: string,
  scope: ThemeScope,
  tenantName: string,
) {
  const row = await tx.tenantThemeSettings.findUnique({
    where: { tenantId_scope: { tenantId, scope } },
    select: { publishedJson: true },
  });
  return row?.publishedJson == null ? null : normalizeAppearance(row.publishedJson, tenantName);
}

export function assertReadable(theme: AppearanceTheme) {
  for (const mode of ["light", "dark"] as const) {
    const colors = theme[mode];
    if (contrastRatio(colors.text, colors.background) < 4.5 || contrastRatio(colors.text, colors.surface) < 4.5) {
      throw new BadRequestException(`The ${mode} theme requires a text contrast of at least 4.5:1 on both backgrounds.`);
    }
  }
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function luminance(color: string): number {
  const channel = (offset: number) => {
    const encoded = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
