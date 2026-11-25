import { createApp } from "./create-app.js";

async function bootstrap() {
  const host = process.env.API_HOST ?? "127.0.0.1";
  const port = Number(process.env.API_PORT ?? "4000");

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be an integer between 1 and 65535.");
  }

  const app = await createApp(undefined, {
    globalPrefix: process.env.API_PREFIX ?? "api",
    publicOrigin: process.env.VENDELIER_ORIGIN,
  });
  app.enableShutdownHooks();
  await app.listen(port, host);
  const address = host.includes(":") ? `[${host}]` : host;
  console.log(`Vendelier API listening at http://${address}:${port}`);
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
