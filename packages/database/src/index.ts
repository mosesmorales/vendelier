import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/client.js";

export function createDatabase(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Runs queries for a tenant whose identity has already been verified by the server. */
export function withTenant<T>(
  database: PrismaClient,
  tenantId: string,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  return database.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`
        SELECT set_config('vendelier.tenant_id', ${tenantId}::uuid::text, true)
      `;
      return operation(transaction);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export type TenantTransaction = Prisma.TransactionClient;

export {
  findLoginAccount,
  findOwnerTenant,
  findPublishedTenant,
  getPlatformAuditLogs,
  getPlatformOverview,
  registerOwner,
  setPlatformTenantStatus,
  type PlatformAuditEntry,
  type PlatformTenant,
} from "./platform-access.js";
export { MembershipRole, OrderStatus, TenantStatus, ThemeScope } from "./generated/enums.js";
export type { Prisma, PrismaClient };
