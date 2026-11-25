import { randomUUID } from "node:crypto";
import { createApp } from "../dist/create-app.js";

const flowTest = process.env.API_FLOW_TEST === "1" ? test : test.skip;

flowTest("runs the sandbox sale across tenant, storefront, Studio, and platform boundaries", async () => {
  const app = await createApp({ logger: false });
  try {
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const suffix = randomUUID().slice(0, 8);
    const owner = {
      email: `api-${suffix}@example.com`,
      password: "demo-checkout-test-password",
      storeName: `API fixture ${suffix}`,
      slug: `api-${suffix}`,
    };

    const request = async (path, status, { method = "GET", body, cookie, headers } = {}) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      if (response.status !== status) {
        throw new Error(`${method} ${path}: expected ${status}, got ${response.status} ${text}`);
      }
      return { data: text ? JSON.parse(text) : undefined, headers: response.headers };
    };

    await request("/auth/register", 403, { method: "POST", body: owner, headers: { Origin: "https://other.example" } });
    const registered = await request("/auth/register", 201, { method: "POST", body: owner, headers: { Origin: base } });
    expect(registered.headers.get("set-cookie")).toMatch(/HttpOnly; SameSite=Lax/);
    const registrationCookie = registered.headers.get("set-cookie").split(";")[0];
    expect(registered.data).toEqual({
      user: { email: owner.email, role: "owner" },
      tenant: { slug: owner.slug, name: owner.storeName, published: false },
    });

    await request(`/store/${owner.slug}`, 404);
    await request("/auth/register", 409, { method: "POST", body: owner });
    await request("/auth/login", 401, { method: "POST", body: { email: owner.email, password: "wrong password" } });
    const loggedIn = await request("/auth/login", 200, { method: "POST", body: { email: owner.email, password: owner.password } });
    const cookie = loggedIn.headers.get("set-cookie").split(";")[0];
    expect((await request("/auth/session", 200, { cookie: registrationCookie })).data).toEqual(registered.data);
    const untrustedSignature = `${cookie.slice(0, -1)}${cookie.endsWith("A") ? "B" : "A"}`;
    await request("/auth/session", 401, { cookie: untrustedSignature });

    const productInput = { name: "Demo product", description: "A test item", sku: "SAME-SKU", priceCents: 1234, stock: 3 };
    const { data: item } = await request("/studio/products", 201, { method: "POST", body: productInput, cookie });
    await request("/studio/products", 409, { method: "POST", body: productInput, cookie });
    const { data: product } = await request(`/studio/products/${item.id}`, 200, {
      method: "PATCH", body: { priceCents: 1450 }, cookie,
    });
    expect(product.priceCents).toBe(1450);

    expect((await request("/studio/publish", 200, { method: "POST", cookie })).data.published).toBe(true);
    const { data: store } = await request(`/store/${owner.slug}`, 200);
    expect(store.products).toEqual([product]);

    const otherOwner = { ...owner, email: `api-other-${suffix}@example.com`, slug: `api-other-${suffix}` };
    const other = await request("/auth/register", 201, { method: "POST", body: otherOwner });
    const otherCookie = other.headers.get("set-cookie").split(";")[0];
    expect((await request("/studio/overview", 200, { cookie: otherCookie })).data.products).toEqual([]);
    await request("/studio/products", 201, { method: "POST", body: productInput, cookie: otherCookie });
    await request(`/studio/products/${item.id}`, 404, { method: "PATCH", body: { stock: 100 }, cookie: otherCookie });

    const checkoutPath = `/store/${owner.slug}/checkout`;
    const checkout = {
      checkoutKey: randomUUID(),
      items: [{ productId: item.id, quantity: 2 }],
      customer: { name: "Demo buyer", email: "buyer@example.com", address: "A fictional address" },
      payment: "approved",
    };
    await request(checkoutPath, 402, { method: "POST", body: { ...checkout, payment: "declined" } });
    expect((await request(`/store/${owner.slug}`, 200)).data.products[0].stock).toBe(3);

    const submissions = await Promise.all(Array.from({ length: 2 }, () =>
      request(checkoutPath, 201, { method: "POST", body: checkout }),
    ));
    const order = submissions[0].data;
    expect(submissions[1].data).toEqual(order);
    expect(order).toMatchObject({
      status: "pending",
      totalCents: 2900,
      items: [{ name: product.name, sku: product.sku, quantity: 2, priceCents: 1450 }],
    });
    await request(checkoutPath, 409, {
      method: "POST", body: { ...checkout, checkoutKey: randomUUID() },
    });
    const { data: overview } = await request("/studio/overview", 200, { cookie });
    expect(overview.products[0].stock).toBe(1);
    expect(overview.orders).toEqual([order]);

    const fulfillmentPath = `/studio/orders/${order.id}/fulfillment`;
    await request(fulfillmentPath, 404, { method: "PATCH", body: { status: "fulfilled" }, cookie: otherCookie });
    const fulfilled = await request(fulfillmentPath, 200, { method: "PATCH", body: { status: "fulfilled" }, cookie });
    expect(fulfilled.data).toMatchObject({ id: order.id, status: "fulfilled" });

    await request("/platform/overview", 401);
    const platform = await request("/platform/overview", 200, {
      headers: { Authorization: `Bearer ${process.env.DEMO_ADMIN_TOKEN}` },
    });
    expect(platform.data.tenants).toContainEqual({
      slug: owner.slug, name: owner.storeName, published: true, status: "active",
    });
    expect(platform.data.orderCount).toBeGreaterThanOrEqual(1);
    expect(platform.data.revenueCents).toBeGreaterThanOrEqual(2900);

    const loggedOut = await request("/auth/logout", 204, { method: "POST", cookie });
    expect(loggedOut.headers.get("set-cookie")).toContain("Max-Age=0");
  } finally {
    await app.close();
  }
}, 30_000);
