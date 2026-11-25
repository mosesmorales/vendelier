# Fundaciones y estado de Vendelier

El [plan de implementación original](../../resources/Vendelier_Plan_Maestro_Implementacion.pdf) define las superficies y los hitos. La [decisión de arquitectura](modular-monolith.md) documenta la separación en dos aplicaciones independientes (frontend Next.js y backend NestJS) alineada con el plan maestro adaptativo.

## Responsabilidades

| Frente | Rutas principales | Entrega actual |
| --- | --- | --- |
| Frontend | `apps/vendelier/app`, `packages/ui`, `packages/theme`, `packages/api-client` | Aplicación Next.js 16 con Web, Control, Studio y Store, proxy dinámico `/api/[...path]`, cliente HTTP tipado, variantes y carrito persistente en `localStorage`. |
| Backend | `apps/api/src` | Aplicación NestJS standalone bajo `/api`. API modular de cuentas, Studio (productos con variantes, eliminación, pedidos), catálogo público, checkout idempotente por variante y control de plataforma con auditoría. |
| Base de datos | `packages/database`, `infrastructure/docker/postgres` | PostgreSQL 17, Prisma 7, 4 migraciones (identidad, comercio, branding/medios, variantes/auditoría), seeds completos con 3 tiendas y políticas RLS. |
| Motor de temas | `packages/theme-engine`, `themes/atelier` | Render HTML de prueba con LiquidJS para el catálogo y el borrador de Atelier. |
| Documentación e integración | `README.md`, `docs/`, `tests/integration.test.mjs`, `.github/workflows` | Inicio local, estado, decisiones compartidas, prueba de integración 2-app y verificación en CI. |

En cada cambio de contrato, migración o flujo, actualiza la guía correspondiente con el comando de verificación. Los cambios de cada frente se revisan en PRs pequeños. Los cambios compartidos pueden incluir el lockfile y los contratos que consumen otros paquetes.

## Límites y contratos existentes

- Las cuatro superficies web comparten la aplicación Next.js (`@vendelier/app`), la tipografía local Space Grotesk, controles y tokens semánticos. Web y Control usan el kit de marca corporativa. Studio y Store mantienen ámbitos de tema independientes para claro y oscuro. Los colores publicados por empresa se aplican sobre los componentes compartidos.
- Studio organiza Resumen, Catálogo e inventario (con opciones, variantes y eliminación de productos sin pedidos), Pedidos (con correo y dirección del comprador) y Apariencia y marca en una barra lateral. El resumen calcula ventas, preparación de pedidos y existencias desde los datos de la empresa.
- `GET /api/health` responde `200` con `{"status":"ok"}` cuando el proceso de la API está activo. El OpenAPI está disponible como JSON en `/api/docs-json` y en la interfaz `/api/docs`.
- `/api/auth` crea una cuenta de propietario y su tienda, y emite una sesión en cookie HTTP-only. `/api/studio` opera sobre la tienda que la API resuelve a partir de esa sesión. El catálogo público se resuelve con el slug de una tienda publicada y activa.
- El checkout simulado toma precios y existencias de PostgreSQL por producto o variante (`product_variants`). Una compra aprobada guarda el pedido, sus líneas (con `variantId` y `variantTitle`) y el descuento atómico de inventario en una transacción. La clave de checkout evita repetir el descuento al reintentar. El storefront persiste el carrito en `localStorage` por slug de tienda.
- `/api/platform/overview` y `PATCH /api/platform/tenants/:slug/status` usan una clave de demostración independiente (`DEMO_ADMIN_TOKEN`), permiten listar tiendas, suspender/reactivar empresas y registrar eventos en `platform_audit_logs`. PostgreSQL separa las identidades de migración y ejecución y aplica RLS a los datos empresariales. Consulta la [guía local de la base](../database/local.md).
- Studio y Storefront resuelven su marca publicada de forma independiente. El [editor de marca y almacenamiento de imágenes](branding-media.md) guarda borradores y archivos por empresa y valida las referencias de medios para el catálogo y la tienda pública.

## Hitos del MVP

| Hito | Evidencia de salida |
| --- | --- |
| H1. Diseño | Prototipos de Studio y Atelier en los tamaños clave, sistema de diseño aprobado y flujos documentados. |
| H2. Aislamiento | Resolución de tenant, membresías, permisos y pruebas de acceso cruzado desde la API, incluyendo las consultas a PostgreSQL. |
| H3. Catálogo | Un comercio publica productos con variantes y stock y estos aparecen en su propia tienda. |
| H4. Compra sandbox | El servidor valida totales, reserva inventario y confirma el pedido a través de un webhook verificado e idempotente. |
| H5. Demo | Tres tiendas con identidad y catálogo propios, entorno reproducible, documentación de operación y pruebas E2E. |

La demostración cubre alta de un propietario, 3 tiendas seeded con cuentas/productos/variantes/pedidos, catálogo con opciones y variantes, eliminación de productos sin pedidos, tienda pública con carrito persistente, compra como invitado, preparación del pedido, marca por empresa y suspensión/auditoría en Control. Las invitaciones de equipo/RBAC, las secciones JSON del Theme Engine y el pago mediante proveedor externo y webhook siguen pendientes en el alcance del MVP.
