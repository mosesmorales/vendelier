import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { createDatabase, MembershipRole, OrderStatus, ThemeScope } from "../src/index.js";

const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function hashDemoPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, SCRYPT_OPTIONS, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(`scrypt-v1:${salt.toString("hex")}:${key.toString("hex")}`);
    });
  });
}

const demoTenants = [
  {
    slug: "urban-kicks",
    name: "Urban Kicks",
    ownerEmail: "owner@urbankicks.mx",
    accent: "#4A6B11",
    surface: "#F4F2ED",
    products: [
      {
        name: "Tenis Volta Runner",
        description: "Silueta urbana ligera con suela de doble densidad para uso diario.",
        sku: "UK-VOLTA-01",
        priceCents: 249900,
        stock: 22,
        options: [{ name: "Talla", values: ["25 MX", "26 MX", "27 MX", "28 MX"] }],
        variants: [
          { title: "25 MX", sku: "UK-VOLTA-25", priceCents: 249900, stock: 5, selectedOptions: { Talla: "25 MX" } },
          { title: "26 MX", sku: "UK-VOLTA-26", priceCents: 249900, stock: 8, selectedOptions: { Talla: "26 MX" } },
          { title: "27 MX", sku: "UK-VOLTA-27", priceCents: 249900, stock: 6, selectedOptions: { Talla: "27 MX" } },
          { title: "28 MX", sku: "UK-VOLTA-28", priceCents: 249900, stock: 3, selectedOptions: { Talla: "28 MX" } },
        ],
      },
      {
        name: "Gorra Street Twill",
        description: "Algodón cepillado con visera curva y ajuste posterior metálico.",
        sku: "UK-CAP-02",
        priceCents: 54900,
        stock: 18,
        options: [{ name: "Color", values: ["Negro", "Oliva"] }],
        variants: [
          { title: "Negro", sku: "UK-CAP-BLK", priceCents: 54900, stock: 12, selectedOptions: { Color: "Negro" } },
          { title: "Oliva", sku: "UK-CAP-OLV", priceCents: 54900, stock: 6, selectedOptions: { Color: "Oliva" } },
        ],
      },
    ],
  },
  {
    slug: "casa-studio",
    name: "Casa Studio",
    ownerEmail: "owner@casastudio.mx",
    accent: "#7A4E2D",
    surface: "#F3E9DE",
    products: [
      {
        name: "Lámpara Mesa Arcilla",
        description: "Base torneada a mano con pantalla de lino natural y luz cálida.",
        sku: "CS-LAMP-01",
        priceCents: 329000,
        stock: 11,
        options: [{ name: "Acabado", values: ["Arena", "Terracota"] }],
        variants: [
          { title: "Arena", sku: "CS-LAMP-ARN", priceCents: 329000, stock: 7, selectedOptions: { Acabado: "Arena" } },
          { title: "Terracota", sku: "CS-LAMP-TER", priceCents: 349000, stock: 4, selectedOptions: { Acabado: "Terracota" } },
        ],
      },
      {
        name: "Set 2 Tazas Gres",
        description: "Cerámica de alta temperatura apta para lavavajillas.",
        sku: "CS-MUG-02",
        priceCents: 68000,
        stock: 20,
        options: [{ name: "Esmalte", values: ["Hueso", "Obsidiana"] }],
        variants: [
          { title: "Hueso", sku: "CS-MUG-HUE", priceCents: 68000, stock: 12, selectedOptions: { Esmalte: "Hueso" } },
          { title: "Obsidiana", sku: "CS-MUG-OBS", priceCents: 68000, stock: 8, selectedOptions: { Esmalte: "Obsidiana" } },
        ],
      },
    ],
  },
  {
    slug: "bloom",
    name: "Bloom",
    ownerEmail: "owner@bloom.mx",
    accent: "#2F5D3A",
    surface: "#F5F4EA",
    products: [
      {
        name: "Ramo Temporada Silvestre",
        description: "Selección fresca de flores de temporada envueltas en papel kraft.",
        sku: "BL-RAMO-01",
        priceCents: 89000,
        stock: 15,
        options: [{ name: "Tamaño", values: ["Chico", "Mediano", "Grande"] }],
        variants: [
          { title: "Chico", sku: "BL-RAMO-S", priceCents: 69000, stock: 6, selectedOptions: { Tamaño: "Chico" } },
          { title: "Mediano", sku: "BL-RAMO-M", priceCents: 89000, stock: 6, selectedOptions: { Tamaño: "Mediano" } },
          { title: "Grande", sku: "BL-RAMO-L", priceCents: 119000, stock: 3, selectedOptions: { Tamaño: "Grande" } },
        ],
      },
      {
        name: "Maceta Cerámica Mate",
        description: "Incluye plato drenante y sustrato preparado.",
        sku: "BL-POT-02",
        priceCents: 45000,
        stock: 14,
        options: [{ name: "Diámetro", values: ["14 cm", "20 cm"] }],
        variants: [
          { title: "14 cm", sku: "BL-POT-14", priceCents: 45000, stock: 9, selectedOptions: { Diámetro: "14 cm" } },
          { title: "20 cm", sku: "BL-POT-20", priceCents: 62000, stock: 5, selectedOptions: { Diámetro: "20 cm" } },
        ],
      },
    ],
  },
];

