import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const hostname = "127.0.0.1";
const webDirectory = fileURLToPath(new URL("../apps/vendelier/", import.meta.url));
const apiDirectory = fileURLToPath(new URL("../apps/api/", import.meta.url));

async function reservePort() {
  const socket = createServer();
  socket.listen(0, hostname);
  await once(socket, "listening");
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return port;
}

function waitForOutput(child, stopped, needle, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out starting ${label}.\n${output}`)), 20_000);
    let output = "";
    const record = (chunk) => {
      output += chunk;
      if (output.includes(needle)) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on("data", record);
    child.stderr.on("data", record);
    stopped.then((code) => {
      clearTimeout(timer);
      reject(new Error(`${label} exited while starting (${code}).\n${output}`));
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

test("serves Vendelier frontend and NestJS API as two separate apps with Next.js /api rewrite", { timeout: 45_000 }, async (context) => {
  const apiPort = await reservePort();
  const webPort = await reservePort();
  const apiOrigin = `http://${hostname}:${apiPort}`;
  const webOrigin = `http://${hostname}:${webPort}`;

  const apiChild = spawn(process.execPath, ["dist/main.js"], {
    cwd: apiDirectory,
    env: {
      ...process.env,
      API_HOST: hostname,
      API_PORT: String(apiPort),
      VENDELIER_ORIGIN: webOrigin,
      API_CORS_ORIGINS: webOrigin,
    },
  });
  const apiStopped = once(apiChild, "exit");

  const webChild = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(webPort), "-H", hostname],
    {
      cwd: webDirectory,
      env: {
        ...process.env,
        API_INTERNAL_URL: apiOrigin,
      },
    },
  );
  const webStopped = once(webChild, "exit");

  context.after(async () => {
    for (const [child, stopped] of [[webChild, webStopped], [apiChild, apiStopped]]) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      await stopped;
    }
  });

  await Promise.all([
    waitForOutput(apiChild, apiStopped, `Vendelier API listening at ${apiOrigin}`, "Vendelier API"),
    waitForOutput(webChild, webStopped, String(webPort), "Vendelier Web"),
  ]);

  const website = await fetch(webOrigin);
  assert.equal(website.status, 200);
  const html = await website.text();
  const stylesheet = html.match(/href="(\/_next\/static\/[^" ]+\.css)"/)?.[1];
  assert.ok(stylesheet);
  assert.equal((await fetch(webOrigin + stylesheet)).status, 200);

  for (const path of ["/studio", "/control", "/tiendas", "/tiendas/demo"]) {
    const response = await fetch(webOrigin + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    await response.body.cancel();
  }

  const health = await fetch(`${webOrigin}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });

  const openapi = await fetch(`${webOrigin}/api/docs-json`);
  assert.equal(openapi.status, 200);
  assert.ok((await openapi.json()).paths["/api/health"]);
  assert.equal((await fetch(`${webOrigin}/api/studio/appearance/storefront/atelier`)).status, 401);
  assert.equal((await fetch(`${webOrigin}/api/unknown`)).status, 404);
});
