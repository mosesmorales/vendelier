import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { findLoginAccount, findMemberTenant, type MemberRole, registerOwner } from "@vendelier/database";
import { hasDatabaseError } from "./database-errors.js";
import { DatabaseService } from "./database.service.js";
import type { LoginDto, RegisterDto } from "./dto.js";
import { createSessionCookie, hashPassword, requireSessionClaims, sessionSecret, verifyPassword } from "./security.js";
import { tenantView } from "./views.js";

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async register(input: RegisterDto) {
    const secret = sessionSecret();
    const passwordHash = await hashPassword(input.password);
    const owner = await registerOwner(this.database.connection, {
      email: input.email,
      passwordHash,
      name: input.storeName,
      slug: input.slug,
    }).catch((error: unknown) => {
      if (hasDatabaseError(error, "P2002")) {
        throw new ConflictException("That email or store slug is already registered.");
      }
      throw error;
    });

    return {
      body: {
        user: { email: input.email, role: "owner" as MemberRole },
        tenant: { name: input.storeName, slug: input.slug, published: false },
      },
      cookie: createSessionCookie(owner.userId, input.email, secret),
    };
  }

  async login(input: LoginDto) {
    const secret = sessionSecret();
    const account = await findLoginAccount(this.database.connection, input.email);
    const valid = await verifyPassword(input.password, account?.passwordHash);
    if (!account || !valid) {
      throw new UnauthorizedException("Email or password is incorrect.");
    }

    const { session } = await this.loadSession(account.id, account.email);
    return { body: session, cookie: createSessionCookie(account.id, account.email, secret) };
  }

  async requireSession(cookie: string | undefined, allowedRoles?: readonly MemberRole[]) {
    const claim = requireSessionClaims(cookie);
    const loaded = await this.loadSession(claim.userId, claim.email);
    if (allowedRoles && !allowedRoles.includes(loaded.role)) {
      throw new ForbiddenException("Your role does not allow this action.");
    }
    return loaded;
  }

  private async loadSession(userId: string, email: string) {
    const tenant = await findMemberTenant(this.database.connection, userId);
    if (!tenant) {
      throw new UnauthorizedException("An active store membership is required.");
    }

    return {
      userId,
      tenantId: tenant.id,
      role: tenant.role,
      session: { user: { email, role: tenant.role }, tenant: tenantView(tenant) },
    };
  }
}
