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

El contenedor publica PostgreSQL en `127.0.0.1:5432`. Los roles se inicializan al crear el volumen de datos. Si cambias las contraseñas de referencia, actualiza también las URLs correspondientes. El servidor HTTP del monolito usa un puerto distinto. Sus módulos de negocio comparten el cliente Prisma del proceso a través de `DATABASE_URL`.

| Variable | Propósito |
| --- | --- |
| `DATABASE_MIGRATION_URL` | Aplicar migraciones y cargar los datos de desarrollo. |
| `DATABASE_URL` | Conexión con permisos acotados para el acceso de la aplicación. |
| `DATABASE_SHADOW_URL` | Base sombra de Prisma para crear migraciones con `db:migrate:dev`. |
| `SESSION_SECRET` | Firma de las sesiones de propietario. |
| `DEMO_ADMIN_TOKEN` | Clave del panel de plataforma para la demostración local. |

Los datos de demostración crean Urban Kicks, Casa Studio y Bloom con una configuración de marca para Studio y otra para Storefront. Las seeds conservan los datos existentes. Para probar registro, catálogo y publicación desde la interfaz, crea una cuenta de prueba y publica su tienda desde Studio. Usa `docker compose down` para detener PostgreSQL y conservar el volumen.

## Aislamiento de base de datos

`vendelier_migrator` aplica las migraciones y carga las seeds. `vendelier_app` opera sobre catálogo, pedidos, temas y medios bajo políticas de seguridad a nivel de fila (RLS). Solo puede actualizar las columnas que requiere la demostración. Las operaciones de identidad usan funciones de alcance reducido. El rol de ejecución carece de acceso directo a `users`.

`withTenant` fija el identificador de empresa en el contexto local de la transacción. Los servicios de Studio resuelven la empresa desde la sesión. En Storefront, la API resuelve un slug público y verifica que la tienda esté publicada. Las claves compuestas impiden cruzar productos, pedidos e imágenes de distintas empresas.
