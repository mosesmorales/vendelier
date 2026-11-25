# PostgreSQL local

Si ya tienes PostgreSQL 17 instalado en Windows y el servicio del sistema utiliza el puerto 5432, puedes preparar una instancia separada desde PowerShell. El script genera credenciales locales en `.env`, almacena los datos en `.vendelier-local/` y usa solo `127.0.0.1:55432`.

```powershell
.\infrastructure\scripts\start-demo-db.ps1
```

Puedes pasar `-PostgresBin` si `pg_ctl.exe`, `initdb.exe` y `psql.exe` están en otra carpeta. Luego ejecuta los comandos de Prisma de abajo.

## Docker Compose

Docker Compose prepara PostgreSQL 17 y las conexiones de referencia de desarrollo. Desde la raíz, copia `.env.example` a `.env` y ejecuta estos comandos.

```sh
docker compose up --wait postgres
```

Antes de arrancar Vendelier, asigna a `SESSION_SECRET` y `DEMO_ADMIN_TOKEN` dos valores aleatorios distintos de al menos 32 caracteres. Genera cada uno con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

## Migraciones y datos

```sh
pnpm --filter @vendelier/database db:generate
pnpm --filter @vendelier/database db:migrate
pnpm --filter @vendelier/database db:seed
pnpm --filter @vendelier/database db:test
```

El contenedor publica PostgreSQL en `127.0.0.1:5432`. Los roles se inicializan al crear el volumen de datos. Si cambias las contraseñas de referencia, actualiza también las URLs correspondientes. La aplicación backend (`@vendelier/api`) conecta con PostgreSQL usando el cliente Prisma a través de `DATABASE_URL`.

| Variable | Propósito |
| --- | --- |
| `DATABASE_MIGRATION_URL` | Aplicar migraciones y cargar los datos de desarrollo. |
| `DATABASE_URL` | Conexión con permisos acotados para el acceso de la aplicación. |
| `DATABASE_SHADOW_URL` | Base sombra de Prisma para crear migraciones con `db:migrate:dev`. |
| `SESSION_SECRET` | Firma de las sesiones de propietario. |
| `DEMO_ADMIN_TOKEN` | Clave del panel de plataforma para la demostración local. |

Los datos de demostración (`prisma/seed.ts`) crean y publican **Urban Kicks**, **Casa Studio** y **Bloom** junto con sus cuentas propietarias (`owner@urbankicks.mx`, `owner@casastudio.mx`, `owner@bloom.mx`), temas de Studio y Storefront en formato `AppearanceTheme`, productos con opciones/variantes y pedidos de muestra. Las seeds conservan los datos existentes. Usa `docker compose down` para detener PostgreSQL y conservar el volumen.

## Aislamiento de base de datos

`vendelier_migrator` aplica las migraciones y carga las seeds. `vendelier_app` opera sobre catálogo (`products`, `product_options`, `product_option_values`, `product_variants`), pedidos, temas y medios bajo políticas de seguridad a nivel de fila (RLS). Solo puede actualizar las columnas que requiere la demostración. Las operaciones de identidad, membresías/RBAC (`vendelier_find_member_tenant`, `vendelier_list_tenant_members`, `vendelier_invite_tenant_member`, `vendelier_update_member_role`, `vendelier_remove_tenant_member`) y control de plataforma (`vendelier_platform_set_tenant_status`, `vendelier_platform_audit_logs`, `platform_audit_logs`) usan funciones `SECURITY DEFINER` de alcance reducido. El rol de ejecución carece de acceso directo a `users`.

`withTenant` fija el identificador de empresa en el contexto local de la transacción. Los servicios de Studio resuelven la empresa desde la sesión. En Storefront, la API resuelve un slug público y verifica que la tienda esté publicada y activa (`status = 'active'`). Las claves compuestas impiden cruzar productos, variantes, pedidos e imágenes de distintas empresas.