const connectionString = process.env.DATABASE_MIGRATION_URL;
if (!connectionString) {
  throw new Error("DATABASE_MIGRATION_URL is required to seed demo tenants.");
}

const demoPasswordHash = await hashDemoPassword("VendelierDemo2026!");
const database = createDatabase(connectionString);

try {
  await database.$transaction(async (transaction) => {
    const publishedAt = new Date();

    for (const demo of demoTenants) {
      const tenant = await transaction.tenant.upsert({
        where: { slug: demo.slug },
        update: { publishedAt },
        create: { slug: demo.slug, name: demo.name, publishedAt },
        select: { id: true, slug: true, name: true },
      });

      const user = await transaction.user.upsert({
        where: { email: demo.ownerEmail },
        update: {},
        create: { email: demo.ownerEmail, passwordHash: demoPasswordHash },
        select: { id: true },
      });

      await transaction.membership.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
        update: {},
        create: { tenantId: tenant.id, userId: user.id, role: MembershipRole.OWNER },
      });

      const theme = {
        displayName: demo.name,
        logoId: null,
        bannerId: null,
        light: { background: "#FAF9F6", surface: demo.surface, text: "#141414", accent: demo.accent },
        dark: { background: "#141414", surface: "#242424", text: "#FAF9F6", accent: demo.accent },
      };

      for (const scope of [ThemeScope.STUDIO, ThemeScope.STOREFRONT]) {
        await transaction.tenantThemeSettings.upsert({
          where: { tenantId_scope: { tenantId: tenant.id, scope } },
          update: { draftJson: theme, publishedJson: theme, version: 1, publishedAt },
          create: {
            tenantId: tenant.id,
            scope,
            draftJson: theme,
            publishedJson: theme,
            version: 1,
            publishedAt,
          },
        });
      }

      const existingProducts = await transaction.product.count({ where: { tenantId: tenant.id } });
      if (existingProducts === 0) {
        const createdProducts: { id: string; name: string; sku: string; priceCents: number; variantId: string | null; variantTitle: string | null }[] = [];

        for (const productInput of demo.products) {
          const product = await transaction.product.create({
            data: {
              tenantId: tenant.id,
              name: productInput.name,
              description: productInput.description,
              sku: productInput.sku,
              priceCents: productInput.priceCents,
              stock: productInput.stock,
            },
            select: { id: true, name: true, sku: true, priceCents: true },
          });

          for (const [optIndex, opt] of productInput.options.entries()) {
            const option = await transaction.productOption.create({
              data: {
                tenantId: tenant.id,
                productId: product.id,
                name: opt.name,
                position: optIndex,
              },
              select: { id: true },
            });

            await transaction.productOptionValue.createMany({
              data: opt.values.map((value, valIndex) => ({
                tenantId: tenant.id,
                optionId: option.id,
                value,
                position: valIndex,
              })),
            });
          }

          let firstVariant: { id: string; title: string; sku: string; priceCents: number } | null = null;
          for (const variantInput of productInput.variants) {
            const variant = await transaction.productVariant.create({
              data: {
                tenantId: tenant.id,
                productId: product.id,
                title: variantInput.title,
                sku: variantInput.sku,
                priceCents: variantInput.priceCents,
                stock: variantInput.stock,
                selectedOptions: variantInput.selectedOptions,
              },
              select: { id: true, title: true, sku: true, priceCents: true },
            });
            if (!firstVariant) firstVariant = variant;
          }

          createdProducts.push({
            id: product.id,
            name: product.name,
            sku: firstVariant?.sku ?? product.sku,
            priceCents: firstVariant?.priceCents ?? product.priceCents,
            variantId: firstVariant?.id ?? null,
            variantTitle: firstVariant?.title ?? null,
          });
        }

        const primary = createdProducts[0];
        if (primary) {
          const orderSpecs = [
            { number: `VD-${demo.slug.slice(0, 3).toUpperCase()}-1001`, status: OrderStatus.FULFILLED, customerName: "Sofía Ramírez", customerEmail: "sofia@ejemplo.mx", customerAddress: "Av. Reforma 220, CDMX" },
            { number: `VD-${demo.slug.slice(0, 3).toUpperCase()}-1002`, status: OrderStatus.PENDING, customerName: "Diego Morales", customerEmail: "diego@ejemplo.mx", customerAddress: "Calle Morelos 45, Guadalajara" },
          ];
          for (const spec of orderSpecs) {
            const order = await transaction.order.create({
              data: {
                tenantId: tenant.id,
                number: spec.number,
                checkoutKey: randomUUID(),
                customerName: spec.customerName,
                customerEmail: spec.customerEmail,
                customerAddress: spec.customerAddress,
                totalCents: primary.priceCents,
                status: spec.status,
              },
              select: { id: true },
            });
            await transaction.orderItem.create({
              data: {
                tenantId: tenant.id,
                orderId: order.id,
                productId: primary.id,
                variantId: primary.variantId,
                name: primary.name,
                variantTitle: primary.variantTitle,
                sku: primary.sku,
                quantity: 1,
                priceCents: primary.priceCents,
              },
            });
          }
        }
      }
    }
  });
} finally {
  await database.$disconnect();
}
