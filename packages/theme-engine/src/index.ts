import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Liquid } from "liquidjs";

type Palette = Record<"background" | "surface" | "text" | "accent", string>;

interface TemplateSectionConfig {
  type: string;
  settings: Record<string, string | number | boolean>;
}

interface TemplateDefinition {
  layout: string;
  sections: Record<string, TemplateSectionConfig>;
  order: string[];
}

export interface SectionSchemaField {
  id: string;
  type: string;
  label: string;
  default?: string | number | boolean;
  min?: number;
  max?: number;
}

export interface SectionSchema {
  name: string;
  settings: SectionSchemaField[];
}

export interface AtelierInput {
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  catalogUrl: string;
  light: Palette;
  dark: Palette;
  products: ReadonlyArray<{
    name: string;
    description: string;
    priceCents: number;
    available: boolean;
    imageUrl: string | null;
  }>;
  preview: boolean;
  sections?: Record<string, Record<string, string | number | boolean>>;
  order?: string[];
}

const themeRoot = new URL("../../../themes/atelier/", import.meta.url);
const stylesheet = readFileSync(new URL("assets/theme.css", themeRoot), "utf8").replaceAll("\r\n", "\n");
const indexTemplate = JSON.parse(readFileSync(new URL("templates/index.json", themeRoot), "utf8")) as TemplateDefinition;

const sectionSchemas: Record<string, SectionSchema> = {
  hero: JSON.parse(readFileSync(new URL("sections/hero.schema.json", themeRoot), "utf8")) as SectionSchema,
  "featured-products": JSON.parse(
    readFileSync(new URL("sections/featured-products.schema.json", themeRoot), "utf8"),
  ) as SectionSchema,
};

const engine = new Liquid({
  templates: {
    "theme.liquid": readFileSync(new URL("layout/theme.liquid", themeRoot), "utf8"),
    "product-card.liquid": readFileSync(new URL("snippets/product-card.liquid", themeRoot), "utf8"),
    "section-hero.liquid": readFileSync(new URL("sections/hero.liquid", themeRoot), "utf8"),
    "section-featured-products.liquid": readFileSync(new URL("sections/featured-products.liquid", themeRoot), "utf8"),
  },
  cache: true,
  dynamicPartials: false,
  ownPropertyOnly: true,
  outputEscape: "escape",
  strictFilters: true,
  strictVariables: true,
  parseLimit: 100_000,
  renderLimit: 250,
  memoryLimit: 1_000_000,
});

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", currencyDisplay: "code" });
engine.registerFilter("money", (cents: number) => currency.format(cents / 100));
engine.registerFilter("safe_url", (value: string) => safeUrl(value));
engine.registerFilter("image_url", (value: string) => localUrl(value));

function cssPalette(palette: Palette) {
  const { background, surface, text, accent } = palette;
  if (![background, surface, text, accent].every((color) => /^#[\da-f]{6}$/i.test(color))) {
    throw new Error("Invalid Atelier colors.");
  }
  return `--background:${background};--surface:${surface};--text:${text};--accent:${accent}`;
}

function localUrl(path: string): string {
  if (!/^\/[a-z0-9/-]+$/i.test(path) || path.startsWith("//")) {
    throw new Error("Invalid Atelier link.");
  }
  return path;
}

function safeUrl(value: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return localUrl(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") return parsed.toString();
  } catch {
    // fall through
  }
  throw new Error("Invalid Atelier URL.");
}

export function getAtelierSchema() {
  return {
    template: indexTemplate,
    sections: sectionSchemas,
  };
}

export async function renderAtelier(input: AtelierInput) {
  const styles = `:root{${cssPalette(input.light)}}@media(prefers-color-scheme:dark){:root{${cssPalette(input.dark)}}}\n${stylesheet}`;
  const styleHash = createHash("sha256").update(styles).digest("base64");

  const shop = {
    name: input.name,
    logo_url: input.logoUrl && localUrl(input.logoUrl),
    banner_url: input.bannerUrl && localUrl(input.bannerUrl),
    catalog_url: localUrl(input.catalogUrl),
  };

  const products = input.products.slice(0, 24).map((product) => ({
    name: product.name,
    description: product.description,
    price_cents: product.priceCents,
    available: product.available,
    image_url: product.imageUrl && localUrl(product.imageUrl),
  }));

  const sectionOrder = (input.order ?? indexTemplate.order).filter((id) => id in indexTemplate.sections);
  const renderedSections: string[] = [];

  for (const sectionId of sectionOrder) {
    const baseSection = indexTemplate.sections[sectionId];
    if (!baseSection) continue;
    const templateKey = `section-${baseSection.type}.liquid`;
    const mergedSettings = {
      ...baseSection.settings,
      ...(input.sections?.[sectionId] ?? {}),
    };
    const sectionHtml = await engine.renderFile(templateKey, {
      preview: input.preview,
      shop,
      products,
      section: {
        id: sectionId,
        type: baseSection.type,
        settings: mergedSettings,
      },
    });
    renderedSections.push(sectionHtml);
  }

  const html = await engine.renderFile("theme.liquid", {
    stylesheet: styles,
    preview: input.preview,
    shop,
    products,
    content_for_layout: renderedSections.join("\n"),
  });
  return { html, styleHash };
}
