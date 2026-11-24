import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Liquid } from "liquidjs";

type Palette = Record<"background" | "surface" | "text" | "accent", string>;

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
}

const themeRoot = new URL("../../../themes/atelier/", import.meta.url);
const stylesheet = readFileSync(new URL("assets/theme.css", themeRoot), "utf8").replaceAll("\r\n", "\n");
const engine = new Liquid({
  templates: {
    "theme.liquid": readFileSync(new URL("layout/theme.liquid", themeRoot), "utf8"),
    "product-card.liquid": readFileSync(new URL("snippets/product-card.liquid", themeRoot), "utf8"),
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

export async function renderAtelier(input: AtelierInput) {
  const styles = `:root{${cssPalette(input.light)}}@media(prefers-color-scheme:dark){:root{${cssPalette(input.dark)}}}\n${stylesheet}`;
  const styleHash = createHash("sha256").update(styles).digest("base64");
  const html = await engine.renderFile("theme.liquid", {
    stylesheet: styles,
    preview: input.preview,
    shop: {
      name: input.name,
      logo_url: input.logoUrl && localUrl(input.logoUrl),
      banner_url: input.bannerUrl && localUrl(input.bannerUrl),
      catalog_url: localUrl(input.catalogUrl),
    },
    products: input.products.slice(0, 24).map((product) => ({
      name: product.name,
      description: product.description,
      price_cents: product.priceCents,
      available: product.available,
      image_url: product.imageUrl && localUrl(product.imageUrl),
    })),
  });
  return { html, styleHash };
}
