import { Body, Controller, Get, Header, Headers, NotFoundException, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { getPlatformOverview, setPlatformTenantStatus } from "@vendelier/database";
import { DatabaseService } from "./database.service.js";
import { isTenantSlug, UpdateTenantStatusDto } from "./dto.js";
import { requireDemoAdmin } from "./security.js";

@ApiTags("Platform")
@ApiBearerAuth()
@Controller("platform")
export class PlatformController {
  constructor(private readonly database: DatabaseService) {}

  @Get("overview")
  @Header("Cache-Control", "no-store")
  overview(@Headers("authorization") authorization: string | undefined) {
    requireDemoAdmin(authorization);
    return getPlatformOverview(this.database.connection);
  }

  @Patch("tenants/:slug/status")
  async updateTenantStatus(
    @Headers("authorization") authorization: string | undefined,
    @Param("slug") slug: string,
    @Body() input: UpdateTenantStatusDto,
  ) {
    requireDemoAdmin(authorization);
    if (!isTenantSlug(slug)) {
      throw new NotFoundException("Tenant not found.");
    }
    const tenant = await setPlatformTenantStatus(this.database.connection, {
      slug,
      status: input.status,
      actor: "demo-admin",
      reason: input.reason,
    });
    if (!tenant) {
      throw new NotFoundException("Tenant not found.");
    }
    return tenant;
  }
}
