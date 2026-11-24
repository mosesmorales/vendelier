"use client";

import { api, errorMessage, storeMediaUrl, type Order, type Product, type Store } from "@vendelier/api-client";
import { actionClass, appearanceStyle, fieldClass, Field, formatMoney, MediaImage, Notice, panelClass, secondaryClass, SkipLink } from "@vendelier/ui";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutForm } from "./checkout-form";

const maxDistinctProducts = 50;
const maxQuantityPerProduct = 100;

function maxOrderQuantity(stock: number) {
  return Math.min(stock, maxQuantityPerProduct);
}

export function Storefront({ slug }: { slug: string }) {
  const [store, setStore] = useState<Store>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<Order>();

  useEffect(() => {
    const controller = new AbortController();
    api.store(slug, controller.signal).then((data) => {
      setStore(data);
      setLoading(false);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setError(storeError(cause));
      setLoading(false);
    });
    return () => controller.abort();
  }, [slug]);

  const products = store?.products ?? [];
  const filter = query.trim().toLocaleLowerCase("es-MX");
  const visibleProducts = filter
    ? products.filter((product) => `${product.name} ${product.sku} ${product.description}`.toLocaleLowerCase("es-MX").includes(filter))
    : products;
  const cart = products.flatMap((product) => {
    const quantity = quantities[product.id];
    return quantity ? [{ product, quantity }] : [];
  });
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);
  const total = cart.reduce((cents, item) => cents + item.product.priceCents * item.quantity, 0);

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      const updated = await api.store(slug);
      setStore(updated);
      setQuantities((current) => Object.fromEntries(
        updated.products
          .map(({ id, stock }) => [id, Math.min(current[id] ?? 0, maxOrderQuantity(stock))] as const)
          .filter(([, quantity]) => quantity > 0),
      ));
    } catch (cause) {
      setError(storeError(cause));
    } finally {
      setRefreshing(false);
    }
  }

  function updateQuantity(product: Product, quantity: number) {
    setQuantities((current) => ({ ...current, [product.id]: Math.max(0, Math.min(quantity, maxOrderQuantity(product.stock))) }));
  }

  function confirm(purchase: Order) {
    setOrder(purchase);
    setQuantities({});
    void refresh();
  }

  const theme = store?.theme;

  return (
    <div data-tenant-theme={theme ? "" : undefined} style={theme ? appearanceStyle(theme) : undefined} className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-2 sm:px-10">
          <Link href="/" aria-label="Visitar otra tienda" className="min-h-11 content-center rounded-lg font-extrabold tracking-tight">
            {theme?.logoId
              ? <MediaImage src={storeMediaUrl(slug, theme.logoId)} alt="" className="h-11 w-28" sizes="112px" fit="contain" />
              : "Atelier"}
          </Link>
          {store && (
            <a className={secondaryClass} href="#carrito">
              <ShoppingBag aria-hidden="true" size={17} /> <span aria-live="polite">Carrito ({cartCount})</span>
            </a>
          )}
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-8 sm:px-10 sm:py-12">
        {theme?.bannerId && <MediaImage src={storeMediaUrl(slug, theme.bannerId)} alt="" className="mb-6 aspect-[3/1] w-full rounded-panel sm:aspect-[4/1]" sizes="(max-width: 640px) 90vw, 1120px" />}
        <h1 className="break-words text-4xl font-extrabold tracking-tight sm:text-5xl">{theme?.displayName ?? store?.tenant.name ?? "Catálogo de la tienda"}</h1>
        {loading && <p role="status" className="mt-4">Cargando catálogo…</p>}
        {error && (
          <div className="mt-4 grid justify-items-start gap-3">
            <Notice kind="error">{error}</Notice>
            <button type="button" className={secondaryClass} disabled={refreshing} onClick={refresh}>Volver a consultar</button>
          </div>
        )}
        {store && (
          <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.52fr)]">
            <section aria-labelledby="catalogue-title">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <h2 id="catalogue-title" className="text-2xl font-extrabold">Catálogo</h2>
                <button type="button" className={secondaryClass} disabled={refreshing || paymentPending} onClick={refresh}>Actualizar catálogo</button>
              </div>
              {products.length > 0 && (
                <div className="mb-4">
                  <Field label="Buscar productos">
                    <input className={fieldClass} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
                  </Field>
                </div>
              )}
              {visibleProducts.length === 0 ? (
                <p className={`${panelClass} text-muted`}>
                  {products.length === 0 ? "La tienda aún no tiene productos en su catálogo." : "No encontramos productos que coincidan con tu búsqueda."}
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {visibleProducts.map((product) => {
                    const quantity = quantities[product.id] ?? 0;
                    const atLimit = quantity >= maxOrderQuantity(product.stock) || (quantity === 0 && cart.length >= maxDistinctProducts);
                    return (
                      <li key={product.id} className={`${panelClass} flex flex-col`}>
                        {product.imageId && (
                          <MediaImage
                            src={storeMediaUrl(slug, product.imageId)}
                            alt={product.name}
                            className="mb-4 aspect-[4/3] rounded-lg bg-background"
                            sizes="(max-width: 640px) 90vw, 400px"
                          />
                        )}
                        <h3 className="break-words text-xl font-extrabold">{product.name}</h3>
                        <p className="mt-1 break-words text-sm text-muted">{product.sku}</p>
                        {product.description && <p className="mt-3 break-words leading-relaxed text-muted">{product.description}</p>}
                        <p className="mt-auto pt-5 text-lg font-bold">{formatMoney(product.priceCents)}</p>
                        <button
                          type="button"
                          className={`${actionClass} mt-3 self-start`}
                          disabled={atLimit || paymentPending || refreshing || Boolean(order)}
                          aria-label={`Agregar ${product.name} al carrito`}
                          onClick={() => updateQuantity(product, quantity + 1)}
                        >
                          {product.stock === 0 ? "Agotado" : atLimit ? "Límite del carrito alcanzado" : "Agregar al carrito"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section id="carrito" aria-labelledby="cart-title" className={`${panelClass} scroll-mt-4`}>
              {order ? (
                <div className="grid gap-4">
                  <div className="flex items-center gap-2 text-success">
                    <Check size={20} aria-hidden="true" />
                    <h2 id="cart-title" className="text-xl font-extrabold">Pedido confirmado</h2>
                  </div>
                  <Notice kind="success">El pago de prueba fue aprobado.</Notice>
                  <p className="text-lg font-bold">Pedido {order.number}</p>
                  <ul className="grid gap-2 border-y border-border py-4 text-sm">
                    {order.items.map((item) => <li key={item.sku}>{item.quantity} × {item.name} · {formatMoney(item.priceCents)} c/u</li>)}
                  </ul>
                  <p className="font-extrabold">Total {formatMoney(order.totalCents)}</p>
                  <button type="button" className={secondaryClass} onClick={() => setOrder(undefined)}>Seguir comprando</button>
                </div>
              ) : (
                <>
                  <h2 id="cart-title" className="text-2xl font-extrabold">Tu carrito</h2>
                  {cart.length === 0 ? (
                    <p className="mt-3 text-muted">Agrega un producto del catálogo para comenzar.</p>
                  ) : (
                    <>
                      <ul className="mt-2 divide-y divide-border">
                        {cart.map(({ product, quantity }) => (
                          <li key={product.id} className="grid gap-2 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="min-w-0 break-words font-bold">{product.name}</p>
                              <p className="font-semibold">{formatMoney(product.priceCents * quantity)}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button type="button" className={secondaryClass} aria-label={`Reducir cantidad de ${product.name}`} disabled={paymentPending || refreshing} onClick={() => updateQuantity(product, quantity - 1)}>
                                <Minus size={16} aria-hidden="true" />
                              </button>
                              <span className="min-w-6 text-center font-bold">{quantity}</span>
                              <button type="button" className={secondaryClass} aria-label={`Aumentar cantidad de ${product.name}`} disabled={paymentPending || refreshing || quantity >= maxOrderQuantity(product.stock)} onClick={() => updateQuantity(product, quantity + 1)}>
                                <Plus size={16} aria-hidden="true" />
                              </button>
                              <button type="button" className="ml-auto min-h-11 cursor-pointer rounded-md px-1 text-sm font-bold underline underline-offset-4 disabled:opacity-60" aria-label={`Quitar ${product.name}`} disabled={paymentPending || refreshing} onClick={() => updateQuantity(product, 0)}>Quitar</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="flex justify-between gap-2 border-t border-border pt-4 text-lg font-extrabold">
                        <span>Total estimado</span><span>{formatMoney(total)}</span>
                      </p>
                      <CheckoutForm
                        slug={slug}
                        items={cart.map(({ product, quantity }) => ({ productId: product.id, quantity }))}
                        onPending={setPaymentPending}
                        onConfirmation={confirm}
                      />
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function storeError(cause: unknown) {
  return errorMessage(cause, "No pudimos cargar esta tienda.", {
    404: "La tienda no existe o aún no ha publicado su catálogo. Verifica el enlace.",
  });
}
