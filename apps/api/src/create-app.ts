import "reflect-metadata";
import type { IncomingMessage, ServerResponse } from "node:http";
import { TLSSocket } from "node:tls";
import { type NestApplicationOptions, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { SESSION_COOKIE } from "./commerce/security.js";

export async function createApp(options?: NestApplicationOptions) {
  const app = await NestFactory.create(AppModule, options);
  const defaultOrigins = [3000, 3001, 3002, 3003].map((port) => `http://localhost:${port}`);
  const configuredOrigins = process.env.API_CORS_ORIGINS?.split(",");
  const origins = new Set((configuredOrigins ?? defaultOrigins).map((origin) => origin.trim()).filter(Boolean));

  app.use((request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const origin = request.headers.origin;
    const readOnlyMethod = ["GET", "HEAD", "OPTIONS"].includes(request.method ?? "");
    const protocol = request.socket instanceof TLSSocket ? "https" : "http";
    const localOrigins = ["localhost", "127.0.0.1", "[::1]"].map((host) =>
      new URL(`${protocol}://${host}:${request.socket.localPort}`).origin,
    );
    if (!readOnlyMethod && origin && !localOrigins.includes(origin) && !origins.has(origin)) {
      response.writeHead(403, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ statusCode: 403, message: "Origin is not allowed." }));
      return;
    }
    next();
  });
  app.enableCors({
    credentials: true,
    origin: [...origins],
  });

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
    jsonDocumentUrl: "/docs-json",
    raw: ["json"],
  });

  return app;
}
