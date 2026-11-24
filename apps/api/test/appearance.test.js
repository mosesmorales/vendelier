import { createHash, randomUUID } from "node:crypto";
import { createApp } from "../dist/create-app.js";
import { MediaStorageService } from "../dist/media/media-storage.service.js";

const flowTest = process.env.API_FLOW_TEST === "1" ? test : test.skip;

flowTest("isolates draft branding and images by surface, revision, and store", async () => {
  const app = await createApp({ logger: false }, { globalPrefix: "api", corsOrigins: [] });
  const storage = app.get(MediaStorageService);
  const files = new Map();
  const webpFixture = Buffer.from("test-image-store");
  storage.importImage = async (tenantId, id) => {
    files.set(`${tenantId}/${id}`, webpFixture);
    return webpFixture.length;
  };
  storage.readImage = async (tenantId, id) => {
    const file = files.get(`${tenantId}/${id}`);
    if (!file) {
      throw new Error("Unexpected media storage key.");
    }
    return file;
  };

  try {
    await app.listen(0, "127.0.0.1");
    const base = `${await app.getUrl()}/api`;
    const request = async (path, status, { method = "GET", body, cookie } = {}) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      if (response.status !== status) {
        throw new Error(`${method} ${path}: expected ${status}, got ${response.status} ${text}`);
      }
      const isJson = response.headers.get("content-type")?.startsWith("application/json");
      return { data: text && isJson ? JSON.parse(text) : text, headers: response.headers };
    };

    const register = async () => {
      const slug = `appearance-${randomUUID().slice(0, 12)}`;
      const storeName = `Appearance fixture ${slug}`;
      const owner = { email: `${slug}@example.com`, password: "demo-branding-test-password", storeName, slug };
      const { headers } = await request("/auth/register", 201, { method: "POST", body: owner });
      const cookie = headers.get("set-cookie").split(";")[0];
      await request("/studio/publish", 200, { method: "POST", cookie });
      return { slug, storeName, cookie };
    };

    const owner = await register();
    const other = await register();
    const { cookie } = owner;
    const storePath = `/store/${owner.slug}`;
    const appearancePath = "/studio/appearance";
    const storefrontPath = `${appearancePath}/storefront`;
    const previewPath = `${storefrontPath}/atelier`;
    await request(appearancePath, 401);
    const { data: initial } = await request(appearancePath, 200, { cookie });
    expect(initial.studio.draft.displayName).toBe(owner.storeName);
    expect(initial.storefront).toMatchObject({ published: null, version: 0, revision: 0 });

    const upload = { method: "POST", body: { url: "https://images.example.test/fixture.png" }, cookie };
    const { data: logo } = await request("/studio/media", 201, upload);
    const { data: productImage } = await request("/studio/media", 201, upload);
    const { headers: privateHeaders } = await request(`/studio/media/${logo.id}`, 200, { cookie });
    expect(privateHeaders.get("cache-control")).toContain("no-store");
    expect(privateHeaders.get("content-type")).toBe("image/webp");
    expect(privateHeaders.get("x-content-type-options")).toBe("nosniff");
    await request(`/studio/media/${logo.id}`, 404, { cookie: other.cookie });
    await request(`${storePath}/media/${logo.id}`, 404);

    const studioDraft = { ...initial.studio.draft, displayName: "Studio appearance", logoId: logo.id };
    const studioPath = `${appearancePath}/studio`;
    const { data: savedStudio } = await request(studioPath, 200, {
      method: "PATCH", body: { draft: studioDraft, revision: 0 }, cookie,
    });
    expect(savedStudio).toMatchObject({ draft: studioDraft, published: null, version: 0, revision: 1 });
    const { data: studioPublished } = await request(`${studioPath}/publish`, 200, {
      method: "POST", body: { revision: savedStudio.revision }, cookie,
    });
    expect(studioPublished).toMatchObject({ published: studioDraft, version: 1, revision: 2 });
    expect((await request("/studio/overview", 200, { cookie })).data.theme).toEqual(studioDraft);
    expect((await request(storePath, 200)).data.theme).toBeNull();
    await request(`${storePath}/media/${logo.id}`, 404);

    const storefrontDraft = { ...initial.storefront.draft, displayName: "Atelier <Norte> & Centro", bannerId: logo.id };
    const draftRequest = { method: "PATCH", body: { draft: storefrontDraft, revision: 0 }, cookie };
    await request(storefrontPath, 404, { ...draftRequest, cookie: other.cookie });
    await request(storefrontPath, 200, draftRequest);
    await request(storefrontPath, 409, draftRequest);
    await request(`${storefrontPath}/publish`, 409, { method: "POST", body: { revision: 0 }, cookie });
    await request(`${storePath}/media/${logo.id}`, 404);
    await request(previewPath, 401);
    await request(`/store/${owner.slug}-unknown/atelier`, 404);
    const [preview, otherPreview, beforePublish] = await Promise.all([
      request(previewPath, 200, { cookie }),
      request(previewPath, 200, { cookie: other.cookie }),
      request(`${storePath}/atelier`, 200),
    ]);
    expect(preview.headers.get("content-type")).toMatch(/^text\/html/);
    expect(preview.headers.get("cache-control")).toBe("private, no-store");
    expect(preview.headers.get("content-security-policy")).toContain("sandbox");
    expect(preview.headers.get("x-robots-tag")).toContain("noindex");
    expect(preview.data).toContain("Atelier &lt;Norte&gt; &amp; Centro");
    expect(preview.data).toContain(`/api/studio/media/${logo.id}`);
    expect(otherPreview.data).toContain(other.storeName);
    expect(otherPreview.data).not.toContain(logo.id);
    expect(beforePublish.data).toContain(owner.storeName);
    expect(beforePublish.data).not.toContain(logo.id);

    const { data: published } = await request(`${storefrontPath}/publish`, 200, {
      method: "POST", body: { revision: 1 }, cookie,
    });
    expect(published).toMatchObject({ published: storefrontDraft, version: 1, revision: 2 });
    expect((await request(storePath, 200)).data.theme).toEqual(storefrontDraft);
    expect((await request(`${storePath}/media/${logo.id}`, 200)).data).toBe(webpFixture.toString());
    await request(`/store/${other.slug}/media/${logo.id}`, 404);
    expect((await request(`/store/${other.slug}`, 200)).data.theme).toBeNull();

    const badDraft = {
      ...storefrontDraft,
      displayName: "Nombre de borrador pendiente",
      light: { ...storefrontDraft.light, text: storefrontDraft.light.surface },
    };
    const { data: savedBadDraft } = await request(storefrontPath, 200, {
      method: "PATCH", body: { draft: badDraft, revision: 2 }, cookie,
    });
    await request(`${storefrontPath}/publish`, 400, {
      method: "POST", body: { revision: savedBadDraft.revision }, cookie,
    });
    expect((await request(storePath, 200)).data.theme).toEqual(storefrontDraft);

    const productInput = {
      name: "Fixture product", description: "Product with an image", sku: "FIXTURE-1", priceCents: 1000, stock: 1,
      imageId: productImage.id,
    };
    await request("/studio/products", 404, { method: "POST", body: productInput, cookie: other.cookie });
    const { data: product } = await request("/studio/products", 201, { method: "POST", body: productInput, cookie });
    expect((await request(storePath, 200)).data.products[0].imageId).toBe(productImage.id);
    await request(`${storePath}/media/${productImage.id}`, 200);
    const [atelier, otherAtelier, updatedPreview] = await Promise.all([
      request(`${storePath}/atelier`, 200),
      request(`/store/${other.slug}/atelier`, 200),
      request(previewPath, 200, { cookie }),
    ]);
    const css = atelier.data.match(/<style>([\s\S]+?)<\/style>/)?.[1];
    expect(css).toBeDefined();
    const styleHash = createHash("sha256").update(css).digest("base64");
    expect(atelier.headers.get("content-security-policy")).toContain(`'sha256-${styleHash}'`);
    expect(atelier.headers.get("cache-control")).toBe("no-store");
    expect(atelier.data).toContain("Atelier &lt;Norte&gt; &amp; Centro");
    expect(atelier.data).toContain(productInput.name);
    expect(atelier.data).toContain(`/api${storePath}/media/${productImage.id}`);
    expect(atelier.data).not.toContain(badDraft.displayName);
    expect(updatedPreview.data).toContain(badDraft.displayName);
    expect(otherAtelier.data).toContain(other.storeName);
    expect(otherAtelier.data).not.toContain(productInput.name);
    const { data: removed } = await request(`/studio/products/${product.id}`, 200, {
      method: "PATCH", body: { imageId: null }, cookie,
    });
    expect(removed.imageId).toBeNull();
    await request(`${storePath}/media/${productImage.id}`, 404);
  } finally {
    await app.close();
  }
}, 30_000);
