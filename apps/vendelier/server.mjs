import { once } from "node:events";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const apiPrefix = "api";
const dev = process.argv.includes("--dev");
process.env.NODE_ENV = dev ? "development" : "production";

const port = Number(process.env.VENDELIER_PORT ?? "3000");
const hostname = process.env.VENDELIER_HOST ?? "127.0.0.1";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("VENDELIER_PORT must be an integer between 1 and 65535.");
}

const [{ default: next }, { createApp }] = await Promise.all([import("next"), import("@vendelier/api")]);
const server = createServer();
const sockets = new Set();
server.on("connection", (socket) => {
  sockets.add(socket);
  socket.once("close", () => sockets.delete(socket));
});

const web = next({
  dev,
  dir: fileURLToPath(new URL(".", import.meta.url)),
  hostname,
  port,
  httpServer: server,
});
const api = await createApp({ abortOnError: false }, {
  globalPrefix: apiPrefix,
  publicOrigin: process.env.VENDELIER_ORIGIN,
  corsOrigins: [],
});

try {
  await api.init();
  await web.prepare();
  const handleApi = api.getHttpAdapter().getInstance();
  const handleWeb = web.getRequestHandler();

  server.on("request", (request, response) => {
    const pathname = request.url?.split("?", 1)[0];
    if (pathname === `/${apiPrefix}` || pathname?.startsWith(`/${apiPrefix}/`)) {
      handleApi(request, response);
      return;
    }

    void handleWeb(request, response).catch((error) => {
      console.error("Next.js failed to serve a request:", error);
      if (response.headersSent) {
        response.destroy();
        return;
      }
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal server error.");
    });
  });

  server.listen(port, hostname);
  await once(server, "listening");
} catch (error) {
  await Promise.allSettled([api.close(), web.close()]);
  throw error;
}

let stopping = false;
async function shutdown() {
  if (stopping) {
    return;
  }
  stopping = true;
  const deadline = setTimeout(() => {
    for (const socket of sockets) {
      socket.destroy();
    }
  }, 5000);
  try {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  } finally {
    clearTimeout(deadline);
    const results = await Promise.allSettled([api.close(), web.close()]);
    for (const result of results) {
      if (result.status === "rejected") {
        throw result.reason;
      }
    }
  }
}

function stop() {
  void shutdown().catch((error) => {
    console.error("Vendelier shutdown failed:", error);
    process.exitCode = 1;
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("error", (error) => {
  console.error("Vendelier HTTP server error:", error);
  process.exitCode = 1;
  stop();
});

const address = hostname.includes(":") ? `[${hostname}]` : hostname;
console.log(`Vendelier listening at http://${address}:${port}`);
