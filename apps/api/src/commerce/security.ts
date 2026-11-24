import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

export const SESSION_COOKIE = "vendelier_session";
const SESSION_DURATION = 60 * 60 * 8;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const DUMMY_SALT = Buffer.alloc(16);
const DUMMY_HASH = Buffer.alloc(64);

interface SessionClaims {
  userId: string;
  email: string;
  expiresAt: number;
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, SCRYPT_OPTIONS, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt-v1:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string | undefined) {
  const parts = /^scrypt-v1:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(hash ?? "");
  const salt = parts ? Buffer.from(parts[1], "hex") : DUMMY_SALT;
  const expected = parts ? Buffer.from(parts[2], "hex") : DUMMY_HASH;
  const actual = await deriveKey(password, salt);
  return timingSafeEqual(actual, expected) && parts !== null;
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new ServiceUnavailableException("The demo session secret is not configured.");
  }
  return secret;
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

function serializeCookie(value: string, maxAge: number): string {
  const secure = process.env.SESSION_COOKIE_SECURE === "true" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function createSessionCookie(userId: string, email: string, secret: string): string {
  const claims: SessionClaims = { userId, email, expiresAt: Date.now() + SESSION_DURATION * 1000 };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return serializeCookie(`${payload}.${signature(payload, secret).toString("base64url")}`, SESSION_DURATION);
}

export function clearSessionCookie(): string {
  return serializeCookie("", 0);
}

export function requireSessionClaims(cookie: string | undefined): SessionClaims {
  const entry = cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = entry?.slice(SESSION_COOKIE.length + 1) ?? "";
  const signed = /^([A-Za-z0-9_-]{1,1024})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!signed) {
    throw new UnauthorizedException("Sign in to continue.");
  }
  const [, payload, encodedSignature] = signed;
  const provided = Buffer.from(encodedSignature, "base64url");
  const expected = signature(payload, sessionSecret());
  if (provided.length !== expected.length || provided.toString("base64url") !== encodedSignature ||
    !timingSafeEqual(provided, expected)) {
    throw new UnauthorizedException("Sign in to continue.");
  }
  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new UnauthorizedException("Sign in to continue.");
  }
  if (!isSessionClaims(claims) || claims.expiresAt <= Date.now()) {
    throw new UnauthorizedException("Sign in to continue.");
  }
  return claims;
}

function isSessionClaims(value: unknown): value is SessionClaims {
  return typeof value === "object" && value !== null &&
    "userId" in value && typeof value.userId === "string" && value.userId.length > 0 &&
    "email" in value && typeof value.email === "string" && value.email.length > 0 &&
    "expiresAt" in value && typeof value.expiresAt === "number" && Number.isSafeInteger(value.expiresAt);
}

export function requireDemoAdmin(header: string | undefined) {
  const configured = process.env.DEMO_ADMIN_TOKEN;
  if (!configured) {
    throw new ServiceUnavailableException("Platform access is disabled.");
  }
  const [, token] = /^Bearer ([^\s]+)$/i.exec(header ?? "") ?? [];
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(token ?? ""), hash(configured))) {
    throw new UnauthorizedException("A platform token is required.");
  }
}
