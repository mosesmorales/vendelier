import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  createDatabase,
  findLoginAccount,
  findOwnerTenant,
  findPublishedTenant,
  getPlatformOverview,
  OrderStatus,
  registerOwner,
  ThemeScope,
  withTenant,
} from "../src/index.js";

test("the application role only sees rows in its transaction's tenant context", async () => {
  const migrationUrl = process.env.DATABASE_MIGRATION_URL;
  const applicationUrl = process.env.DATABASE_URL;
  assert.ok(migrationUrl, "Set DATABASE_MIGRATION_URL before running the database tests.");
  assert.ok(applicationUrl, "Set DATABASE_URL before running the database tests.");

  const migrator = createDatabase(migrationUrl);
  const application = createDatabase(applicationUrl);

  try {
    const [urbanKicks, casaStudio] = await Promise.all([
      migrator.tenant.findUniqueOrThrow({ where: { slug: "urban-kicks" } }),
      migrator.tenant.findUniqueOrThrow({ where: { slug: "casa-studio" } }),
    ]);

    const roles = await application.$queryRaw<{ name: string; bypass: boolean; superuser: boolean }[]>`
      SELECT rolname AS name, rolbypassrls AS bypass, rolsuper AS superuser
      FROM pg_roles
      WHERE rolname = current_user
    `;
    assert.deepEqual(roles, [{ name: "vendelier_app", bypass: false, superuser: false }]);
    assert.deepEqual(await application.tenant.findMany(), []);
    assert.deepEqual(await application.membership.findMany(), []);
    assert.deepEqual(await application.tenantThemeSettings.findMany(), []);
    assert.deepEqual(await application.mediaAsset.findMany(), []);

    const urbanKicksPid = await withTenant(application, urbanKicks.id, async (transaction) => {
      assert.equal(await transaction.tenant.count(), 1);
      assert.equal(await transaction.tenant.findUnique({ where: { id: casaStudio.id } }), null);
      assert.equal(await transaction.tenantThemeSettings.count({ where: { tenantId: urbanKicks.id } }), 2);
      assert.equal(await transaction.tenantThemeSettings.count({ where: { tenantId: casaStudio.id } }), 0);
      const [{ pid }] = await transaction.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      return pid;
    });

    const [{ pid, tenantContext }] = await application.$queryRaw<{ pid: number; tenantContext: string | null }[]>`
      SELECT pg_backend_pid() AS pid, NULLIF(current_setting('vendelier.tenant_id', true), '') AS "tenantContext"
    `;
    assert.equal(pid, urbanKicksPid);
    assert.equal(tenantContext, null);
    assert.deepEqual(await application.tenantThemeSettings.findMany(), []);

    await withTenant(application, casaStudio.id, async (transaction) => {
      assert.equal(await transaction.tenantThemeSettings.count({ where: { tenantId: casaStudio.id } }), 2);
      assert.equal(await transaction.tenantThemeSettings.count({ where: { tenantId: urbanKicks.id } }), 0);
    });
  } finally {
    await Promise.all([application.$disconnect(), migrator.$disconnect()]);
  }
});

