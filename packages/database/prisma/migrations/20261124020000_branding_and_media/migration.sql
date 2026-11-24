BEGIN;

ALTER TABLE "tenant_theme_settings"
    ADD COLUMN "draft_revision" INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT "tenant_theme_settings_draft_revision_nonnegative" CHECK ("draft_revision" >= 0);

CREATE POLICY "tenant_insert_context" ON "tenant_theme_settings"
    FOR INSERT TO vendelier_app
    WITH CHECK ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

CREATE POLICY "tenant_update_context" ON "tenant_theme_settings"
    FOR UPDATE TO vendelier_app
    USING ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

GRANT INSERT ("tenant_id", "scope", "draft_json", "published_json", "version", "draft_revision", "updated_by", "updated_at", "published_at")
    ON "tenant_theme_settings" TO vendelier_app;
GRANT UPDATE ("draft_json", "published_json", "version", "draft_revision", "updated_by", "updated_at", "published_at")
    ON "tenant_theme_settings" TO vendelier_app;

CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "byte_length" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "media_assets_byte_length_positive" CHECK ("byte_length" > 0)
);
CREATE UNIQUE INDEX "media_assets_tenant_id_id_key" ON "media_assets"("tenant_id", "id");

ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_context" ON "media_assets"
    TO vendelier_app
    USING ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON "media_assets" TO vendelier_app;

ALTER TABLE "products" ADD COLUMN "image_id" UUID;
ALTER TABLE "products"
    ADD CONSTRAINT "products_tenant_id_image_id_fkey" FOREIGN KEY ("tenant_id", "image_id") REFERENCES "media_assets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "products_tenant_id_image_id_idx" ON "products"("tenant_id", "image_id");
GRANT UPDATE ("image_id") ON "products" TO vendelier_app;

COMMIT;
