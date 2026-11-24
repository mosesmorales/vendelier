import {
  Body,
  ConflictException,
  Controller,
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
import { OrderStatus, ThemeScope, withTenant } from "@vendelier/database";
import { publishedAppearance } from "./appearance.js";
import { AuthService } from "./auth.service.js";
import { hasDatabaseError } from "./database-errors.js";
import { DatabaseService } from "./database.service.js";
import { CreateProductDto, FulfillmentDto, UpdateProductDto } from "./dto.js";
import { requireTenantMedia } from "./media-access.js";
import { orderView, productView, tenantView } from "./views.js";

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
      const products = await tx.product.findMany({ where: { tenantId }, orderBy: [{ name: "asc" }, { id: "asc" }] });
      const orders = await tx.order.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { items: { orderBy: { productId: "asc" } } },
      });
      const theme = await publishedAppearance(tx, tenantId, ThemeScope.STUDIO, session.tenant.name);
      return { tenant: session.tenant, products: products.map(productView), orders: orders.map(orderView), theme };
    });
  }

  @Post("products")
  async createProduct(@Headers("cookie") cookie: string | undefined, @Body() input: CreateProductDto) {
    const { tenantId } = await this.auth.requireSession(cookie);
    const product = await withTenant(this.database.connection, tenantId, async (tx) => {
      await requireTenantMedia(tx, tenantId, input.imageId);
      return tx.product.create({ data: { ...input, tenantId } });
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
    const product = await withTenant(this.database.connection, tenantId, async (tx) => {
      await requireTenantMedia(tx, tenantId, input.imageId);
      return tx.product.update({ where: { tenantId_id: { tenantId, id } }, data: input });
    }).catch(rethrowProductError);
    return productView(product);
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

function rethrowProductError(error: unknown): never {
  if (hasDatabaseError(error, "P2025")) {
    throw new NotFoundException("Product not found.");
  }
  if (hasDatabaseError(error, "P2002")) {
    throw new ConflictException("That SKU is already used by this store.");
  }
  throw error;
}
