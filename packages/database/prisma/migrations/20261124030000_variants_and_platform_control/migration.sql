BEGIN;

CREATE TABLE "product_options" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_options_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_options_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "product_options_tenant_id_product_id_fkey" FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "product_options_tenant_id_id_key" ON "product_options"("tenant_id", "id");
CREATE UNIQUE INDEX "product_options_tenant_id_product_id_name_key" ON "product_options"("tenant_id", "product_id", "name");
CREATE INDEX "product_options_tenant_id_product_id_idx" ON "product_options"("tenant_id", "product_id");

CREATE TABLE "product_option_values" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_option_values_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_option_values_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "product_option_values_tenant_id_option_id_fkey" FOREIGN KEY ("tenant_id", "option_id") REFERENCES "product_options"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "product_option_values_tenant_id_id_key" ON "product_option_values"("tenant_id", "id");
CREATE UNIQUE INDEX "product_option_values_tenant_id_option_id_value_key" ON "product_option_values"("tenant_id", "option_id", "value");
CREATE INDEX "product_option_values_tenant_id_option_id_idx" ON "product_option_values"("tenant_id", "option_id");

CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "selected_options" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_variants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "product_variants_tenant_id_product_id_fkey" FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_variants_price_stock_nonnegative" CHECK ("price_cents" >= 0 AND "stock" >= 0)
);
CREATE UNIQUE INDEX "product_variants_tenant_id_id_key" ON "product_variants"("tenant_id", "id");
CREATE UNIQUE INDEX "product_variants_tenant_id_product_id_title_key" ON "product_variants"("tenant_id", "product_id", "title");
CREATE UNIQUE INDEX "product_variants_tenant_id_sku_key" ON "product_variants"("tenant_id", "sku");
CREATE INDEX "product_variants_tenant_id_product_id_idx" ON "product_variants"("tenant_id", "product_id");

ALTER TABLE "order_items" ADD COLUMN "variant_id" UUID;
ALTER TABLE "order_items" ADD COLUMN "variant_title" TEXT;
ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_tenant_id_variant_id_fkey"
    FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "product_variants"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "order_items_tenant_id_variant_id_idx" ON "order_items"("tenant_id", "variant_id");

CREATE TABLE "platform_audit_logs" (
    "id" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_tenant_id" UUID NOT NULL,
    "target_slug" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_audit_logs_target_tenant_id_fkey" FOREIGN KEY ("target_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "platform_audit_logs_created_at_idx" ON "platform_audit_logs"("created_at");
CREATE INDEX "platform_audit_logs_target_tenant_id_idx" ON "platform_audit_logs"("target_tenant_id");

ALTER TABLE "product_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_option_values" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_context" ON "product_options"
    TO vendelier_app
    USING ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

CREATE POLICY "tenant_context" ON "product_option_values"
    TO vendelier_app
    USING ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

CREATE POLICY "tenant_context" ON "product_variants"
    TO vendelier_app
    USING ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "product_options", "product_option_values", "product_variants" TO vendelier_app;
GRANT DELETE ON "products" TO vendelier_app;

CREATE FUNCTION public.vendelier_platform_set_tenant_status(
    target_slug TEXT,
    next_status public.tenant_status,
    audit_actor TEXT,
    audit_reason TEXT DEFAULT NULL
)
RETURNS TABLE (slug TEXT, name TEXT, published BOOLEAN, status public.tenant_status)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    updated_tenant public.tenants%ROWTYPE;
BEGIN
    UPDATE public.tenants AS tenant
    SET status = next_status
    WHERE tenant.slug = target_slug
    RETURNING * INTO updated_tenant;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    INSERT INTO public.platform_audit_logs (id, actor, action, target_tenant_id, target_slug, details)
    VALUES (
        gen_random_uuid(),
        audit_actor,
        CASE WHEN next_status = 'suspended' THEN 'tenant.suspended' ELSE 'tenant.activated' END,
        updated_tenant.id,
        updated_tenant.slug,
        jsonb_build_object(
            'status', next_status,
            'reason', COALESCE(NULLIF(trim(audit_reason), ''), '')
        )
    );

    RETURN QUERY SELECT
        updated_tenant.slug,
        updated_tenant.name,
        updated_tenant.published_at IS NOT NULL,
        updated_tenant.status;
END;
$$;

CREATE FUNCTION public.vendelier_platform_audit_logs(max_rows INTEGER DEFAULT 50)
RETURNS TABLE (id UUID, actor TEXT, action TEXT, target_slug TEXT, details JSONB, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT log.id, log.actor, log.action, log.target_slug, log.details, log.created_at
    FROM public.platform_audit_logs AS log
    ORDER BY log.created_at DESC
    LIMIT GREATEST(1, LEAST(max_rows, 200));
$$;

REVOKE ALL ON FUNCTION public.vendelier_platform_set_tenant_status(TEXT, public.tenant_status, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendelier_platform_audit_logs(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendelier_platform_set_tenant_status(TEXT, public.tenant_status, TEXT, TEXT) TO vendelier_app;
GRANT EXECUTE ON FUNCTION public.vendelier_platform_audit_logs(INTEGER) TO vendelier_app;

COMMIT;
