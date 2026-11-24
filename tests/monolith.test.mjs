import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const hostname = "127.0.0.1";
const appDirectory = fileURLToPath(new URL("../apps/vendelier/", import.meta.url));

async function reservePort() {
  const socket = createServer();
  socket.listen(0, hostname);
  await once(socket, "listening");
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return port;
}

test("serves Vendelier and the prefixed API from the same production listener", { timeout: 30_000 }, async (context) => {
  const port = await reservePort();
  const origin = `http://${hostname}:${port}`;
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: appDirectory,
    env: { ...process.env, VENDELIER_HOST: hostname, VENDELIER_PORT: String(port), VENDELIER_ORIGIN: origin },
  });
  const stopped = once(child, "exit");
  context.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await stopped;
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out starting Vendelier.\n${output}`)), 15_000);
    let output = "";
    const record = (chunk) => {
      output += chunk;
      if (output.includes(`Vendelier listening at ${origin}`)) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on("data", record);
    child.stderr.on("data", record);
    stopped.then((code) => {
      clearTimeout(timer);
      reject(new Error(`Vendelier exited while starting (${code}).\n${output}`));
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  const website = await fetch(origin);
  assert.equal(website.status, 200);
  const html = await website.text();
  const stylesheet = html.match(/href="(\/_next\/static\/[^" ]+\.css)"/)?.[1];
  assert.ok(stylesheet);
  assert.equal((await fetch(origin + stylesheet)).status, 200);

  for (const path of ["/studio", "/control", "/tiendas", "/tiendas/demo"]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    await response.body.cancel();
  }

  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });

  const openapi = await fetch(`${origin}/api/docs-json`);
  assert.equal(openapi.status, 200);
  assert.ok((await openapi.json()).paths["/api/health"]);
  assert.equal((await fetch(`${origin}/api/studio/appearance/storefront/atelier`)).status, 401);
  assert.equal((await fetch(`${origin}/api/unknown`)).status, 404);
});
