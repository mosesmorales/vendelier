import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { OrderStatus, ThemeScope, type TenantTransaction, withTenant } from "@vendelier/database";
import { publishedAppearance } from "./appearance.js";
import { AuthService } from "./auth.service.js";
import { hasDatabaseError } from "./database-errors.js";
import { DatabaseService } from "./database.service.js";
import {
  CreateProductDto,
  FulfillmentDto,
  type ProductOptionInputDto,
  type ProductVariantInputDto,
  UpdateProductDto,
} from "./dto.js";
import { requireTenantMedia } from "./media-access.js";
import { orderView, productInclude, productView, tenantView } from "./views.js";

@ApiTags("Studio")
@ApiCookieAuth()
@Controller("studio")
export class StudioController {
  constructor(private readonly auth: AuthService, private readonly database: DatabaseService) {}

  @Get("overview")
  @Header("Cache-Control", "no-store")
  async overview(@Headers("cookie") cookie: string | undefined) {
    const { tenantId, session } = await this.auth.requireSession(cookie);
    return withTenant(this.database.connection, tenantId, async (tx) => {
      const products = await tx.product.findMany({
        where: { tenantId },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        include: productInclude,
      });
      const orders = await tx.order.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { items: { orderBy: { productId: "asc" } } },
      });
      const theme = await publishedAppearance(tx, tenantId, ThemeScope.STUDIO, session.tenant.name);
      return { tenant: session.tenant, products: products.map(productView), orders: orders.map(orderView), theme };
    });
  }

  @Get("orders")
  @Header("Cache-Control", "no-store")
  async listOrders(@Headers("cookie") cookie: string | undefined) {
    const { tenantId } = await this.auth.requireSession(cookie);
    return withTenant(this.database.connection, tenantId, async (tx) => {
      const orders = await tx.order.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { items: { orderBy: { productId: "asc" } } },
      });
      return orders.map(orderView);
    });
  }

  @Post("products")
  async createProduct(@Headers("cookie") cookie: string | undefined, @Body() input: CreateProductDto) {
    const { tenantId } = await this.auth.requireSession(cookie);
    const { options, variants, ...baseInput } = input;
    const totalStock = variants && variants.length > 0
      ? variants.reduce((sum, v) => sum + v.stock, 0)
      : baseInput.stock;

    const product = await withTenant(this.database.connection, tenantId, async (tx) => {
      await requireTenantMedia(tx, tenantId, baseInput.imageId);
      const created = await tx.product.create({
        data: { ...baseInput, stock: totalStock, tenantId },
      });
      await syncProductOptionsAndVariants(tx, tenantId, created.id, options, variants);
      return tx.product.findUniqueOrThrow({
        where: { tenantId_id: { tenantId, id: created.id } },
        include: productInclude,
      });
    }).catch(rethrowProductError);
    return productView(product);
  }

  @Patch("products/:id")
  async updateProduct(
    @Headers("cookie") cookie: string | undefined,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateProductDto,
  ) {
    const { tenantId } = await this.auth.requireSession(cookie);
    const { options, variants, ...baseInput } = input;
    const data = variants && variants.length > 0
      ? { ...baseInput, stock: variants.reduce((sum, v) => sum + v.stock, 0) }
      : baseInput;

    const product = await withTenant(this.database.connection, tenantId, async (tx) => {
      await requireTenantMedia(tx, tenantId, baseInput.imageId);
      await tx.product.update({ where: { tenantId_id: { tenantId, id } }, data });
      if (options !== undefined || variants !== undefined) {
        await syncProductOptionsAndVariants(tx, tenantId, id, options, variants);
      }
      return tx.product.findUniqueOrThrow({
        where: { tenantId_id: { tenantId, id } },
        include: productInclude,
      });
    }).catch(rethrowProductError);
    return productView(product);
  }

  @Delete("products/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProduct(
    @Headers("cookie") cookie: string | undefined,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const { tenantId } = await this.auth.requireSession(cookie);
    await withTenant(this.database.connection, tenantId, async (tx) => {
      await tx.product.delete({ where: { tenantId_id: { tenantId, id } } });
    }).catch((error: unknown) => {
      if (hasDatabaseError(error, "P2025")) {
        throw new NotFoundException("Product not found.");
      }
      if (hasDatabaseError(error, "P2003")) {
        throw new ConflictException("Cannot delete a product that already has orders.");
      }
      throw error;
    });
  }

  @Post("publish")
  @HttpCode(HttpStatus.OK)
  async publish(@Headers("cookie") cookie: string | undefined) {
    const { tenantId } = await this.auth.requireSession(cookie);
    const tenant = await withTenant(this.database.connection, tenantId, async (tx) => {
      await tx.tenant.updateMany({
        where: { id: tenantId, publishedAt: null },
        data: { publishedAt: new Date() },
      });
      return tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    });
    return tenantView(tenant);
  }

  @Patch("orders/:id/fulfillment")
  async fulfillOrder(
    @Headers("cookie") cookie: string | undefined,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: FulfillmentDto,
  ) {
    const { tenantId } = await this.auth.requireSession(cookie);
    const status = { fulfilled: OrderStatus.FULFILLED }[input.status];
    const order = await withTenant(this.database.connection, tenantId, (tx) =>
      tx.order.update({
        where: { tenantId_id: { tenantId, id } },
        data: { status },
        include: { items: { orderBy: { productId: "asc" } } },
      }),
    ).catch((error: unknown) => {
      if (hasDatabaseError(error, "P2025")) {
        throw new NotFoundException("Order not found.");
      }
      throw error;
    });
    return orderView(order);
  }
}