test("commerce access preserves tenant ownership, public visibility and references", async () => {
  const migrationUrl = process.env.DATABASE_MIGRATION_URL;
  const applicationUrl = process.env.DATABASE_URL;
  assert.ok(migrationUrl && applicationUrl, "Set both database URLs before running the database tests.");

  const migrator = createDatabase(migrationUrl);
  const application = createDatabase(applicationUrl);
  const fixture = randomUUID();
  const ownerEmail = `owner-${fixture}@example.test`;
  const otherEmail = `other-${fixture}@example.test`;
  const slug = `store-${fixture}`;
  const passwordHash = "test-credential-hash";
  const identities: Awaited<ReturnType<typeof registerOwner>>[] = [];

  try {
    const owner = await registerOwner(application, { email: ownerEmail, passwordHash, name: "Test Store", slug });
    identities.push(owner);
    assert.deepEqual(await findLoginAccount(application, ownerEmail), {
      id: owner.userId,
      email: ownerEmail,
      passwordHash,
    });
    await assert.rejects(application.$queryRaw`SELECT id FROM public.users`, { code: "P2010" });
    await assert.rejects(
      registerOwner(application, { email: otherEmail, passwordHash, name: "Duplicate Slug", slug }),
      { code: "P2002" },
    );
    assert.equal(await findLoginAccount(application, otherEmail), null);

    const other = await registerOwner(application, {
      email: otherEmail,
      passwordHash,
      name: "Another Test Store",
      slug: `other-${fixture}`,
    });
    identities.push(other);
    assert.equal((await findOwnerTenant(application, owner.userId))?.id, owner.tenantId);
    assert.equal(await findPublishedTenant(application, slug), null);

    const publishedAt = new Date();
    const crossTenantPublication = await withTenant(application, other.tenantId, (transaction) =>
      transaction.tenant.updateMany({ where: { id: owner.tenantId }, data: { publishedAt } }),
    );
    assert.equal(crossTenantPublication.count, 0);
    await withTenant(application, owner.tenantId, (transaction) =>
      transaction.tenant.update({ where: { id: owner.tenantId }, data: { publishedAt } }),
    );
    assert.equal((await findPublishedTenant(application, slug))?.id, owner.tenantId);

    const otherImage = await withTenant(application, other.tenantId, (transaction) =>
      transaction.mediaAsset.create({ data: { tenantId: other.tenantId, byteLength: 100 } }),
    );
    const ownerImage = await withTenant(application, owner.tenantId, async (transaction) => {
      assert.equal(await transaction.mediaAsset.findUnique({ where: { id: otherImage.id } }), null);
      return transaction.mediaAsset.create({ data: { tenantId: owner.tenantId, byteLength: 100 } });
    });
    await assert.rejects(withTenant(application, owner.tenantId, (transaction) =>
      transaction.mediaAsset.create({ data: { tenantId: other.tenantId, byteLength: 100 } }),
    ));

    const themeKey = { tenantId: owner.tenantId, scope: ThemeScope.STOREFRONT };
    const themeWhere = { tenantId_scope: themeKey };
    await withTenant(application, owner.tenantId, async (transaction) => {
      const original = { accent: "#141414" };
      const draftJson = { accent: "#D6F36A" };
      await transaction.tenantThemeSettings.create({
        data: { ...themeKey, draftJson: original, publishedJson: original, version: 1, publishedAt, updatedById: owner.userId },
      });
      const draft = await transaction.tenantThemeSettings.update({
        where: themeWhere,
        data: { draftJson, draftRevision: { increment: 1 } },
      });
      assert.deepEqual(draft.draftJson, draftJson);
      assert.deepEqual(draft.publishedJson, original);
      assert.equal(draft.draftRevision, 1);
      assert.equal(draft.version, 1);

      const published = await transaction.tenantThemeSettings.update({
        where: themeWhere,
        data: { publishedJson: draftJson, version: { increment: 1 }, publishedAt },
      });
      assert.deepEqual(published.publishedJson, draftJson);
      assert.equal(published.version, 2);
      assert.equal(await transaction.tenantThemeSettings.count({ where: { scope: ThemeScope.STUDIO } }), 0);
    });
    await withTenant(application, other.tenantId, async (transaction) => {
      assert.equal(await transaction.tenantThemeSettings.findUnique({ where: themeWhere }), null);
      const result = await transaction.tenantThemeSettings.updateMany({ where: themeKey, data: { draftJson: {} } });
      assert.equal(result.count, 0);
    });
    await assert.rejects(withTenant(application, other.tenantId, (transaction) =>
      transaction.tenantThemeSettings.create({ data: { tenantId: owner.tenantId, scope: ThemeScope.STUDIO } }),
    ));
    await assert.rejects(withTenant(application, owner.tenantId, (transaction) =>
      transaction.tenantThemeSettings.update({ where: themeWhere, data: { updatedById: other.userId } }),
    ), { code: "P2003" });

    const otherProduct = await withTenant(application, other.tenantId, (transaction) =>
      transaction.product.create({
        data: { tenantId: other.tenantId, name: "Sample", description: "Fixture", sku: "A", priceCents: 400, stock: 2 },
      }),
    );
    const order = await withTenant(application, owner.tenantId, async (transaction) => {
      const ownProduct = await transaction.product.create({
        data: { tenantId: owner.tenantId, name: "Sample", description: "Fixture", sku: "A", priceCents: 400, stock: 2, imageId: ownerImage.id },
      });
      assert.equal(await transaction.product.findUnique({ where: { id: otherProduct.id } }), null);
      const createdOrder = await transaction.order.create({
        data: {
          tenantId: owner.tenantId,
          number: fixture,
          checkoutKey: fixture,
          customerName: "Test Shopper",
          customerEmail: "shopper@example.test",
          customerAddress: "Test Address",
          totalCents: 400,
        },
      });
      await transaction.orderItem.create({
        data: {
          tenantId: owner.tenantId,
          orderId: createdOrder.id,
          productId: ownProduct.id,
          name: ownProduct.name,
          sku: ownProduct.sku,
          quantity: 1,
          priceCents: ownProduct.priceCents,
        },
      });
      return createdOrder;
    });
    await assert.rejects(withTenant(application, owner.tenantId, (transaction) =>
      transaction.product.update({
        where: { tenantId_sku: { tenantId: owner.tenantId, sku: "A" } },
        data: { imageId: otherImage.id },
      }),
    ), { code: "P2003" });
    await assert.rejects(
      withTenant(application, owner.tenantId, (transaction) => transaction.orderItem.create({
        data: {
          tenantId: owner.tenantId,
          orderId: order.id,
          productId: otherProduct.id,
          name: otherProduct.name,
          sku: otherProduct.sku,
          quantity: 1,
          priceCents: otherProduct.priceCents,
        },
      })),
      { code: "P2003" },
    );

    await withTenant(application, other.tenantId, async (transaction) => {
      assert.equal(await transaction.order.findUnique({ where: { id: order.id } }), null);
      assert.equal(await transaction.orderItem.count(), 0);
    });
    const fulfilled = await withTenant(application, owner.tenantId, (transaction) =>
      transaction.order.update({ where: { id: order.id }, data: { status: OrderStatus.FULFILLED } }),
    );
    assert.equal(fulfilled.status, OrderStatus.FULFILLED);
    const overview = await getPlatformOverview(application);
    assert.ok(overview.tenants.some((tenant) => tenant.slug === slug && tenant.published && tenant.status === "active"));
    assert.ok(overview.orderCount >= 1 && overview.revenueCents >= order.totalCents);
  } finally {
    try {
      const tenantIds = identities.map(({ tenantId }) => tenantId);
      const userIds = identities.map(({ userId }) => userId);
      await migrator.$transaction([
        migrator.orderItem.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        migrator.order.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        migrator.product.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        migrator.mediaAsset.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        migrator.tenantThemeSettings.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        migrator.membership.deleteMany({ where: { tenantId: { in: tenantIds } } }),
        migrator.tenant.deleteMany({ where: { id: { in: tenantIds } } }),
        migrator.user.deleteMany({ where: { id: { in: userIds } } }),
      ]);
    } finally {
      await Promise.all([application.$disconnect(), migrator.$disconnect()]);
    }
  }
});
