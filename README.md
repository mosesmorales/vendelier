# Vendelier

Vendelier es una plataforma de comercio electrónico multiempresa para que negocios independientes publiquen y operen su propia tienda. El primer MVP apunta a México y usa pagos de prueba. El [plan maestro de implementación](resources/Vendelier_Plan_Maestro_Implementacion.pdf) describe el alcance y el diseño del producto.

## Inicio local

Usa Node.js **24.21.0**, pnpm **10.28.0** y PostgreSQL 17. La [guía de PostgreSQL](docs/database/local.md) incluye el arranque con Docker Compose y con PostgreSQL instalado en Windows.

```sh
pnpm install --frozen-lockfile
pnpm --filter @vendelier/database db:generate
pnpm --filter @vendelier/database db:migrate
pnpm --filter @vendelier/database db:seed
pnpm dev
```

| Superficie | Paquete | URL local |
| --- | --- | --- |
| Website corporativo | `@vendelier/website` | [3000](http://localhost:3000) |
| Super Admin | `@vendelier/super-admin` | [3001](http://localhost:3001) |
| Vendelier Studio | `@vendelier/merchant` | [3002](http://localhost:3002) |
| Vendelier Store | `@vendelier/storefront` | [3003](http://localhost:3003) |
| API | `@vendelier/api` | [Salud en 4000](http://127.0.0.1:4000/health) · [Swagger](http://127.0.0.1:4000/docs) |

Levanta y configura PostgreSQL antes de ejecutar las migraciones. Puedes arrancar una sola interfaz con `pnpm --filter @vendelier/website dev`, sustituyendo el nombre del paquete según la tabla. `pnpm dev` prepara el cliente Prisma y levanta los cinco procesos. El endpoint de salud de la API también funciona con PostgreSQL desconectado.

## Recorrer la demostración

1. En [Website](http://localhost:3000), registra una cuenta con un correo de prueba y elige el nombre y el slug de tu tienda.
2. En [Studio](http://localhost:3002), agrega un producto con SKU, precio en MXN y existencias. Publica la tienda y abre su enlace público.
3. En Storefront, agrega unidades al carrito y completa la compra como invitado con datos ficticios. Puedes probar un rechazo antes de aprobar el pago. La confirmación muestra el número y total del pedido.
4. Vuelve a Studio, abre los pedidos y marca la compra como preparada. Comprueba que el inventario refleje la cantidad vendida.
5. En [Super Admin](http://localhost:3001), ingresa el valor local de `DEMO_ADMIN_TOKEN` para consultar tiendas, pedidos e ingresos de prueba agregados.

Cada compra aprobada se guarda en PostgreSQL y descuenta stock. El medio de pago es un simulador local. El formulario de compra usa datos de envío ficticios y no solicita información de tarjeta.

## Personalizar una empresa

En [Studio](http://localhost:3002), abre **Apariencia y marca** para personalizar Studio o Storefront. Cada área tiene su propio nombre, logo, banner y colores para los modos claro y oscuro. Guarda primero el borrador y publícalo cuando la vista previa esté lista.

Pega un enlace HTTPS directo a un PNG, JPEG o WebP para agregar una imagen de marca o una foto de producto. Durante las pruebas se guarda una copia en `.vendelier-local/media/`. La [guía de marca y medios](docs/architecture/branding-media.md) documenta el alcance y la configuración para S3 o MinIO.

## Verificación

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions también aplica las migraciones y ejecuta las pruebas de aislamiento y comercio con PostgreSQL. Para repetir la prueba HTTP, configura `API_FLOW_TEST=1` en tu terminal y ejecuta `pnpm --filter @vendelier/api test` con una base de demostración. La prueba crea dos tiendas ficticias por ejecución. Consulta [arquitectura y estado de la implementación](docs/architecture/foundations.md) para ver los límites actuales, las dependencias entre áreas y los hitos siguientes.
