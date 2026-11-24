"use client";

import { api, errorMessage, errorStatus, studioMediaUrl, storeUrl, websiteLoginUrl, websiteUrl, type AppearanceTheme, type Order, type Product, type ProductInput, type StudioOverview } from "@vendelier/api-client";
import { actionClass, appearanceStyle, DashboardShell, formatDate, formatMoney, MediaImage, Notice, panelClass, secondaryClass } from "@vendelier/ui";
import { ArrowUpRight, Copy, Package, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { AppearanceEditor } from "./appearance-editor";
import { ProductEditor } from "./product-editor";

export function Studio() {
  const [overview, setOverview] = useState<StudioOverview>();
  const [loading, setLoading] = useState(true);
  const [sessionRequired, setSessionRequired] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [catalogNotice, setCatalogNotice] = useState("");
  const [editing, setEditing] = useState<Product>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api.studio(controller.signal).then((data) => {
      setOverview(data);
      setLoading(false);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setSessionRequired(errorStatus(cause) === 401);
      setError(errorMessage(cause, "No pudimos cargar Studio.", {
        401: "Inicia sesión para usar Studio.",
        403: "Tu cuenta no tiene acceso a esta tienda.",
      }));
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  async function refresh() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setOverview(await api.studio());
      setSessionRequired(false);
      setNotice("Datos de la tienda actualizados.");
    } catch (cause) {
      reportError(cause, "No pudimos actualizar la tienda.");
    } finally {
      setBusy(false);
    }
  }

  function reportError(cause: unknown, fallback: string) {
    setError(errorMessage(cause, fallback, {
      401: "Tu sesión terminó. Inicia sesión de nuevo para continuar.",
      404: "El registro ya no está disponible. Actualiza tus datos.",
      409: "El estado cambió. Actualiza tus datos antes de intentarlo de nuevo.",
    }));
    if (errorStatus(cause) === 401) setSessionRequired(true);
  }

  async function run(action: () => Promise<void>, fallback: string, success?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (success) setNotice(success);
    } catch (cause) {
      reportError(cause, fallback);
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct(values: ProductInput) {
    setBusy(true);
    setCatalogNotice("");
    try {
      const saved = editing ? await saveChanges(editing, values) : await api.createProduct(values);
      if (saved) {
        setOverview((current) => current && ({
          ...current,
          products: editing
            ? current.products.map((product) => product.id === saved.id ? saved : product)
            : [...current.products, saved],
        }));
      }
      setCatalogNotice(!saved ? "No hay cambios que guardar." : editing ? "Cambios guardados." : "Producto agregado al catálogo.");
      setEditing(undefined);
    } catch (cause) {
      if (errorStatus(cause) === 401) reportError(cause, "No pudimos guardar los cambios.");
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  function publish() {
    return run(async () => {
      const tenant = await api.publish();
      setOverview((current) => current && ({ ...current, tenant }));
    }, "No pudimos publicar la tienda.", "Tu tienda ya está publicada.");
  }

  function fulfill(order: Order) {
    return run(async () => {
      const prepared = await api.fulfill(order.id);
      setOverview((current) => current && ({
        ...current,
        orders: current.orders.map((entry) => entry.id === prepared.id ? prepared : entry),
      }));
    }, "No pudimos marcar el pedido como preparado.", `Pedido ${order.number} preparado.`);
  }

  function signOut() {
    return run(async () => {
      await api.logout();
      window.location.assign(websiteUrl);
    }, "No pudimos cerrar la sesión.");
  }

  function applyStudioTheme(theme: AppearanceTheme | null) {
    setOverview((current) => current && ({ ...current, theme }));
  }

  const theme = sessionRequired ? null : overview?.theme;
  const publicUrl = overview?.tenant.published ? storeUrl(overview.tenant.slug) : undefined;
  const navigation = overview && !sessionRequired && (
    <nav aria-label="Secciones de Studio" className="flex flex-wrap gap-2 lg:mt-6 lg:grid lg:w-full">
      <a className={secondaryClass} href="#catalogo">Catálogo</a>
      <a className={secondaryClass} href="#pedidos">Pedidos</a>
      <a className={secondaryClass} href="#apariencia">Apariencia y marca</a>
      <button type="button" className={secondaryClass} disabled={busy} onClick={signOut}>Cerrar sesión</button>
    </nav>
  );

  return (
    <DashboardShell
      brand={theme?.logoId
        ? <MediaImage src={studioMediaUrl(theme.logoId)} alt="" className="h-12 w-28" sizes="112px" fit="contain" />
        : <Store aria-hidden="true" size={24} />}
      surface="Vendelier Studio"
      heading={overview && !sessionRequired ? theme?.displayName ?? overview.tenant.name : "Gestiona tu tienda"}
      theme={theme ? appearanceStyle(theme) : undefined}
      banner={theme?.bannerId && <MediaImage src={studioMediaUrl(theme.bannerId)} alt="" className="mb-6 aspect-[3/1] w-full rounded-panel sm:aspect-[4/1]" sizes="(max-width: 1024px) 90vw, 960px" />}
      navigation={navigation}
    >
      {loading && <p role="status">Cargando Studio…</p>}
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
      {sessionRequired && <a className={actionClass} href={websiteLoginUrl()}>Ir a inicio de sesión</a>}
      {!loading && !overview && !sessionRequired && (
        <button type="button" className={secondaryClass} disabled={busy} onClick={refresh}>Volver a intentar</button>
      )}
      {overview && !sessionRequired && (
        <div className="grid gap-8">
          <section className={panelClass} aria-labelledby="publication-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="publication-title" className="text-xl font-extrabold">Publicación</h2>
                <p className="mt-1 text-sm text-muted">
                  {overview.tenant.published ? "Tu catálogo está disponible para compradores." : "La tienda es privada hasta que la publiques."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryClass} disabled={busy} onClick={refresh}>Actualizar datos</button>
                {!publicUrl && <button type="button" className={actionClass} disabled={busy} onClick={publish}>Publicar tienda</button>}
              </div>
            </div>
            {publicUrl && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a className={actionClass} href={publicUrl} target="_blank" rel="noreferrer">
                  Abrir tienda <ArrowUpRight size={16} aria-hidden="true" />
                </a>
                <button type="button" className={secondaryClass} disabled={busy} onClick={() => run(
                  () => navigator.clipboard.writeText(publicUrl),
                  "Selecciona el enlace de la tienda para copiarlo.",
                  "Enlace copiado.",
                )}>
                  <Copy size={16} aria-hidden="true" /> Copiar enlace
                </button>
                <a className="min-w-0 break-all text-sm font-semibold underline underline-offset-4" href={publicUrl}>{publicUrl}</a>
              </div>
            )}
          </section>

          <section id="catalogo" aria-labelledby="catalog-title" className="scroll-mt-4">
            <h2 id="catalog-title" className="mb-4 text-2xl font-extrabold">Catálogo e inventario</h2>
            {catalogNotice && <div className="mb-4"><Notice kind="success">{catalogNotice}</Notice></div>}
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
              <div className={panelClass}>
                <h3 className="text-lg font-extrabold">Productos ({overview.products.length})</h3>
                {overview.products.length === 0 ? (
                  <p className="mt-4 text-muted">Agrega tu primer producto para preparar el catálogo.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border">
                    {overview.products.map((product) => (
                      <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                        {product.imageId && <MediaImage src={studioMediaUrl(product.imageId)} alt="" className="size-12 rounded-lg bg-background" sizes="48px" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold break-words">{product.name}</p>
                          <p className="text-sm text-muted break-words">{product.sku} · {formatMoney(product.priceCents)}</p>
                        </div>
                        <p className="inline-flex items-center gap-1 text-sm font-semibold">
                          <Package size={15} aria-hidden="true" /> {product.stock} {product.stock === 1 ? "unidad" : "unidades"}
                        </p>
                        <button
                          type="button"
                          className={secondaryClass}
                          disabled={busy}
                          aria-label={`Editar ${product.name}`}
                          onClick={() => {
                            setCatalogNotice("");
                            setEditing(product);
                            document.getElementById("editar-producto")?.scrollIntoView({ block: "nearest" });
                          }}
                        >
                          Editar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <ProductEditor
                key={editing?.id ?? "new"}
                product={editing}
                disabled={busy}
                onSave={saveProduct}
                onCancel={() => setEditing(undefined)}
              />
            </div>
          </section>

          <section id="pedidos" aria-labelledby="orders-title" className="scroll-mt-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="orders-title" className="text-2xl font-extrabold">Pedidos ({overview.orders.length})</h2>
              <button type="button" className={secondaryClass} disabled={busy} onClick={refresh}>Actualizar pedidos</button>
            </div>
            {overview.orders.length === 0 ? (
              <p className={`${panelClass} text-muted`}>Los pedidos de prueba aparecerán aquí después de una compra aprobada.</p>
            ) : (
              <ul className="grid gap-3">
                {overview.orders.map((order) => (
                  <li key={order.id} className={panelClass}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-bold">Pedido {order.number}</p>
                        <p className="mt-1 text-sm text-muted">{order.customerName} · {formatDate(order.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-bold">{formatMoney(order.totalCents)}</span>
                        {order.status === "fulfilled" ? (
                          <span className="rounded-lg bg-success/10 px-3 py-2 text-sm font-bold text-success">Preparado</span>
                        ) : (
                          <button type="button" className={actionClass} disabled={busy} onClick={() => fulfill(order)}>Marcar como preparado</button>
                        )}
                      </div>
                    </div>
                    <details className="mt-4 border-t border-border pt-3 text-sm">
                      <summary className="cursor-pointer font-bold">Ver artículos</summary>
                      <ul className="mt-2 grid gap-1 text-muted">
                        {order.items.map((item) => <li key={item.sku}>{item.quantity} × {item.name} · {formatMoney(item.priceCents)} c/u</li>)}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <AppearanceEditor key={overview.tenant.slug} studioName={overview.tenant.name} onPublishStudio={applyStudioTheme} />
        </div>
      )}
    </DashboardShell>
  );
}

async function saveChanges(product: Product, values: ProductInput): Promise<Product | undefined> {
  const changes = {
    name: product.name === values.name ? undefined : values.name,
    sku: product.sku === values.sku ? undefined : values.sku,
    description: product.description === values.description ? undefined : values.description,
    priceCents: product.priceCents === values.priceCents ? undefined : values.priceCents,
    stock: product.stock === values.stock ? undefined : values.stock,
    imageId: product.imageId === values.imageId ? undefined : values.imageId,
  };

  if (Object.values(changes).every((value) => value === undefined)) return;
  return api.updateProduct(product.id, changes);
}
