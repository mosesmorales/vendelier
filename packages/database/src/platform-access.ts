import { Prisma, type PrismaClient } from "./generated/client.js";

type LoginAccount = {
  id: string;
  email: string;
  passwordHash: string;
};

type OwnerRegistration = {
  email: string;
  passwordHash: string;
  name: string;
  slug: string;
};

type RegisteredOwner = {
  userId: string;
  tenantId: string;
};

type TenantIdentity = {
  id: string;
  slug: string;
  name: string;
  publishedAt: Date | null;
};

export type PlatformTenant = {
  slug: string;
  name: string;
  published: boolean;
  status: "active" | "suspended";
};

export type PlatformAuditEntry = {
  id: string;
  actor: string;
  action: string;
  targetSlug: string;
  details: Record<string, unknown>;
  createdAt: Date;
};

export async function findLoginAccount(database: PrismaClient, email: string) {
  const [account] = await database.$queryRaw<LoginAccount[]>`
    SELECT id, email, password_hash AS "passwordHash"
    FROM public.vendelier_find_login_account(${email}::text)
  `;
  return account ?? null;
}

export async function registerOwner(database: PrismaClient, input: OwnerRegistration) {
  try {
    const [owner] = await database.$queryRaw<RegisteredOwner[]>`
      SELECT user_id AS "userId", tenant_id AS "tenantId"
      FROM public.vendelier_register_owner(
        ${input.email}::text, ${input.passwordHash}::text, ${input.name}::text, ${input.slug}::text
      )
    `;
    return owner;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2010") {
      const adapterError = error.meta?.driverAdapterError as { cause?: { kind?: string } } | undefined;
      if (adapterError?.cause?.kind === "UniqueConstraintViolation") {
        throw new Prisma.PrismaClientKnownRequestError("The account email or store slug is already registered.", {
          code: "P2002",
          clientVersion: error.clientVersion,
        });
      }
    }
    throw error;
  }
}

/** Pass the id from a verified session. */
export async function findOwnerTenant(database: PrismaClient, userId: string) {
  const [tenant] = await database.$queryRaw<TenantIdentity[]>`
    SELECT id, slug, name, published_at AS "publishedAt"
    FROM public.vendelier_find_owner_tenant(${userId}::uuid)
  `;
  return tenant ?? null;
}

export async function findPublishedTenant(database: PrismaClient, slug: string) {
  const [tenant] = await database.$queryRaw<TenantIdentity[]>`
    SELECT id, slug, name, published_at AS "publishedAt"
    FROM public.vendelier_find_published_tenant(${slug}::text)
  `;
  return tenant ?? null;
}

/** Requires platform authorization at the API boundary. */
export async function getPlatformOverview(database: PrismaClient) {
  const [overview] = await database.$queryRaw<{
    tenants: PlatformTenant[];
    orderCount: bigint;
    revenueCents: bigint;
  }[]>`
    SELECT tenants, order_count AS "orderCount", revenue_cents AS "revenueCents"
    FROM public.vendelier_platform_overview()
  `;
  const auditLogs = await getPlatformAuditLogs(database);
  return {
    tenants: overview.tenants,
    orderCount: Number(overview.orderCount),
    revenueCents: Number(overview.revenueCents),
    auditLogs,
  };
}

/** Requires platform authorization at the API boundary. */
export async function setPlatformTenantStatus(
  database: PrismaClient,
  input: { slug: string; status: "active" | "suspended"; actor: string; reason?: string },
) {
  const [tenant] = await database.$queryRaw<PlatformTenant[]>`
    SELECT slug, name, published, status::text AS status
    FROM public.vendelier_platform_set_tenant_status(
      ${input.slug}::text,
      ${input.status}::public.tenant_status,
      ${input.actor}::text,
      ${input.reason ?? null}::text
    )
  `;
  return tenant ?? null;
}

/** Requires platform authorization at the API boundary. */
export async function getPlatformAuditLogs(database: PrismaClient, limit = 50) {
  return database.$queryRaw<PlatformAuditEntry[]>`
    SELECT id, actor, action, target_slug AS "targetSlug", details, created_at AS "createdAt"
    FROM public.vendelier_platform_audit_logs(${limit}::integer)
  `;
}
