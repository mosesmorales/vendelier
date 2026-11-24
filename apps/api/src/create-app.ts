import "reflect-metadata";
import type { IncomingMessage, ServerResponse } from "node:http";
import { TLSSocket } from "node:tls";
import { type INestApplication, type NestApplicationOptions, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { SESSION_COOKIE } from "./commerce/security.js";

export interface ApiRoutingOptions {
  globalPrefix?: string;
  publicOrigin?: string;
  corsOrigins?: string[];
}

export async function createApp(
  options?: NestApplicationOptions,
  routing: ApiRoutingOptions = {},
): Promise<INestApplication> {
  const publicOrigin = resolvePublicOrigin(routing.publicOrigin);
  const defaultOrigins = [3000, 3001, 3002, 3003].map((port) => `http://localhost:${port}`);
  const configuredOrigins = process.env.API_CORS_ORIGINS?.split(",");
  const origins = new Set((routing.corsOrigins ?? configuredOrigins ?? defaultOrigins)
    .map((origin) => origin.trim()).filter(Boolean));
  const app = await NestFactory.create(AppModule, options);

  if (routing.globalPrefix) {
    app.setGlobalPrefix(routing.globalPrefix);
  }

  app.use((request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const origin = request.headers.origin;
    const readOnlyMethod = ["GET", "HEAD", "OPTIONS"].includes(request.method ?? "");
    if (!readOnlyMethod && origin && origin !== (publicOrigin ?? requestOrigin(request)) && !origins.has(origin)) {
      response.writeHead(403, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ statusCode: 403, message: "Origin is not allowed." }));
      return;
    }
    next();
  });
  if (origins.size > 0) {
    app.enableCors({ credentials: true, origin: [...origins] });
  }

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );

  const openApiConfig = new DocumentBuilder()
    .setTitle("Vendelier API")
    .setDescription("Vendelier REST API")
    .setVersion("0.1.0")
    .addCookieAuth(SESSION_COOKIE)
    .addBearerAuth()
    .build();

  SwaggerModule.setup("docs", app, () => SwaggerModule.createDocument(app, openApiConfig), {
    useGlobalPrefix: true,
    raw: ["json"],
  });

  return app;
}

function resolvePublicOrigin(configured: string | undefined): string | undefined {
  if (!configured?.trim()) {
    return undefined;
  }
  const url = URL.parse(configured.trim());
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash) {
    throw new Error("VENDELIER_ORIGIN must be an HTTP(S) origin without a path, query, or credentials.");
  }
  return url.origin;
}

function requestOrigin(request: IncomingMessage): string | undefined {
  const authority = request.headers.host;
  if (!authority || /[\s,\\/?#@%]/.test(authority)) {
    return undefined;
  }
  const scheme = request.socket instanceof TLSSocket && request.socket.encrypted ? "https" : "http";
  return URL.parse(`${scheme}://${authority}`)?.origin;
}
