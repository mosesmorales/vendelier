import {
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiCookieAuth, ApiParam, ApiProperty, ApiTags } from "@nestjs/swagger";
import { ThemeScope, withTenant } from "@vendelier/database";
import { Type } from "class-transformer";
import { IsDefined, IsInt, IsNotEmpty, IsObject, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from "class-validator";
import { HEX_COLOR, appearanceState, assertReadable, normalizeAppearance } from "./appearance.js";
import { AuthService } from "./auth.service.js";
import { hasDatabaseError } from "./database-errors.js";
import { DatabaseService } from "./database.service.js";
import { MAX_DATABASE_INT, NormalizeUuid } from "./dto.js";
import { requireTenantMedia } from "./media-access.js";

const scopeNames = { studio: "studio", storefront: "storefront" } as const;
type ScopeName = keyof typeof scopeNames;
const databaseScopes = { studio: ThemeScope.STUDIO, storefront: ThemeScope.STOREFRONT };

class PaletteDto {
  @ApiProperty({ pattern: HEX_COLOR.source })
  @Matches(HEX_COLOR)
  background!: string;

  @ApiProperty({ pattern: HEX_COLOR.source })
  @Matches(HEX_COLOR)
  surface!: string;

  @ApiProperty({ pattern: HEX_COLOR.source })
  @Matches(HEX_COLOR)
  text!: string;

  @ApiProperty({ pattern: HEX_COLOR.source })
  @Matches(HEX_COLOR)
  accent!: string;
}

class AppearanceDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  @NormalizeUuid()
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsUUID()
  logoId!: string | null;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  @NormalizeUuid()
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsUUID()
  bannerId!: string | null;

  @ApiProperty({ type: PaletteDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PaletteDto)
  light!: PaletteDto;

  @ApiProperty({ type: PaletteDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PaletteDto)
  dark!: PaletteDto;
}

class AppearanceRevisionDto {
  @ApiProperty({ minimum: 0, maximum: MAX_DATABASE_INT - 1 })
  @IsInt()
  @Min(0)
  @Max(MAX_DATABASE_INT - 1)
  revision!: number;
}

class SaveAppearanceDto extends AppearanceRevisionDto {
  @ApiProperty({ type: AppearanceDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => AppearanceDto)
  draft!: AppearanceDto;
}

@ApiTags("Studio appearance")
@ApiCookieAuth()
@Controller("studio/appearance")
export class AppearanceController {
  constructor(private readonly auth: AuthService, private readonly database: DatabaseService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async list(@Headers("cookie") cookie: string | undefined) {
    const { tenantId, session } = await this.auth.requireSession(cookie);
    const rows = await withTenant(this.database.connection, tenantId, (tx) =>
      tx.tenantThemeSettings.findMany({ where: { tenantId } }),
    );
    return {
      studio: appearanceState(rows.find((row) => row.scope === ThemeScope.STUDIO), session.tenant.name),
      storefront: appearanceState(rows.find((row) => row.scope === ThemeScope.STOREFRONT), session.tenant.name),
    };
  }

  @Patch(":scope")
  @ApiParam({ name: "scope", enum: scopeNames })
  save(
    @Headers("cookie") cookie: string | undefined,
    @Param("scope", new ParseEnumPipe(scopeNames)) scope: ScopeName,
    @Body() input: SaveAppearanceDto,
  ) {
    return this.revise(cookie, scope, input.revision, input.draft);
  }

  @Post(":scope/publish")
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: "scope", enum: scopeNames })
  publish(
    @Headers("cookie") cookie: string | undefined,
    @Param("scope", new ParseEnumPipe(scopeNames)) scope: ScopeName,
    @Body() input: AppearanceRevisionDto,
  ) {
    return this.revise(cookie, scope, input.revision);
  }

  private async revise(cookie: string | undefined, scopeName: ScopeName, revision: number, draft?: AppearanceDto) {
    const { tenantId, userId, session } = await this.auth.requireSession(cookie);
    const tenantName = session.tenant.name;
    const scope = databaseScopes[scopeName];
    const where = { tenantId_scope: { tenantId, scope } };
    const row = await withTenant(this.database.connection, tenantId, async (tx) => {
      const current = await tx.tenantThemeSettings.findUnique({ where });
      if ((current?.draftRevision ?? 0) !== revision) {
        throw revisionConflict();
      }

      const theme = normalizeAppearance(draft ?? current?.draftJson, tenantName);
      await requireTenantMedia(tx, tenantId, theme.logoId, theme.bannerId);
      const publishing = draft === undefined;
      if (publishing) {
        assertReadable(theme);
      }
      const publication = publishing
        ? { publishedJson: theme, publishedAt: new Date(), version: (current?.version ?? 0) + 1 }
        : {};
      const data = { draftJson: theme, draftRevision: revision + 1, updatedById: userId, ...publication };

      if (!current) {
        return tx.tenantThemeSettings.create({ data: { tenantId, scope, ...data } });
      }
      return tx.tenantThemeSettings.update({ where: { ...where, draftRevision: revision }, data });
    }).catch((error: unknown) => {
      if (hasDatabaseError(error, "P2002") || hasDatabaseError(error, "P2025")) {
        throw revisionConflict();
      }
      throw error;
    });
    return appearanceState(row, tenantName);
  }
}

function revisionConflict() {
  return new ConflictException("The theme has changed. Reload the draft before saving or publishing.");
}
