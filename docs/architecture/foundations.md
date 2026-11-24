# Fundaciones y estado de Vendelier

El [plan de implementación original](../../resources/Vendelier_Plan_Maestro_Implementacion.pdf) define las superficies y los hitos. La [decisión de arquitectura](modular-monolith.md) documenta cómo se consolidaron las superficies y la API según el plan maestro adaptativo.

## Responsabilidades

| Frente | Rutas principales | Entrega inicial |
| --- | --- | --- |
| Frontend | `apps/vendelier/app`, `packages/ui`, `packages/theme`, `packages/api-client` | Aplicación Next.js con Web, Control, Studio y Store, cliente HTTP de origen compartido y experiencia de compra y operación. |
| Backend | `apps/vendelier/server.mjs`, `apps/api` | Servidor Node.js que integra Next.js y NestJS. API modular de cuentas, Studio, catálogo público, checkout simulado y métricas de plataforma. |
| Base de datos | `packages/database`, `infrastructure/docker/postgres` | PostgreSQL, Prisma, migraciones de identidad y comercio, datos de prueba y políticas de aislamiento. |
| Motor de temas | `packages/theme-engine`, `themes/atelier` | Render HTML de prueba con LiquidJS para el catálogo y el borrador de Atelier. |
| Documentación e integración | `README.md`, `docs/`, configuración raíz y `.github/workflows` | Inicio local, estado, decisiones compartidas y verificación en CI. |

En cada cambio de contrato, migración o flujo, actualiza la guía correspondiente con el comando de verificación. Los cambios de cada frente se revisan en PRs pequeños. Los cambios compartidos pueden incluir el lockfile y los contratos que consumen otros paquetes.

## Límites y contratos existentes

- Las cuatro superficies web comparten la aplicación Next.js, la tipografía local Space Grotesk, controles y tokens semánticos de la referencia de Stitch. Web y Control usan el kit de marca corporativa. Studio y Store mantienen ámbitos de tema independientes para claro y oscuro. Los colores publicados por empresa se aplican sobre los componentes compartidos.
- Studio organiza Resumen, Catálogo e inventario, Pedidos y Apariencia y marca en una barra lateral. El resumen calcula ventas, preparación de pedidos y existencias desde los datos de la empresa.
- `GET /api/health` responde `200` con `{"status":"ok"}` cuando el proceso HTTP está activo. El OpenAPI está disponible como JSON en `/api/docs-json` y en la interfaz `/api/docs`.
- `/api/auth` crea una cuenta de propietario y su tienda, y emite una sesión en cookie HTTP-only. `/api/studio` opera sobre la tienda que la API resuelve a partir de esa sesión. El catálogo público se resuelve con el slug de una tienda publicada.
- El checkout simulado toma precios y existencias de PostgreSQL. Una compra aprobada guarda el pedido, sus líneas y el descuento de inventario en una transacción. La clave de checkout evita repetir el descuento al reintentar. El pedido conserva el nombre, SKU y precio que vio el comprador.
- `/api/platform/overview` usa una clave de demostración independiente y expone tiendas y métricas agregadas. PostgreSQL separa las identidades de migración y ejecución y aplica RLS a los datos empresariales. Consulta la [guía local de la base](../database/local.md).
- Studio y Storefront resuelven su marca publicada de forma independiente. El [editor de marca y almacenamiento de imágenes](branding-media.md) guarda borradores y archivos por empresa y valida las referencias de medios para el catálogo y la tienda pública.

## Hitos del MVP

| Hito | Evidencia de salida |
| --- | --- |
| H1. Diseño | Prototipos de Studio y Atelier en los tamaños clave, sistema de diseño aprobado y flujos documentados. |
| H2. Aislamiento | Resolución de tenant, membresías, permisos y pruebas de acceso cruzado desde la API, incluyendo las consultas a PostgreSQL. |
| H3. Catálogo | Un comercio publica productos con variantes y stock y estos aparecen en su propia tienda. |
| H4. Compra sandbox | El servidor valida totales, reserva inventario y confirma el pedido a través de un webhook verificado e idempotente. |
| H5. Demo | Tres tiendas con identidad y catálogo propios, entorno reproducible, documentación de operación y pruebas E2E. |

La demostración cubre alta de un propietario, catálogo de SKU simple, existencias, tienda pública, compra como invitado, preparación del pedido y marca por empresa. Las variantes, las invitaciones y el pago mediante proveedor y webhook siguen en el alcance del MVP. La composición final de Studio y Atelier sigue pendiente de validación de diseño.
