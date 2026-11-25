import { randomUUID } from "node:crypto";
import { Body, Controller, Get, Header, Headers, Logger, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiCookieAuth, ApiProduces, ApiProperty, ApiTags } from "@nestjs/swagger";
import { withTenant } from "@vendelier/database";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { MediaStorageService } from "../media/media-storage.service.js";
import { AuthService } from "./auth.service.js";
import { DatabaseService } from "./database.service.js";
import { requireTenantMedia, webpFile } from "./media-access.js";

class ImportImageDto {
  @ApiProperty({ format: "uri", maxLength: 2048 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url!: string;
}

@ApiTags("Studio media")
@ApiCookieAuth()
@Controller("studio/media")
export class StudioMediaController {
  private readonly logger = new Logger(StudioMediaController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly database: DatabaseService,
    private readonly storage: MediaStorageService,
  ) {}

  @Post()
  async importImage(@Headers("cookie") cookie: string | undefined, @Body() input: ImportImageDto) {
    const { tenantId } = await this.auth.requireSession(cookie, ["owner", "admin", "catalog"]);
    const id = randomUUID();
    const byteLength = await this.storage.importImage(tenantId, id, input.url);
    try {
      await withTenant(this.database.connection, tenantId, (tx) =>
        tx.mediaAsset.create({ data: { id, tenantId, byteLength } }),
      );
    } catch (error) {
      await this.storage.removeImage(tenantId, id).catch(() => {
        this.logger.warn("An imported image could not be removed after a database error.");
      });
      throw error;
    }
    return { id };
  }

  @Get(":id")
  @ApiProduces("image/webp")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async image(@Headers("cookie") cookie: string | undefined, @Param("id", ParseUUIDPipe) id: string) {
    const { tenantId } = await this.auth.requireSession(cookie);
    const imageId = id.toLowerCase();
    await withTenant(this.database.connection, tenantId, (tx) => requireTenantMedia(tx, tenantId, imageId));
    return webpFile(await this.storage.readImage(tenantId, imageId));
  }
}
