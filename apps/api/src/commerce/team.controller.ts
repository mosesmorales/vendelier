import { randomBytes } from "node:crypto";
import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
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
import { ApiCookieAuth, ApiProperty, ApiTags } from "@nestjs/swagger";
import { inviteTenantMember, listTenantMembers, removeTenantMember, updateTenantMemberRole } from "@vendelier/database";
import { Transform } from "class-transformer";
import { IsEmail, IsIn, MaxLength } from "class-validator";
import { AuthService } from "./auth.service.js";
import { hasDatabaseError } from "./database-errors.js";
import { DatabaseService } from "./database.service.js";
import { hashPassword } from "./security.js";

const ASSIGNABLE_ROLES = ["admin", "catalog", "orders", "analyst"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

class InviteMemberDto {
  @ApiProperty({ format: "email" })
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role!: AssignableRole;
}

class UpdateMemberRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role!: AssignableRole;
}

@ApiTags("Studio team")
@ApiCookieAuth()
@Controller("studio/team")
export class TeamController {
  constructor(private readonly auth: AuthService, private readonly database: DatabaseService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async list(@Headers("cookie") cookie: string | undefined) {
    const { tenantId } = await this.auth.requireSession(cookie, ["owner", "admin"]);
    return listTenantMembers(this.database.connection, tenantId);
  }

  @Post("invite")
  async invite(@Headers("cookie") cookie: string | undefined, @Body() input: InviteMemberDto) {
    const { tenantId, role } = await this.auth.requireSession(cookie, ["owner", "admin"]);
    if (input.role === "admin" && role !== "owner") {
      throw new ForbiddenException("Only the store owner can assign the admin role.");
    }
    const defaultHash = await hashPassword(randomBytes(24).toString("hex"));
    return inviteTenantMember(this.database.connection, {
      tenantId,
      email: input.email,
      defaultHash,
      role: input.role,
    }).catch((error: unknown) => {
      if (hasDatabaseError(error, "P2002")) {
        throw new ConflictException("That user is already a member of this store.");
      }
      throw error;
    });
  }

  @Patch(":userId")
  async updateRole(
    @Headers("cookie") cookie: string | undefined,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: UpdateMemberRoleDto,
  ) {
    const { tenantId } = await this.auth.requireSession(cookie, ["owner"]);
    const updated = await updateTenantMemberRole(this.database.connection, {
      tenantId,
      userId,
      role: input.role,
    });
    if (!updated) {
      throw new NotFoundException("Member not found or cannot be modified.");
    }
    return updated;
  }

  @Delete(":userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Headers("cookie") cookie: string | undefined,
    @Param("userId", ParseUUIDPipe) userId: string,
  ) {
    const { tenantId } = await this.auth.requireSession(cookie, ["owner", "admin"]);
    const removed = await removeTenantMember(this.database.connection, tenantId, userId);
    if (!removed) {
      throw new NotFoundException("Member not found or cannot be removed.");
    }
  }
}
