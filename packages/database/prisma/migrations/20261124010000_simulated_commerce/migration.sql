BEGIN;

CREATE TYPE "order_status" AS ENUM ('pending', 'fulfilled');

ALTER TABLE "tenants" ADD COLUMN "published_at" TIMESTAMPTZ(3);

CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "products_price_stock_nonnegative" CHECK ("price_cents" >= 0 AND "stock" >= 0)
);
CREATE UNIQUE INDEX "products_tenant_id_id_key" ON "products"("tenant_id", "id");
CREATE UNIQUE INDEX "products_tenant_id_sku_key" ON "products"("tenant_id", "sku");

CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "checkout_key" UUID NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_address" TEXT NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_total_nonnegative" CHECK ("total_cents" >= 0)
);
CREATE UNIQUE INDEX "orders_tenant_id_id_key" ON "orders"("tenant_id", "id");
CREATE UNIQUE INDEX "orders_tenant_id_number_key" ON "orders"("tenant_id", "number");
CREATE UNIQUE INDEX "orders_tenant_id_checkout_key_key" ON "orders"("tenant_id", "checkout_key");
CREATE INDEX "orders_tenant_id_created_at_idx" ON "orders"("tenant_id", "created_at");

CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_items_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_tenant_id_product_id_fkey" FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_quantity_and_price" CHECK ("quantity" > 0 AND "price_cents" >= 0)
);
CREATE INDEX "order_items_tenant_id_order_id_idx" ON "order_items"("tenant_id", "order_id");
CREATE INDEX "order_items_tenant_id_product_id_idx" ON "order_items"("tenant_id", "product_id");

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_publish_context" ON "tenants"
    FOR UPDATE TO vendelier_app
    USING ("id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid AND "status" = 'active')
    WITH CHECK ("id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid AND "status" = 'active');

CREATE POLICY "tenant_context" ON "products"
    TO vendelier_app
    USING ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

CREATE POLICY "tenant_context" ON "orders"
    TO vendelier_app
    USING ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

CREATE POLICY "tenant_context" ON "order_items"
    TO vendelier_app
    USING ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

GRANT UPDATE ("published_at") ON "tenants" TO vendelier_app;
GRANT SELECT, INSERT ON "products", "orders", "order_items" TO vendelier_app;
GRANT UPDATE ("name", "description", "sku", "price_cents", "stock") ON "products" TO vendelier_app;
GRANT UPDATE ("status") ON "orders" TO vendelier_app;

CREATE FUNCTION public.vendelier_find_login_account(account_email TEXT)
RETURNS TABLE (id UUID, email TEXT, password_hash TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT account.id, account.email, account.password_hash
    FROM public.users AS account
    WHERE account.email = account_email;
$$;

CREATE FUNCTION public.vendelier_register_owner(account_email TEXT, account_hash TEXT, tenant_name TEXT, tenant_slug TEXT)
RETURNS TABLE (user_id UUID, tenant_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    owner_id UUID := gen_random_uuid();
    store_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.users (id, email, password_hash) VALUES (owner_id, account_email, account_hash);
    INSERT INTO public.tenants (id, slug, name) VALUES (store_id, tenant_slug, tenant_name);
    INSERT INTO public.memberships (tenant_id, user_id, role) VALUES (store_id, owner_id, 'owner');
    RETURN QUERY SELECT owner_id, store_id;
END;
$$;

CREATE FUNCTION public.vendelier_find_owner_tenant(account_id UUID)
RETURNS TABLE (id UUID, slug TEXT, name TEXT, published_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT tenant.id, tenant.slug, tenant.name, tenant.published_at
    FROM public.tenants AS tenant
    JOIN public.memberships AS membership ON membership.tenant_id = tenant.id
    WHERE membership.user_id = account_id AND membership.role = 'owner' AND tenant.status = 'active'
    ORDER BY membership.created_at, tenant.id
    LIMIT 1;
$$;

CREATE FUNCTION public.vendelier_find_published_tenant(tenant_slug TEXT)
RETURNS TABLE (id UUID, slug TEXT, name TEXT, published_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT tenant.id, tenant.slug, tenant.name, tenant.published_at
    FROM public.tenants AS tenant
    WHERE tenant.slug = tenant_slug AND tenant.status = 'active' AND tenant.published_at IS NOT NULL;
$$;

CREATE FUNCTION public.vendelier_platform_overview()
RETURNS TABLE (tenants JSONB, order_count BIGINT, revenue_cents BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'slug', tenant.slug,
            'name', tenant.name,
            'published', tenant.published_at IS NOT NULL,
            'status', tenant.status
        ) ORDER BY tenant.slug), '[]'::jsonb)
        FROM public.tenants AS tenant
    ), count(*), COALESCE(sum(orders.total_cents), 0)
    FROM public.orders;
$$;

REVOKE ALL ON FUNCTION
    public.vendelier_find_login_account(TEXT),
    public.vendelier_register_owner(TEXT, TEXT, TEXT, TEXT),
    public.vendelier_find_owner_tenant(UUID),
    public.vendelier_find_published_tenant(TEXT),
    public.vendelier_platform_overview()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    public.vendelier_find_login_account(TEXT),
    public.vendelier_register_owner(TEXT, TEXT, TEXT, TEXT),
    public.vendelier_find_owner_tenant(UUID),
    public.vendelier_find_published_tenant(TEXT),
    public.vendelier_platform_overview()
TO vendelier_app;

COMMIT;
