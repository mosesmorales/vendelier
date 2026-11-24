import { createDatabase, ThemeScope } from "../src/index.js";

const demoTenants = [
  { slug: "urban-kicks", name: "Urban Kicks", accent: "#D6F36A", surface: "#F4F2ED" },
  { slug: "casa-studio", name: "Casa Studio", accent: "#C7A787", surface: "#F3E9DE" },
  { slug: "bloom", name: "Bloom", accent: "#ADC2A4", surface: "#F5F4EA" },
];

const connectionString = process.env.DATABASE_MIGRATION_URL;
if (!connectionString) {
  throw new Error("DATABASE_MIGRATION_URL is required to seed demo tenants.");
}

const database = createDatabase(connectionString);
try {
  await database.$transaction(async (transaction) => {
    await transaction.tenant.createMany({
      data: demoTenants.map(({ slug, name }) => ({ slug, name })),
      skipDuplicates: true,
    });

    const tenants = await transaction.tenant.findMany({
      where: { slug: { in: demoTenants.map(({ slug }) => slug) } },
      select: { id: true, slug: true },
    });
    const tenantIds = new Map(tenants.map(({ id, slug }) => [slug, id]));
    const publishedAt = new Date();

    await transaction.tenantThemeSettings.createMany({
      data: demoTenants.flatMap(({ slug, name, accent, surface }) => {
        const tenantId = tenantIds.get(slug);
        if (!tenantId) {
          throw new Error(`Cannot seed themes for tenant ${slug}.`);
        }

        const theme = {
          name,
          fontFamily: "Urbanist",
          light: { surface, accent, accentForeground: "#141414" },
          dark: { surface: "#242424", accent, accentForeground: "#141414" },
        };

        return [ThemeScope.STUDIO, ThemeScope.STOREFRONT].map((scope) => ({
          tenantId,
          scope,
          draftJson: theme,
          publishedJson: theme,
          version: 1,
          publishedAt,
        }));
      }),
      skipDuplicates: true,
    });
  });
} finally {
  await database.$disconnect();
}
