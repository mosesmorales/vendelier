"use client";

import type { StudioOverview } from "@vendelier/api-client";
import { fieldClass, formatDate, formatMoney, MetricCard, metricGridClass, panelClass } from "@vendelier/ui";
import { ArrowUpRight, Boxes, CircleDollarSign, Receipt } from "lucide-react";
import { useState } from "react";

const dayMs = 24 * 60 * 60 * 1000;
const timeZone = "America/Mexico_City";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("es-MX", { timeZone, day: "numeric", month: "short" });
const dayNumber = new Intl.DateTimeFormat("es-MX", { timeZone, day: "numeric" });
const tickFormat = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 });

export function OverviewPanel({ overview }: { overview: StudioOverview }) {
  const { orders, products } = overview;
  const [period, setPeriod] = useState(7);
  const [today] = useState(() => new Date());
  const revenue = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const pending = orders.filter((order) => order.status === "pending").length;
  const prepared = orders.length - pending;
  const units = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = products.filter((product) => product.stock < 5);
  const salesByDay = new Map<string, number>();
  for (const order of orders) {
    const day = dayKey.format(new Date(order.createdAt));
    salesByDay.set(day, (salesByDay.get(day) ?? 0) + order.totalCents);
  }
  const days = Array.from({ length: period }, (_, index) => {
    const date = new Date(today.getTime() - (period - index - 1) * dayMs);
    return { label: dayLabel.format(date), number: dayNumber.format(date), total: salesByDay.get(dayKey.format(date)) ?? 0 };
  });
  const maximum = Math.max(0, ...days.map(({ total }) => total));
  const salesInPeriod = days.reduce((sum, { total }) => sum + total, 0);
  const columns = `repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="grid gap-5">
      <dl className={metricGridClass}>
        <MetricCard label="Ventas simuladas" value={formatMoney(revenue)} detail="Total de pedidos aprobados" icon={<CircleDollarSign size={18} />} />
        <MetricCard label="Pedidos" value={orders.length} detail={`${pending} por preparar`} icon={<Receipt size={18} />} />
        <MetricCard label="Productos" value={products.length} detail={`${units} unidades en inventario`} icon={<Boxes size={18} />} />
      </dl>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <section className={panelClass} aria-labelledby="sales-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="sales-title" className="text-lg font-semibold tracking-tight">Actividad de ventas</h2>
              <p className="mt-1.5 text-sm text-muted"><span className="font-semibold tabular-nums text-foreground">{formatMoney(salesInPeriod)}</span> en el periodo</p>
            </div>
            <div className="w-29">
              <select className={fieldClass} aria-label="Periodo de ventas" value={period} onChange={(event) => setPeriod(Number(event.target.value))}>
                <option value={7}>7 días</option>
                <option value={14}>14 días</option>
              </select>
            </div>
          </div>
          {maximum > 0 ? (
            <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 sm:gap-4">
              <div aria-hidden="true" className="flex h-32 flex-col justify-between text-right text-[0.625rem] text-muted sm:text-xs">
                {[maximum, maximum / 2, 0].map((tick) => <span key={tick} className="tabular-nums">${tickFormat.format(tick / 100)}</span>)}
              </div>
              <div className="min-w-0">
                <div className="relative h-32">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                    {["top", "middle", "bottom"].map((line) => <span key={line} className="border-t border-border" />)}
                  </div>
                  <ul aria-label="Ventas por día" className="relative grid h-full items-end gap-1.5 sm:gap-2.5" style={{ gridTemplateColumns: columns }}>
                    {days.map(({ label, total }) => (
                      <li key={label} className="flex h-full min-w-0 items-end justify-center" title={`${label} · ${formatMoney(total)}`}>
                        <div aria-hidden="true" className={"w-full max-w-8 rounded-t-md " + (total > 0 ? "min-h-1.5 bg-accent" : "h-0.5 bg-border")} style={total > 0 ? { height: `${100 * total / maximum}%` } : undefined} />
                        <span className="sr-only">{label} · {formatMoney(total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div aria-hidden="true" className="mt-2 grid gap-1.5 text-center text-[0.625rem] text-muted sm:gap-2.5 sm:text-xs" style={{ gridTemplateColumns: columns }}>
                  {days.map(({ label, number }) => <span key={label} className="tabular-nums">{number}</span>)}
                </div>
              </div>
            </div>
          ) : <p className="mt-6 grid min-h-32 place-items-center rounded-lg bg-inset px-4 text-center text-sm text-muted">Aún no hay ventas en este periodo.</p>}
          <p className="mt-4 text-xs text-muted">{days[0].label} – {days[days.length - 1].label}</p>
        </section>

        <section className={panelClass} aria-labelledby="fulfillment-title">
          <h2 id="fulfillment-title" className="text-lg font-semibold tracking-tight">Preparación de pedidos</h2>
          {orders.length > 0 ? (
            <>
              <p className="mt-5 text-2xl font-semibold tracking-tight tabular-nums">{prepared} <span className="text-sm font-normal tracking-normal text-muted">de {orders.length} preparados</span></p>
              <div aria-hidden="true" className="mt-3 overflow-hidden rounded-full bg-inset"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${100 * prepared / orders.length}%` }} /></div>
              <p className="mt-3 text-sm text-muted">{pending} por preparar</p>
            </>
          ) : <p className="mt-4 text-sm text-muted">Los pedidos aprobados aparecerán aquí.</p>}
          <a href="#pedidos" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">Ver pedidos <ArrowUpRight size={15} aria-hidden="true" /></a>
        </section>

        <section className={panelClass} aria-labelledby="recent-orders-title">
          <h2 id="recent-orders-title" className="text-lg font-semibold tracking-tight">Pedidos recientes</h2>
          {orders.length ? (
            <ul className="mt-3 divide-y divide-border">
              {orders.slice(0, 4).map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{order.number}</p>
                    <p className="mt-0.5 break-words text-xs text-muted">{order.customerName} · {formatDate(order.createdAt)}</p>
                  </div>
                  <span className="font-semibold tabular-nums">{formatMoney(order.totalCents)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">Aquí aparecerán los pedidos aprobados.</p>}
        </section>

        <section className={panelClass} aria-labelledby="stock-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="stock-title" className="text-lg font-semibold tracking-tight">Existencias bajas</h2>
            <a href="#catalogo" className="inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">Ver catálogo <ArrowUpRight size={15} aria-hidden="true" /></a>
          </div>
          {lowStock.length ? (
            <ul className="mt-2 divide-y divide-border">
              {lowStock.slice(0, 4).map((product) => <li key={product.id} className="flex items-start justify-between gap-3 py-3 text-sm"><span className="min-w-0 break-words">{product.name}</span><span className="shrink-0 font-semibold tabular-nums">{product.stock} u.</span></li>)}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">{products.length ? "Todos los productos tienen al menos 5 unidades." : "Agrega productos para consultar sus existencias."}</p>}
        </section>
      </div>
    </div>
  );
}
