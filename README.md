# Vendelier

Vendelier es una plataforma de comercio electrónico multiempresa para que negocios independientes publiquen y operen su propia tienda. El MVP apunta a México y usa pagos de prueba. El [plan maestro de implementación](resources/Vendelier_Plan_Maestro_Implementacion.pdf) describe el producto y la [decisión de arquitectura](docs/architecture/modular-monolith.md) recoge la adaptación del plan al repositorio.

## Inicio local

Usa Node.js **24.21.0**, pnpm **10.28.0** y PostgreSQL 17. La [guía de PostgreSQL](docs/database/local.md) incluye el arranque con Docker Compose y con PostgreSQL instalado en Windows.

```sh
pnpm install --frozen-lockfile
pnpm --filter @vendelier/database db:generate
pnpm --filter @vendelier/database db:migrate
pnpm --filter @vendelier/database db:seed
pnpm dev
```

| Superficie | URL local |
| --- | --- |
| Vendelier Web | [Inicio](http://localhost:3000/) |
| Vendelier Control | [Administración](http://localhost:3000/control) |
| Vendelier Studio | [Panel comercial](http://localhost:3000/studio) |
| Vendelier Store | [Entrada a tiendas](http://localhost:3000/tiendas) · `/tiendas/<slug>` |
| API | [Salud](http://localhost:3000/api/health) · [Swagger](http://localhost:3000/api/docs) |

Levanta y configura PostgreSQL antes de ejecutar las migraciones. `pnpm dev` prepara Prisma y levanta un servidor Node.js para todas las superficies y la API. Las interfaces, la sesión y los recursos multimedia usan el mismo origen. Puedes elegir otra dirección con `VENDELIER_HOST` y `VENDELIER_PORT`. Si ya había servidores separados en ejecución, detén esos procesos antes de usar el puerto 3000. El endpoint de salud también funciona con PostgreSQL desconectado.

Para ejecutar la compilación de producción usa `pnpm build` seguido de `pnpm start`. Consulta el [arranque y configuración del monolito](docs/architecture/modular-monolith.md) para alojarlo detrás de un proxy HTTPS.

## Recorrer la demostración

1. En [Website](http://localhost:3000), registra una cuenta con un correo de prueba y elige el nombre y el slug de tu tienda.
2. En [Studio](http://localhost:3000/studio), agrega un producto con SKU, precio en MXN y existencias. Publica la tienda y abre su enlace público.
3. En Storefront, agrega unidades al carrito y completa la compra como invitado con datos ficticios. Puedes probar un rechazo antes de aprobar el pago. La confirmación muestra el número y total del pedido.
4. Vuelve a Studio, abre los pedidos y marca la compra como preparada. Comprueba que el inventario refleje la cantidad vendida.
5. En [Control](http://localhost:3000/control), ingresa el valor local de `DEMO_ADMIN_TOKEN` para consultar tiendas, pedidos e ingresos de prueba agregados.

Cada compra aprobada se guarda en PostgreSQL y descuenta stock. El medio de pago es un simulador local. El formulario de compra usa datos de envío ficticios y no solicita información de tarjeta.

## Personalizar una empresa

En [Studio](http://localhost:3000/studio#apariencia), abre **Apariencia y marca** para personalizar Studio o Storefront. Cada área tiene su propio nombre, logo, banner y colores para los modos claro y oscuro. Guarda primero el borrador y publícalo cuando la vista previa esté lista.

Pega un enlace HTTPS directo a un PNG, JPEG o WebP para agregar una imagen de marca o una foto de producto. Durante las pruebas se guarda una copia en `.vendelier-local/media/`. La [guía de marca y medios](docs/architecture/branding-media.md) documenta el alcance y la configuración para S3 o MinIO.

## Verificación

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:monolith
```

GitHub Actions también aplica las migraciones y ejecuta las pruebas de aislamiento, comercio y vista previa Liquid con PostgreSQL. Para repetir las pruebas HTTP con una base de demostración, configura `API_FLOW_TEST=1` en tu terminal y ejecuta `pnpm --filter @vendelier/api test` después de compilar. Las pruebas crean tiendas ficticias. Consulta [arquitectura y estado de la implementación](docs/architecture/foundations.md) para ver los límites actuales y los siguientes hitos.
