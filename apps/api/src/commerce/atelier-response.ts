import type { ServerResponse } from "node:http";
import type { Prisma } from "@vendelier/database";
import { renderAtelier, type AtelierInput } from "@vendelier/theme-engine";
import type { normalizeAppearance } from "./appearance.js";

export async function atelierInput(
  tx: Prisma.TransactionClient,
  tenant: { id: string; slug: string },
  theme: ReturnType<typeof normalizeAppearance>,
  preview: boolean,
): Promise<AtelierInput> {
  const products = await tx.product.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { name: true, description: true, priceCents: true, stock: true, imageId: true },
    take: 24,
  });
  const slug = encodeURIComponent(tenant.slug);
  const mediaBase = preview ? "/api/studio/media" : `/api/store/${slug}/media`;
  const imageUrl = (id: string | null) => id ? `${mediaBase}/${encodeURIComponent(id)}` : null;
  return {
    name: theme.displayName,
    logoUrl: imageUrl(theme.logoId),
    bannerUrl: imageUrl(theme.bannerId),
    catalogUrl: `/tiendas/${slug}`,
    light: theme.light,
    dark: theme.dark,
    preview,
    products: products.map((product) => ({
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      available: product.stock > 0,
      imageUrl: imageUrl(product.imageId),
    })),
  };
}

export async function respondWithAtelier(response: ServerResponse, input: AtelierInput) {
  const { html, styleHash } = await renderAtelier(input);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", input.preview ? "private, no-store" : "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "img-src 'self'",
    `style-src 'sha256-${styleHash}'`,
    input.preview ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    ...(input.preview ? ["sandbox"] : []),
  ].join("; "));
  return html;
}
