import { createApp } from "../dist/create-app.js";

let app;
let baseUrl;

beforeAll(async () => {
  app = await createApp({ logger: false });
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
});

test("reports liveness through HTTP", async () => {
  const response = await fetch(`${baseUrl}/health`);

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});

test("serves the Swagger UI and documents the health response", async () => {
  const ui = await fetch(`${baseUrl}/docs`);
  const spec = await fetch(`${baseUrl}/docs-json`);

  expect(ui.status).toBe(200);
  await expect(ui.text()).resolves.toContain("Swagger UI");
  expect(spec.status).toBe(200);
  const document = await spec.json();
  expect(document.paths["/health"].get.responses["200"]).toBeDefined();
});
