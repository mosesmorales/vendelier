import { NotFoundException, StreamableFile } from "@nestjs/common";
import type { Prisma } from "@vendelier/database";

export async function requireTenantMedia(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ...ids: Array<string | null | undefined>
) {
  const requested = [...new Set(ids.filter((id): id is string => id != null))];
  if (requested.length === 0) {
    return;
  }

  const count = await tx.mediaAsset.count({ where: { tenantId, id: { in: requested } } });
  if (count !== requested.length) {
    throw new NotFoundException("Image not found.");
  }
}

export function webpFile(bytes: Buffer) {
  return new StreamableFile(bytes, { type: "image/webp", length: bytes.byteLength });
}
