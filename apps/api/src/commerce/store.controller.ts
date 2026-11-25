import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
import { ApiProduces, ApiTags } from "@nestjs/swagger";
import { ThemeScope, findPublishedTenant, withTenant } from "@vendelier/database";
import { MediaStorageService } from "../media/media-storage.service.js";
import { normalizeAppearance, publishedAppearance } from "./appearance.js";
import { atelierInput, respondWithAtelier } from "./atelier-response.js";
import { hasDatabaseError } from "./database-errors.js";
import { DatabaseService } from "./database.service.js";
import { CheckoutDto, MAX_DATABASE_INT, isTenantSlug } from "./dto.js";
import { webpFile } from "./media-access.js";
import { orderView, productInclude, productView, tenantView } from "./views.js";

@ApiTags("Storefront")
@Controller("store")
export class StoreController {
  constructor(private readonly database: DatabaseService, private readonly storage: MediaStorageService) {}

  @Get(":slug")
  @Header("Cache-Control", "no-store")
  async catalog(@Param("slug") slug: string) {
    const tenant = await this.requirePublishedTenant(slug);
    return withTenant(this.database.connection, tenant.id, async (tx) => {
      const products = await tx.product.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        include: productInclude,
      });
      const theme = await publishedAppearance(tx, tenant.id, ThemeScope.STOREFRONT, tenant.name);
      return { tenant: tenantView(tenant), products: products.map(productView), theme };
    });
  }

  @Get(":slug/atelier")
  @ApiProduces("text/html")
  async atelier(@Param("slug") slug: string, @Res({ passthrough: true }) response: ServerResponse) {
    const tenant = await this.requirePublishedTenant(slug);
    const input = await withTenant(this.database.connection, tenant.id, async (tx) => {
      const theme = await publishedAppearance(tx, tenant.id, ThemeScope.STOREFRONT, tenant.name);
      return atelierInput(tx, tenant, theme ?? normalizeAppearance(null, tenant.name), false);
    });
    return respondWithAtelier(response, input);
  }

  @Get(":slug/media/:id")
  @ApiProduces("image/webp")
  @Header("Cache-Control", "no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async image(@Param("slug") slug: string, @Param("id", ParseUUIDPipe) id: string) {
    const { id: tenantId, name } = await this.requirePublishedTenant(slug);
    const imageId = id.toLowerCase();
    const referenced = await withTenant(this.database.connection, tenantId, async (tx) => {
      const product = await tx.product.findFirst({ where: { tenantId, imageId }, select: { id: true } });
      if (product) {
        return true;
      }
      const theme = await publishedAppearance(tx, tenantId, ThemeScope.STOREFRONT, name);
      return theme?.logoId === imageId || theme?.bannerId === imageId;
    });
    if (!referenced) {
      throw new NotFoundException("Image not found.");
    }
    return webpFile(await this.storage.readImage(tenantId, imageId));
  }

  @Post(":slug/checkout")
  async checkout(@Param("slug") slug: string, @Body() input: CheckoutDto) {
    const { id: tenantId } = await this.requirePublishedTenant(slug);
    if (input.payment === "declined") {
      throw new HttpException("The simulated payment was declined.", HttpStatus.PAYMENT_REQUIRED);
    }

    const itemKey = (productId: string, variantId?: string | null) => `${productId}:${variantId ?? ""}`;
    // Lock products/variants in deterministic order across concurrent checkouts.
    const requestedItems = [...input.items].sort((a, b) =>
      itemKey(a.productId, a.variantId).localeCompare(itemKey(b.productId, b.variantId)),
    );
    const requestedQuantities = new Map(
      requestedItems.map(({ productId, variantId, quantity }) => [itemKey(productId, variantId), quantity]),
    );
    if (requestedQuantities.size !== requestedItems.length) {
      throw new BadRequestException("Each product variant may appear only once in a checkout.");
    }

    return withTenant(this.database.connection, tenantId, async (tx) => {
      const lockKey = `vendelier-checkout:${tenantId}:${input.checkoutKey}`;
      await tx.$queryRaw`
        SELECT 1 AS locked FROM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${lockKey}, 0))
      `;

      const existing = await tx.order.findUnique({
        where: { tenantId_checkoutKey: { tenantId, checkoutKey: input.checkoutKey } },
        include: { items: { orderBy: [{ productId: "asc" }, { id: "asc" }] } },
      });
      const customer = input.customer;
      if (existing) {
        if (
          existing.customerName !== customer.name ||
          existing.customerEmail !== customer.email ||
          existing.customerAddress !== customer.address ||
          existing.items.length !== requestedItems.length ||
          existing.items.some(
            ({ productId, variantId, quantity }) => requestedQuantities.get(itemKey(productId, variantId)) !== quantity,
          )
        ) {
          throw new ConflictException("That checkout key was already used for a different order.");
        }
        return orderView(existing);
      }

      const items: Array<{
        productId: string;
        variantId: string | null;
        name: string;
        variantTitle: string | null;
        sku: string;
        quantity: number;
        priceCents: number;
      }> = [];

      for (const { productId, variantId, quantity } of requestedItems) {
        if (variantId) {
          const variant = await tx.productVariant.update({
            where: { tenantId_id: { tenantId, id: variantId }, productId, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
            include: { product: { select: { name: true } } },
          }).catch((error: unknown) => {
            if (hasDatabaseError(error, "P2025")) {
              throw new ConflictException("A product variant is unavailable in the requested quantity.");
            }
            throw error;
          });
          await tx.product.update({
            where: { tenantId_id: { tenantId, id: productId }, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
          }).catch((error: unknown) => {
            if (hasDatabaseError(error, "P2025")) {
              throw new ConflictException("A product is unavailable in the requested quantity.");
            }
            throw error;
          });
          items.push({
            productId,
            variantId,
            name: variant.product.name,
            variantTitle: variant.title,
            sku: variant.sku,
            quantity,
            priceCents: variant.priceCents,
          });
        } else {
          const product = await tx.product.update({
            where: { tenantId_id: { tenantId, id: productId }, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
          }).catch((error: unknown) => {
            if (hasDatabaseError(error, "P2025")) {
              throw new ConflictException("A product is unavailable in the requested quantity.");
            }
            throw error;
          });
          items.push({
            productId,
            variantId: null,
            name: product.name,
            variantTitle: null,
            sku: product.sku,
            quantity,
            priceCents: product.priceCents,
          });
        }
      }

      const totalCents = items.reduce((sum, { priceCents, quantity }) => sum + priceCents * quantity, 0);
      if (totalCents > MAX_DATABASE_INT) {
        throw new BadRequestException("The order total exceeds the supported amount.");
      }

      const order = await tx.order.create({
        data: {
          tenantId,
          number: `VD-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
          checkoutKey: input.checkoutKey,
          customerName: customer.name,
          customerEmail: customer.email,
          customerAddress: customer.address,
          totalCents,
        },
      });
      await tx.orderItem.createMany({ data: items.map((item) => ({ ...item, tenantId, orderId: order.id })) });
      return orderView({ ...order, items });
    });
  }

  private async requirePublishedTenant(slug: string) {
    const tenant = isTenantSlug(slug) ? await findPublishedTenant(this.database.connection, slug) : null;
    if (!tenant) {
      throw new NotFoundException("Store not found.");
    }
    return tenant;
  }
}
