"use client";

import { api, errorMessage, errorStatus, studioMediaUrl, storeUrl, websiteLoginUrl, websiteUrl, type AppearanceTheme, type Order, type Product, type ProductInput, type StudioOverview } from "@vendelier/api-client";
import { actionClass, appearanceStyle, DashboardShell, dashboardLinkClass, fieldClass, formatDate, formatMoney, MediaImage, Notice, panelClass, quietClass, secondaryClass } from "@vendelier/ui";
import { VendelierWordmark } from "@vendelier/ui/brand";
import { ArrowUpRight, Copy, LayoutDashboard, LogOut, Package, Palette, Receipt, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppearanceEditor } from "./appearance-editor";
import { OverviewPanel } from "./overview-panel";
import { ProductEditor } from "./product-editor";


const sectionLinks = [
  { id: "resumen", label: "Resumen", Icon: LayoutDashboard },
  { id: "catalogo", label: "Catálogo e inventario", Icon: Package },
  { id: "pedidos", label: "Pedidos", Icon: Receipt },
  { id: "apariencia", label: "Apariencia y marca", Icon: Palette },
] as const;

function currentSection() {
  return sectionLinks.find(({ id }) => "#" + id === window.location.hash)?.id ?? "resumen";
}

function subscribeSection(listener: () => void) {
  function onHashChange() {
    listener();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  window.addEventListener("hashchange", onHashChange);
  return () => window.removeEventListener("hashchange", onHashChange);
}

const initialSection = () => "resumen" as const;

export function Studio() {
  const router = useRouter();
  const section = useSyncExternalStore(subscribeSection, currentSection, initialSection);
  const [productQuery, setProductQuery] = useState("");
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
      router.replace(websiteUrl);
    }, "No pudimos cerrar la sesión.");
  }

  function applyStudioTheme(theme: AppearanceTheme | null) {
    setOverview((current) => current && ({ ...current, theme }));
  }

  const theme = sessionRequired ? null : overview?.theme;

  const publicUrl = overview?.tenant.published ? storeUrl(overview.tenant.slug) : undefined;
  const tenantName = theme?.displayName ?? overview?.tenant.name;
  const signedIn = Boolean(overview && !sessionRequired);
  const sectionTitle = sectionLinks.find((item) => item.id === section)?.label ?? "Resumen";
  const query = productQuery.trim().toLocaleLowerCase("es-MX");
  const visibleProducts = overview?.products.filter((product) =>
    [product.name, product.sku].some((value) => value.toLocaleLowerCase("es-MX").includes(query)),
  ) ?? [];
  const navigation = signedIn && (
    <nav aria-label="Secciones de Studio" className="flex min-w-0 gap-1 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
      {sectionLinks.map(({ id, label, Icon }) => (
        <a key={id} href={"#" + id} aria-current={section === id ? "page" : undefined} className={dashboardLinkClass + " max-lg:w-auto"}>
          <Icon size={17} aria-hidden="true" strokeWidth={1.7} /> {label}
        </a>
      ))}
      <button type="button" className={dashboardLinkClass + " max-lg:w-auto lg:mt-5"} disabled={busy} onClick={signOut}>
        <LogOut size={16} aria-hidden="true" strokeWidth={1.7} /> Cerrar sesión
      </button>
    </nav>
  );
  const workspace = signedIn && overview && (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg bg-white/7 p-2.5">
      {overview.theme?.logoId ? (
        <MediaImage src={studioMediaUrl(overview.theme.logoId)} alt="" className="size-9 rounded-md bg-white/10" sizes="36px" fit="contain" />
      ) : (
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-sm font-semibold text-on-accent">
          {overview.tenant.name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold" title={overview.tenant.name}>{overview.tenant.name}</p>
        <p className="truncate text-[0.6875rem] text-zinc-400">{overview.tenant.slug}</p>
      </div>
    </div>
  );
  const actions = signedIn && overview && (
    <>
      <span className={"hidden items-center gap-1.5 pr-1 text-xs font-medium sm:inline-flex " + (overview.tenant.published ? "text-success" : "text-muted")}>
        <span aria-hidden="true" className={"size-1.5 rounded-full " + (overview.tenant.published ? "bg-success" : "bg-muted")} />
        {overview.tenant.published ? "Tienda publicada" : "Tienda privada"}
      </span>
      {section === "resumen" && (
        <>
          <button type="button" className={quietClass} title="Actualizar datos" aria-label="Actualizar datos" disabled={busy} onClick={refresh}>
            <RefreshCw size={16} aria-hidden="true" />
          </button>
          {publicUrl && (
            <button type="button" className={quietClass} title="Copiar enlace" aria-label="Copiar enlace" disabled={busy} onClick={() => run(
              () => navigator.clipboard.writeText(new URL(publicUrl, window.location.origin).href),
              "No se pudo copiar el enlace. Puedes usar Abrir tienda.",
              "Enlace copiado.",
            )}>
              <Copy size={16} aria-hidden="true" />
            </button>
          )}
        </>
      )}
      {publicUrl ? (
        <a className={secondaryClass} href={publicUrl} target="_blank" rel="noreferrer">
          Abrir tienda <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      ) : (
        <button type="button" className={actionClass} disabled={busy} onClick={publish}>Publicar tienda</button>
      )}
    </>
  );

  return (
    <DashboardShell
      brand={<VendelierWordmark tone="dark" width={132} />}
      surface="Merchant Studio"
      heading={signedIn ? section === "resumen" ? tenantName ?? "Resumen" : sectionTitle : "Gestiona tu tienda"}
      section={signedIn ? sectionTitle : undefined}
      navigation={navigation}
      workspace={workspace}
      actions={actions}
      theme={theme ? appearanceStyle(theme) : undefined}
    >
      {loading && <p role="status" className={panelClass}>Cargando Studio…</p>}
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
      {sessionRequired && <Link className={actionClass} href={websiteLoginUrl()}>Ir a inicio de sesión</Link>}
      {!loading && !overview && !sessionRequired && (
        <button type="button" className={secondaryClass} disabled={busy} onClick={refresh}>Volver a intentar</button>
      )}
      {overview && signedIn && (
        <>
          <div id="resumen" hidden={section !== "resumen"}>
            {overview.theme?.bannerId && <MediaImage src={studioMediaUrl(overview.theme.bannerId)} alt="" className="mb-5 h-18 w-full rounded-panel sm:h-24" sizes="(max-width: 1024px) 95vw, 1200px" />}
            <OverviewPanel overview={overview} />
          </div>

          <div id="catalogo" hidden={section !== "catalogo"}>
            {catalogNotice && <div className="mb-4"><Notice kind="success">{catalogNotice}</Notice></div>}
            <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,0.6fr)]">
              <section className={panelClass} aria-labelledby="products-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="products-title" className="text-lg font-semibold tracking-tight">Productos ({overview.products.length})</h2>
                  <input type="search" aria-label="Buscar en el inventario" className={fieldClass + " sm:max-w-56"} placeholder="Buscar por nombre o SKU" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} />
                </div>
                {visibleProducts.length === 0 ? (
                  <p className="mt-5 border-t border-border pt-4 text-sm text-muted">{query ? "No encontramos productos para esa búsqueda." : "Agrega tu primer producto para preparar el catálogo."}</p>
                ) : (
                  <table className="mt-4 w-full table-fixed border-collapse text-left text-sm sm:table-auto">
                    <thead className="border-y border-border text-xs text-muted">
                      <tr>
                        <th scope="col" className="py-2.5 font-medium">Producto</th>
                        <th scope="col" className="hidden px-2 py-2.5 font-medium sm:table-cell">Precio</th>
                        <th scope="col" className="w-14 px-1 py-2.5 text-right font-medium sm:w-auto sm:px-2">Stock</th>
                        <th scope="col" className="w-16 py-2.5"><span className="sr-only">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visibleProducts.map((product) => (
                        <tr key={product.id}>
                          <td className="py-3 pr-1">
                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                              {product.imageId ? (
                                <MediaImage src={studioMediaUrl(product.imageId)} alt="" className="size-9 rounded-md bg-inset sm:size-10" sizes="40px" />
                              ) : <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-md bg-inset text-muted sm:size-10"><Package size={16} /></span>}
                              <div className="min-w-0">
                                <p className="wrap-break-word font-semibold">{product.name}</p>
                                <p className="mt-0.5 wrap-break-word text-xs text-muted">{product.sku}</p>
                                <p className="mt-0.5 text-xs tabular-nums sm:hidden">{formatMoney(product.priceCents)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="hidden whitespace-nowrap px-2 py-3 font-medium tabular-nums sm:table-cell">{formatMoney(product.priceCents)}</td>
                          <td className={"px-1 py-3 text-right text-xs font-medium tabular-nums sm:px-2 " + (product.stock === 0 ? "text-danger" : "")} aria-label={`${product.stock} unidades`}>{product.stock}</td>
                          <td className="py-3 text-right">
                            <button
                              type="button" className={quietClass} disabled={busy} aria-label={"Editar " + product.name}
                              onClick={() => {
                                setCatalogNotice("");
                                setEditing(product);
                                document.getElementById("editar-producto")?.scrollIntoView({ block: "nearest" });
                              }}
                            >Editar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
              <ProductEditor key={editing?.id ?? "new"} product={editing} disabled={busy} onSave={saveProduct} onCancel={() => setEditing(undefined)} />
            </div>
          </div>

          <div id="pedidos" hidden={section !== "pedidos"}>
            <section className={panelClass} aria-label="Pedidos de la tienda">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight">Pedidos ({overview.orders.length})</h2>
                <button type="button" className={quietClass} disabled={busy} onClick={refresh}>
                  <RefreshCw size={15} aria-hidden="true" /> Actualizar pedidos
                </button>
              </div>
              {overview.orders.length === 0 ? (
                <p className="border-t border-border pt-4 text-sm text-muted">Los pedidos de prueba aparecerán aquí después de una compra aprobada.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {overview.orders.map((order) => (
                    <li key={order.id} className="py-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-semibold">Pedido {order.number}</p>
                          <p className="mt-1 break-words text-sm text-muted">{order.customerName} · {formatDate(order.createdAt)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-semibold tabular-nums">{formatMoney(order.totalCents)}</span>
                          {order.status === "fulfilled" ? (
                            <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Preparado</span>
                          ) : (
                            <button type="button" className={actionClass} disabled={busy} onClick={() => fulfill(order)}>Marcar como preparado</button>
                          )}
                        </div>
                      </div>
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer font-semibold">Ver artículos</summary>
                        <ul className="mt-2 grid gap-1 rounded-lg bg-inset p-3 text-muted">
                          {order.items.map((item) => <li key={item.sku}>{item.quantity} × {item.name} · {formatMoney(item.priceCents)} c/u</li>)}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div id="apariencia" hidden={section !== "apariencia"}>
            <AppearanceEditor key={overview.tenant.slug} studioName={overview.tenant.name} publicUrl={publicUrl} products={overview.products} onPublishStudio={applyStudioTheme} />
          </div>
        </>
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
