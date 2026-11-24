BEGIN;

CREATE TYPE "tenant_status" AS ENUM ('active', 'suspended');
CREATE TYPE "membership_role" AS ENUM ('owner', 'admin', 'catalog', 'orders', 'analyst');
CREATE TYPE "theme_scope" AS ENUM ('studio', 'storefront');

CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenants_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") <= 63)
);
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_normalized" CHECK ("email" = lower(btrim("email")) AND "email" <> '')
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "memberships" (
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "membership_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("tenant_id", "user_id"),
    CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

CREATE TABLE "tenant_theme_settings" (
    "tenant_id" UUID NOT NULL,
    "scope" "theme_scope" NOT NULL,
    "draft_json" JSONB NOT NULL DEFAULT '{}',
    "published_json" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    CONSTRAINT "tenant_theme_settings_pkey" PRIMARY KEY ("tenant_id", "scope"),
    CONSTRAINT "tenant_theme_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tenant_theme_settings_tenant_id_updated_by_fkey" FOREIGN KEY ("tenant_id", "updated_by") REFERENCES "memberships"("tenant_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tenant_theme_settings_published_state" CHECK (
        ("version" = 0 AND "published_json" IS NULL AND "published_at" IS NULL)
        OR ("version" > 0 AND "published_json" IS NOT NULL AND "published_at" IS NOT NULL)
    )
);
CREATE INDEX "tenant_theme_settings_tenant_id_updated_by_idx" ON "tenant_theme_settings"("tenant_id", "updated_by");

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_theme_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_context" ON "tenants"
    FOR SELECT TO vendelier_app
    USING ("id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

CREATE POLICY "tenant_context" ON "memberships"
    FOR SELECT TO vendelier_app
    USING ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

CREATE POLICY "tenant_context" ON "tenant_theme_settings"
    FOR SELECT TO vendelier_app
    USING ("tenant_id" = NULLIF(current_setting('vendelier.tenant_id', true), '')::uuid);

GRANT SELECT ON "tenants", "memberships", "tenant_theme_settings" TO vendelier_app;

COMMIT;