async function syncProductOptionsAndVariants(
  tx: TenantTransaction,
  tenantId: string,
  productId: string,
  options: ProductOptionInputDto[] | undefined,
  variants: ProductVariantInputDto[] | undefined,
) {
  if (options !== undefined) {
    await tx.productOption.deleteMany({ where: { tenantId, productId } });
    for (const [optIndex, opt] of options.entries()) {
      const createdOption = await tx.productOption.create({
        data: { tenantId, productId, name: opt.name, position: optIndex },
        select: { id: true },
      });
      await tx.productOptionValue.createMany({
        data: opt.values.map((value, valIndex) => ({
          tenantId,
          optionId: createdOption.id,
          value,
          position: valIndex,
        })),
      });
    }
  }

  if (variants !== undefined) {
    const existingVariants = await tx.productVariant.findMany({
      where: { tenantId, productId },
      select: { id: true },
    });
    const keepIds = new Set(variants.map((v) => v.id).filter((id): id is string => Boolean(id)));
    const toDelete = existingVariants.filter((v) => !keepIds.has(v.id)).map((v) => v.id);
    if (toDelete.length > 0) {
      await tx.productVariant.deleteMany({ where: { tenantId, productId, id: { in: toDelete } } });
    }

    for (const variant of variants) {
      if (variant.id && existingVariants.some((e) => e.id === variant.id)) {
        await tx.productVariant.update({
          where: { tenantId_id: { tenantId, id: variant.id } },
          data: {
            title: variant.title,
            sku: variant.sku,
            priceCents: variant.priceCents,
            stock: variant.stock,
            selectedOptions: variant.selectedOptions,
          },
        });
      } else {
        await tx.productVariant.create({
          data: {
            tenantId,
            productId,
            title: variant.title,
            sku: variant.sku,
            priceCents: variant.priceCents,
            stock: variant.stock,
            selectedOptions: variant.selectedOptions,
          },
        });
      }
    }
  }
}

function rethrowProductError(error: unknown): never {
  if (hasDatabaseError(error, "P2025")) {
    throw new NotFoundException("Product not found.");
  }
  if (hasDatabaseError(error, "P2002")) {
    throw new ConflictException("That SKU or variant is already used by this store.");
  }
  if (hasDatabaseError(error, "P2003")) {
    throw new ConflictException("Cannot remove a variant that already has orders.");
  }
  throw error;
}
