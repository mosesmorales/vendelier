"use client";

import { storeMediaUrl, type Order, type Product } from "@vendelier/api-client";
import { actionClass, formatMoney, MediaImage, Notice, secondaryClass } from "@vendelier/ui";
import { Check, ChevronDown, Minus, Plus, ShoppingBag } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { ProductPhoto } from "./catalogue";
import { CheckoutForm } from "./checkout-form";

const quantityAction = "grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-lg hover:bg-inset active:bg-inset disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:min-w-10";

export function ProductDetail({ slug, product, maxQuantity, disabled, onAdd }: {
  slug: string;
  product: Product;
  maxQuantity: number;
  disabled: boolean;
  onAdd: (quantity: number, fromPointer: boolean) => void;
}) {
  const [requested, setRequested] = useState(1);
  const quantity = Math.min(requested, Math.max(1, maxQuantity));
  return (
    <div className="grid gap-4" aria-labelledby="detail-title">
      <ProductPhoto slug={slug} product={product} detail />
      <div>
        <h2 id="detail-title" className="text-[1.35rem] leading-tight font-semibold wrap-anywhere tracking-tight">{product.name}</h2>
        <p className="mt-1.5 text-base font-semibold tabular-nums">{formatMoney(product.priceCents)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{product.stock > 0 ? "Disponible" : "Agotado"}</span>
          <span aria-hidden="true">·</span>
          <span className="wrap-anywhere">SKU {product.sku}</span>
        </div>
      </div>
      {product.stock > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex shrink-0 items-center rounded-lg border border-border" role="group" aria-label="Cantidad para agregar">
            <button type="button" aria-label="Disminuir cantidad para agregar" className={quantityAction} disabled={disabled || quantity <= 1} onClick={() => setRequested(quantity - 1)}>
              <Minus aria-hidden="true" size={15} />
            </button>
            <span className="min-w-5 text-center text-sm font-semibold tabular-nums">{quantity}</span>
            <button type="button" aria-label="Aumentar cantidad para agregar" className={quantityAction} disabled={disabled || quantity >= maxQuantity} onClick={() => setRequested(quantity + 1)}>
              <Plus aria-hidden="true" size={15} />
            </button>
          </div>
          <button type="button" disabled={disabled || maxQuantity === 0} className={`${actionClass} min-w-38 flex-1 gap-1.5 px-2.5! text-xs! whitespace-nowrap`} onClick={(event) => onAdd(quantity, event.detail > 0)}>
            <ShoppingBag aria-hidden="true" size={16} />
            {maxQuantity === 0 ? "Límite alcanzado" : "Agregar al carrito"}
          </button>
        </div>
      )}
      {product.description && (
        <details open className="group border-t border-border/70 pt-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
            Descripción <ChevronDown aria-hidden="true" size={15} className="group-open:rotate-180" />
          </summary>
          <p className="mt-2 leading-relaxed wrap-anywhere text-muted">{product.description}</p>
        </details>
      )}
    </div>
  );
}

export interface CartLine { product: Product; quantity: number }

export function CartPanel({ slug, active, cart, total, order, receiptFromPointer, onReceiptMotionEnd, locked, onQuantity, maxOrderQuantity, onPending, onConfirm, onContinue }: {
  slug: string;
  active: boolean;
  cart: CartLine[];
  total: number;
  order?: Order;
  receiptFromPointer: boolean;
  onReceiptMotionEnd: () => void;
  locked: boolean;
  maxOrderQuantity: (stock: number) => number;
  onQuantity: (product: Product, next: number) => void;
  onPending: (pending: boolean) => void;
  onConfirm: (order: Order, fromPointer: boolean) => void;
  onContinue: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterRemoval = useRef(false);

  useLayoutEffect(() => {
    if (active && (order || focusAfterRemoval.current)) {
      heading.current?.focus();
      focusAfterRemoval.current = false;
    }
  }, [active, cart.length, order]);

  function changeQuantity(product: Product, next: number) {
    if (next === 0) focusAfterRemoval.current = true;
    onQuantity(product, next);
  }

  if (order) {
    return (
      <div className="grid gap-4">
        <div className="flex items-center gap-2 text-success">
          <Check aria-hidden="true" size={20} className={receiptFromPointer ? "receipt-mark-entry" : undefined} />
          <h2 ref={heading} tabIndex={-1} className="text-xl font-bold tracking-tight">Pedido confirmado</h2>
        </div>
        <div
          className={`grid gap-4 ${receiptFromPointer ? "receipt-summary-entry" : ""}`}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === "opacity") onReceiptMotionEnd();
          }}
        >
          <Notice kind="success">El pago de prueba fue aprobado.</Notice>
          <p className="font-semibold">Pedido {order.number}</p>
          <ul className="grid gap-2 border-y border-border/70 py-4 text-sm">
            {order.items.map((item) => <li key={item.sku}>{item.quantity} × {item.name} · {formatMoney(item.priceCents)} c/u</li>)}
          </ul>
          <p className="font-bold">Total {formatMoney(order.totalCents)}</p>
        </div>
        <button type="button" className={secondaryClass} onClick={onContinue}>Seguir comprando</button>
      </div>
    );
  }

  return (
    <div>
      <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight">Tu carrito</h2>
      {cart.length === 0 ? (
        <div className="grid justify-items-start gap-3 py-5 text-muted">
          <ShoppingBag aria-hidden="true" size={20} strokeWidth={1.5} />
          <p className="text-sm leading-relaxed text-muted">Agrega un producto del catálogo para comenzar.</p>
        </div>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-border/70">
            {cart.map(({ product, quantity }) => (
              <li key={product.id} className="grid gap-2 py-3">
                <div className="flex min-w-0 items-center gap-3 text-sm">
                  {product.imageId && <MediaImage src={storeMediaUrl(slug, product.imageId)} alt="" className="size-11 rounded-md bg-inset" sizes="44px" />}
                  <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-2">
                    <p className="min-w-0 font-semibold wrap-anywhere">{product.name}</p>
                    <p className="shrink-0 text-xs font-medium text-muted tabular-nums">{formatMoney(product.priceCents * quantity)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-border">
                    <button type="button" className={quantityAction} aria-label={`Reducir cantidad de ${product.name}`} disabled={locked} onClick={() => changeQuantity(product, quantity - 1)}>
                      <Minus aria-hidden="true" size={14} />
                    </button>
                    <span className="min-w-5 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                    <button type="button" className={quantityAction} aria-label={`Aumentar cantidad de ${product.name}`} disabled={locked || quantity >= maxOrderQuantity(product.stock)} onClick={() => onQuantity(product, quantity + 1)}>
                      <Plus aria-hidden="true" size={14} />
                    </button>
                  </div>
                  <button type="button" className="ml-auto min-h-11 cursor-pointer rounded-md px-1 text-xs font-semibold underline underline-offset-4 disabled:opacity-55 sm:min-h-10" aria-label={`Quitar ${product.name}`} disabled={locked} onClick={() => changeQuantity(product, 0)}>Quitar</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap justify-between gap-2 border-t border-border/70 pt-4 text-sm font-semibold">
            <span>Total estimado</span><span className="tabular-nums">{formatMoney(total)}</span>
          </p>
          <CheckoutForm slug={slug} items={cart.map(({ product, quantity }) => ({ productId: product.id, quantity }))} onPending={onPending} onConfirmation={onConfirm} />
        </>
      )}
    </div>
  );
}
