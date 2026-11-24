"use client";

import { api, errorMessage, storeMediaUrl, type Order, type Product, type Store } from "@vendelier/api-client";
import { appearanceStyle, formatMoney, MediaImage, Notice, panelClass, secondaryClass, SkipLink } from "@vendelier/ui";
import { ArrowUpRight, Search, ShoppingBag, Store as StoreIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { CatalogueToolbar, filterCatalogue, Filters, initialFilters, ProductCard } from "./catalogue";
import { CartPanel, ProductDetail } from "./purchase-panel";

const maxDistinctProducts = 50;
const maxQuantityPerProduct = 100;

function maxOrderQuantity(stock: number) {
  return Math.min(stock, maxQuantityPerProduct);
}

function subscribeToHash(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}

function readCartHash() {
  return window.location.hash === "#carrito";
}

function navigateToPanel(fragment: "#detalle" | "#carrito") {
  window.location.assign(new URL(fragment, window.location.href));
}

export function Storefront({ slug }: { slug: string }) {
  const [store, setStore] = useState<Store>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string>();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [cartEntryFromPointer, setCartEntryFromPointer] = useState(false);
  const [order, setOrder] = useState<Order>();
  const [receiptFromPointer, setReceiptFromPointer] = useState(false);
  const subscribeToCartPanel = useCallback((notify: () => void) => subscribeToHash(() => {
    if (!readCartHash()) setReceiptFromPointer(false);
    notify();
  }), []);
  const cartActive = useSyncExternalStore(subscribeToCartPanel, readCartHash, () => false);
  const hasStore = Boolean(store);

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

  useEffect(() => {
    if (hasStore && cartActive && !window.matchMedia("(min-width: 48rem)").matches) {
      document.getElementById("carrito")?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [hasStore, cartActive]);

  const products = store?.products ?? [];
  const visibleProducts = filterCatalogue(products, query, filters);
  const selected = visibleProducts.find((product) => product.id === selectedId) ??
    visibleProducts.find((product) => product.imageId) ?? visibleProducts[0];
  const cart = products.flatMap((product) => {
    const quantity = quantities[product.id];
    return quantity ? [{ product, quantity }] : [];
  });
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);
  const total = cart.reduce((cents, item) => cents + item.product.priceCents * item.quantity, 0);
  const locked = paymentPending || refreshing;
  const theme = store?.theme;
  const storeName = theme?.displayName ?? store?.tenant.name ?? "Catálogo de la tienda";
  const filtersApplied = Boolean(query.trim()) || filters.availability !== "all" || filters.maxPrice !== null || filters.sort !== "catalogue";

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

  function adjustQuantity(product: Product, update: (quantity: number) => number) {
    setQuantities((current) => {
      const existing = current[product.id] ?? 0;
      if (existing === 0 && Object.keys(current).length >= maxDistinctProducts) return current;
      const next = Math.max(0, Math.min(update(existing), maxOrderQuantity(product.stock)));
      if (next === existing) return current;
      if (next > 0) return { ...current, [product.id]: next };
      return Object.fromEntries(Object.entries(current).filter(([id]) => id !== product.id));
    });
  }

  function availableToAdd(product: Product) {
    const quantity = quantities[product.id] ?? 0;
    if (quantity === 0 && cart.length >= maxDistinctProducts) return 0;
    return Math.max(0, maxOrderQuantity(product.stock) - quantity);
  }

  function addToCart(product: Product, amount: number, fromPointer: boolean) {
    setCartEntryFromPointer(fromPointer);
    adjustQuantity(product, (quantity) => quantity + amount);
  }

  function openDetail(product: Product) {
    setSelectedId(product.id);
    if (cartActive) {
      navigateToPanel("#detalle");
    }
    if (!window.matchMedia("(min-width: 48rem)").matches) {
      const panel = document.getElementById("detalle");
      panel?.scrollIntoView({ block: "start", behavior: "instant" });
      panel?.focus({ preventScroll: true });
    }
  }

  function confirm(purchase: Order, fromPointer: boolean) {
    setOrder(purchase);
    setReceiptFromPointer(fromPointer);
    setQuantities({});
    if (!readCartHash()) navigateToPanel("#carrito");
    void refresh();
  }

  return (
    <div data-tenant-theme={theme ? "" : undefined} style={theme ? appearanceStyle(theme) : undefined} className="min-h-screen bg-background text-foreground">
      <div className="relative z-30"><SkipLink /></div>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-surface">
        <div className="mx-auto grid max-w-[86rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(14rem,min(38vw,27rem))_minmax(8rem,1fr)] lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {theme?.logoId ? (
              <MediaImage src={storeMediaUrl(slug, theme.logoId)} className="size-9 rounded-md md:size-10" alt="" sizes="40px" fit="contain" />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-inset text-foreground"><StoreIcon aria-hidden="true" size={18} /></span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base leading-tight font-semibold tracking-tight md:text-lg">{storeName}</h1>
              <Link href="/" className="inline-flex items-center gap-1 rounded-xs text-xs text-muted hover:underline">
                Visitar otra tienda <ArrowUpRight aria-hidden="true" size={12} />
              </Link>
            </div>
          </div>
          {store && (
            <>
              <label className="relative col-span-2 row-start-2 flex min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
                <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" size={17} />
                <span className="sr-only">Buscar productos</span>
                <input
                  type="search"
                  placeholder="Busca por nombre o SKU"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-h-10 w-full min-w-0 rounded-lg border border-transparent bg-inset/65 pr-3 pl-10 text-base text-foreground placeholder:text-muted focus:border-border focus:bg-surface md:text-sm"
                />
              </label>
              <a
                href="#carrito"
                className="col-start-2 row-start-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 justify-self-end rounded-lg border border-border/70 px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-inset md:col-start-3 md:min-h-10 md:px-3"
                aria-label={`Carrito (${cartCount})`}
                aria-describedby={cartCount > 0 ? "header-cart-total" : undefined}
              >
                <ShoppingBag aria-hidden="true" size={16} />
                <span>Carrito</span>
                <span
                  className="cart-count relative inline-grid min-h-5 min-w-5 place-items-center rounded-full bg-inset px-1 text-[11px] tabular-nums"
                  data-filled={cartCount > 0 ? "" : undefined}
                  data-pointer-add={cartEntryFromPointer ? "" : undefined}
                  aria-hidden="true"
                >
                  <span className="cart-count-highlight pointer-events-none absolute inset-0 rounded-full bg-accent" />
                  <span className="relative">{cartCount}</span>
                </span>
                {cartCount > 0 && <span id="header-cart-total" className="hidden border-l border-border pl-2 text-muted tabular-nums sm:inline">{formatMoney(total)}</span>}
              </a>
            </>
          )}
        </div>
      </header>
      <p role="status" className="sr-only">
        {cartCount === 0 ? "Carrito vacío" : `Carrito: ${cartCount} ${cartCount === 1 ? "producto" : "productos"}. Total: ${formatMoney(total)}.`}
      </p>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[86rem] scroll-mt-32 px-4 py-3 sm:px-6 md:scroll-mt-24 md:py-5 lg:px-8">
        {theme?.bannerId && (
          <MediaImage src={storeMediaUrl(slug, theme.bannerId)} alt="" className="mb-3 h-16 w-full rounded-panel bg-inset sm:mb-5 sm:h-24" sizes="(max-width: 640px) 94vw, 1312px" />
        )}
        {loading && <p role="status" className={panelClass}>Cargando catálogo…</p>}
        {error && (
          <div className="mb-4 grid justify-items-start gap-3">
            <Notice kind="error">{error}</Notice>
            <button type="button" className={secondaryClass} disabled={refreshing} onClick={refresh}>Volver a consultar</button>
          </div>
        )}
        {store && (
          <div className="grid min-w-0 items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.67fr)] lg:grid-cols-[10rem_minmax(0,1fr)_minmax(17rem,0.64fr)] lg:gap-6 xl:grid-cols-[11rem_minmax(0,1fr)_19rem] 2xl:grid-cols-[11.5rem_minmax(0,1fr)_20rem]">
            <Filters
              products={products}
              filters={filters}
              onChange={setFilters}
              onReset={() => { setFilters(initialFilters); setQuery(""); }}
              dirty={filtersApplied}
            />

            <section className="min-w-0" aria-labelledby="catalogue-title">
              <CatalogueToolbar count={visibleProducts.length} sort={filters.sort} onSort={(sort) => setFilters({ ...filters, sort })} onRefresh={refresh} disabled={locked} />
              {visibleProducts.length > 0 ? (
                <ul className="grid min-w-0 gap-x-3 gap-y-4 min-[360px]:grid-cols-2 md:gap-x-4 md:max-lg:grid-cols-1 lg:gap-x-5 lg:gap-y-6">
                  {visibleProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      slug={slug}
                      product={product}
                      selected={selected?.id === product.id && !cartActive}
                      disabled={locked || Boolean(order) || availableToAdd(product) === 0}
                      onSelect={() => openDetail(product)}
                      onAdd={(event) => addToCart(product, 1, event.detail > 0)}
                    />
                  ))}
                </ul>
              ) : (
                <div className="grid min-h-36 justify-items-start gap-3 py-5 text-sm text-muted">
                  <p>{products.length === 0 ? "La tienda aún no tiene productos en su catálogo." : "No encontramos productos con estos filtros."}</p>
                  {filtersApplied && <button type="button" className={secondaryClass} onClick={() => { setFilters(initialFilters); setQuery(""); }}>Ver todos los productos</button>}
                </div>
              )}
            </section>

            <aside id="carrito" tabIndex={-1} className={`${panelClass} min-w-0 scroll-mt-32 md:scroll-mt-24 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto`} aria-label="Detalle y carrito">
              <div id="detalle" tabIndex={-1} className="scroll-mt-32 md:scroll-mt-24">
                <nav aria-label="Panel de compra" className="mb-4 flex min-w-0 gap-5 border-b border-border/70 text-sm">
                  <a href="#detalle" aria-current={cartActive ? undefined : "true"} className={`flex min-h-10 items-center border-b-2 px-1 text-center ${cartActive ? "border-transparent text-muted hover:text-foreground" : "border-foreground font-semibold"}`}>Detalle</a>
                  <a href="#carrito" aria-current={cartActive ? "true" : undefined} className={`flex min-h-10 items-center gap-1.5 border-b-2 px-1 text-center ${cartActive ? "border-foreground font-semibold" : "border-transparent text-muted hover:text-foreground"}`}>
                    <ShoppingBag aria-hidden="true" size={14} /> Ver carrito
                  </a>
                </nav>
                <div hidden={cartActive}>
                  {selected ? (
                    <ProductDetail
                      key={selected.id}
                      slug={slug}
                      product={selected}
                      maxQuantity={availableToAdd(selected)}
                      disabled={locked || Boolean(order)}
                      onAdd={(extra, fromPointer) => {
                        addToCart(selected, extra, fromPointer);
                        navigateToPanel("#carrito");
                      }}
                    />
                  ) : (
                    <p className="py-4 text-sm leading-relaxed text-muted">Selecciona un producto del catálogo para ver sus detalles.</p>
                  )}
                </div>
                <div hidden={!cartActive}>
                  <CartPanel
                    slug={slug}
                    active={cartActive}
                    cart={cart}
                    total={total}
                    order={order}
                    receiptFromPointer={receiptFromPointer}
                    onReceiptMotionEnd={() => setReceiptFromPointer(false)}
                    locked={locked}
                    maxOrderQuantity={maxOrderQuantity}
                    onQuantity={(product, quantity) => adjustQuantity(product, () => quantity)}
                    onPending={setPaymentPending}
                    onConfirm={confirm}
                    onContinue={() => { setOrder(undefined); navigateToPanel("#detalle"); }}
                  />
                </div>
              </div>
            </aside>
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
