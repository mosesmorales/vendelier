import { Controller, Get, Header, Headers } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { getPlatformOverview } from "@vendelier/database";
import { DatabaseService } from "./database.service.js";
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
}
