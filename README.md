# Vendelier

Vendelier es una plataforma de comercio electrónico multiempresa para que negocios independientes publiquen y operen su propia tienda. El MVP apunta a México y usa pagos de prueba. El [plan maestro de implementación](resources/Vendelier_Plan_Maestro_Implementacion.pdf) describe el producto y la [decisión de arquitectura](docs/architecture/modular-monolith.md) recoge la adaptación de 2 aplicaciones (frontend + backend) al repositorio.

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
| Vendelier Web | [Inicio](http://127.0.0.1:3000/) |
| Vendelier Control | [Administración](http://127.0.0.1:3000/control) |
| Vendelier Studio | [Panel comercial](http://127.0.0.1:3000/studio) |
| Vendelier Store | [Entrada a tiendas](http://127.0.0.1:3000/tiendas) · `/tiendas/<slug>` |
| API (vía proxy Next.js o directo) | [Salud](http://127.0.0.1:3000/api/health) · [Swagger](http://127.0.0.1:3000/api/docs) · `http://127.0.0.1:4000/api` |

Levanta y configura PostgreSQL antes de ejecutar las migraciones. `pnpm dev` arranca dos procesos en paralelo: el frontend Next.js (`@vendelier/app`, puerto `3000`) y el backend NestJS (`@vendelier/api`, puerto `4000`). Next.js expone un proxy dinámico en `/api/[...path]` hacia `API_INTERNAL_URL` (por defecto `http://127.0.0.1:4000`) para que las interfaces, la cookie de sesión y los medios compartan el mismo origen en el navegador. El endpoint `/api/health` también responde con PostgreSQL desconectado.

Para ejecutar la compilación de producción usa `pnpm build` seguido de `pnpm start`. Consulta la [arquitectura de frontend y backend](docs/architecture/modular-monolith.md) para configurar hosts, puertos y proxies HTTPS.

## Cuentas y tiendas de demostración

`pnpm --filter @vendelier/database db:seed` crea tres tiendas publicadas con catálogo, variantes, temas y pedidos iniciales:

| Tienda | Slug | Correo propietario | Contraseña |
| --- | --- | --- | --- |
| Urban Kicks | `urban-kicks` | `owner@urbankicks.mx` | `VendelierDemo2026!` |
| Casa Studio | `casa-studio` | `owner@casastudio.mx` | `VendelierDemo2026!` |
| Bloom | `bloom` | `owner@bloom.mx` | `VendelierDemo2026!` |

## Recorrer la demostración

1. En [Website](http://127.0.0.1:3000), inicia sesión con una cuenta demo o registra una cuenta nueva eligiendo el nombre y el slug de tu tienda.
2. En [Studio](http://127.0.0.1:3000/studio), agrega o edita productos con SKU, precio en MXN, existencias y **variantes** opcionales (ej. Talla, Color, Tamaño), o elimina productos sin pedidos. Publica la tienda y abre su enlace público.
3. En Storefront, selecciona una variante, agrega unidades al carrito (persistente en `localStorage` por tienda) y completa la compra como invitado con datos ficticios. Puedes probar un rechazo antes de aprobar el pago. La confirmación muestra el número y total del pedido.
4. Vuelve a Studio, abre los pedidos (con correo y dirección del cliente) y marca la compra como preparada. Comprueba que el inventario de la variante y del producto refleje la cantidad vendida.
5. En [Control](http://127.0.0.1:3000/control), ingresa el valor local de `DEMO_ADMIN_TOKEN` para consultar tiendas, métricas agregadas, **suspender o reactivar** tiendas y revisar la **bitácora de auditoría**.

Cada compra aprobada se guarda en PostgreSQL y descuenta stock por variante y total. El medio de pago es un simulador local. El formulario de compra usa datos de envío ficticios y no solicita información de tarjeta.

## Personalizar una empresa

En [Studio](http://127.0.0.1:3000/studio#apariencia), abre **Apariencia y marca** para personalizar Studio o Storefront. Cada área tiene su propio nombre, logo, banner y colores para los modos claro y oscuro. Guarda primero el borrador y publícalo cuando la vista previa esté lista.

Pega un enlace HTTPS directo a un PNG, JPEG o WebP para agregar una imagen de marca o una foto de producto. Durante las pruebas se guarda una copia en `.vendelier-local/media/`. La [guía de marca y medios](docs/architecture/branding-media.md) documenta el alcance y la configuración para S3 o MinIO.

## Verificación

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:integration
```

GitHub Actions también aplica las migraciones y ejecuta las pruebas de aislamiento, comercio y vista previa Liquid con PostgreSQL. Para repetir las pruebas HTTP con una base de demostración, configura `API_FLOW_TEST=1` en tu terminal y ejecuta `pnpm --filter @vendelier/api test` después de compilar. Las pruebas crean tiendas ficticias. Consulta [arquitectura y estado de la implementación](docs/architecture/foundations.md) para ver los límites actuales y los siguientes hitos.
