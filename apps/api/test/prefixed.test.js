import { createApp } from "../dist/create-app.js";

async function withPrefixedApi(options, run) {
  const app = await createApp({ logger: false }, { globalPrefix: "api", corsOrigins: [], ...options });
  try {
    await app.listen(0, "127.0.0.1");
    await run(await app.getUrl());
  } finally {
    await app.close();
  }
}

test("hosts the API, Swagger assets and OpenAPI document under /api", async () => {
  await withPrefixedApi({}, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ status: "ok" });
    expect((await fetch(`${baseUrl}/health`)).status).toBe(404);

    const ui = await fetch(`${baseUrl}/api/docs`);
    expect(ui.status).toBe(200);
    await expect(ui.text()).resolves.toContain("Swagger UI");
    const asset = await fetch(`${baseUrl}/api/docs/swagger-ui.css`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("text/css");

    const spec = await fetch(`${baseUrl}/api/docs-json`);
    expect(spec.status).toBe(200);
    const document = await spec.json();
    expect(document.paths["/api/health"].get.responses["200"]).toBeDefined();
    expect(document.paths["/health"]).toBeUndefined();
  });
});

test("matches the direct origin and ignores spoofed forwarding headers", async () => {
  await withPrefixedApi({}, async (baseUrl) => {
    const path = `${baseUrl}/api/auth/logout`;
    const sameSite = await fetch(path, { method: "POST", headers: { Origin: baseUrl } });
    expect(sameSite.status).toBe(204);
    expect(sameSite.headers.has("access-control-allow-origin")).toBe(false);

    const rejected = await fetch(path, {
      method: "POST",
      headers: {
        Origin: "https://unknown.example",
        "X-Forwarded-Host": "unknown.example",
        "X-Forwarded-Proto": "https",
      },
    });
    expect(rejected.status).toBe(403);
    expect((await fetch(path, { method: "POST" })).status).toBe(204);
  });
});

test("accepts the configured public origin behind a TLS proxy", async () => {
  await withPrefixedApi({ publicOrigin: "https://vendelier.example" }, async (baseUrl) => {
    const path = `${baseUrl}/api/auth/logout`;
    const accepted = await fetch(path, { method: "POST", headers: { Origin: "https://vendelier.example" } });
    expect(accepted.status).toBe(204);
    const rejected = await fetch(path, { method: "POST", headers: { Origin: "http://vendelier.example" } });
    expect(rejected.status).toBe(403);
  });
});
