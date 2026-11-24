"use client";

import { storeMediaUrl, type Product } from "@vendelier/api-client";
import { formatMoney, MediaImage } from "@vendelier/ui";
import { ChevronDown, ImageOff, Plus, RotateCw } from "lucide-react";
import Image from "next/image";
import { useState, type MouseEvent } from "react";

type Availability = "all" | "available" | "sold-out";
type SortOrder = "catalogue" | "price-asc" | "price-desc" | "name";
export interface CatalogueFilters {
  availability: Availability;
  maxPrice: number | null;
  sort: SortOrder;
}
export const initialFilters: CatalogueFilters = { availability: "all", maxPrice: null, sort: "catalogue" };

const availabilityOptions = [
  { value: "all", label: "Todos los productos" },
  { value: "available", label: "Disponibles" },
  { value: "sold-out", label: "Agotados" },
] as const;

function searchText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-MX");
}

export function filterCatalogue(products: Product[], query: string, filters: CatalogueFilters) {
  const words = searchText(query.trim()).split(/\s+/).filter(Boolean);
  const results = products.filter((product) => {
    if (filters.availability === "available" && product.stock === 0) return false;
    if (filters.availability === "sold-out" && product.stock > 0) return false;
    if (filters.maxPrice !== null && product.priceCents > filters.maxPrice) return false;
    const summary = searchText(`${product.name} ${product.sku} ${product.description}`);
    return words.every((word) => summary.includes(word));
  });

  switch (filters.sort) {
    case "price-asc": return results.sort((a, b) => a.priceCents - b.priceCents);
    case "price-desc": return results.sort((a, b) => b.priceCents - a.priceCents);
    case "name": return results.sort((a, b) => a.name.localeCompare(b.name, "es-MX"));
    default: return results;
  }
}

interface FiltersProps {
  products: Product[];
  filters: CatalogueFilters;
  onChange: (next: CatalogueFilters) => void;
  onReset: () => void;
  dirty: boolean;
}

export function Filters({ products, filters, onChange, onReset, dirty }: FiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const available = products.filter((product) => product.stock > 0).length;
  const highest = products.reduce((max, product) => Math.max(max, product.priceCents), 0);
  const maxPrice = Math.min(filters.maxPrice ?? highest, highest);
  const counts = { all: products.length, available, "sold-out": products.length - available };

  return (
    <aside className="min-w-0 border-b border-border/70 py-1 md:col-span-2 lg:sticky lg:top-24 lg:col-span-1 lg:border-r lg:border-b-0 lg:pr-5" aria-label="Filtros del catálogo">
      <button
        type="button"
        className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 text-left text-sm font-semibold lg:hidden"
        aria-expanded={expanded}
        aria-controls="catalogue-filters"
        onClick={() => setExpanded(!expanded)}
      >
        Filtros
        <ChevronDown aria-hidden="true" size={16} className={expanded ? "rotate-180" : undefined} />
      </button>
      <div id="catalogue-filters" className={expanded ? "pt-2 pb-4 lg:pt-0" : "hidden lg:block"}>
        <h2 className="hidden text-sm font-semibold lg:block">Filtros</h2>
        <fieldset className="mt-1 min-w-0 lg:mt-6">
          <legend className="mb-1 text-xs font-semibold text-muted">Disponibilidad</legend>
          <div className="grid">
            {availabilityOptions.map(({ value, label }) => (
              <label
                key={value}
                className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-1 text-xs hover:bg-surface/60 ${filters.availability === value ? "font-semibold" : "text-muted"}`}
              >
                <input
                  type="radio"
                  name="availability"
                  className="size-3.5 shrink-0 accent-primary"
                  checked={filters.availability === value}
                  onChange={() => onChange({ ...filters, availability: value })}
                />
                <span>{label}</span>
                <span className="ml-auto tabular-nums text-muted" aria-hidden="true">{counts[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {highest > 0 && (
          <div className="mt-4 border-t border-border/70 pt-4">
            <label htmlFor="catalogue-max-price" className="text-xs font-semibold text-muted">Precio máximo</label>
            <p className="mt-1 text-sm font-medium tabular-nums">{formatMoney(maxPrice)}</p>
            <input
              type="range"
              id="catalogue-max-price"
              className="block h-8 w-full cursor-pointer accent-primary"
              min={0}
              max={highest}
              step={1}
              value={maxPrice}
              aria-valuetext={formatMoney(maxPrice)}
              onChange={(event) => {
                const limit = Number(event.target.value);
                onChange({ ...filters, maxPrice: limit === highest ? null : limit });
              }}
            />
          </div>
        )}
        {dirty && (
          <button type="button" onClick={onReset} className="mt-2 min-h-10 cursor-pointer rounded-sm text-xs font-semibold underline underline-offset-4 hover:text-muted">
            Limpiar filtros
          </button>
        )}
      </div>
    </aside>
  );
}

export function CatalogueToolbar({ count, sort, onSort, onRefresh, disabled }: {
  count: number;
  sort: SortOrder;
  onSort: (sort: SortOrder) => void;
  onRefresh: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border/70 pb-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 id="catalogue-title" className="text-2xl leading-none font-semibold tracking-tight sm:text-[1.75rem]">Catálogo</h2>
        <span aria-live="polite" className="text-xs text-muted">
          {count} {count === 1 ? "producto" : "productos"}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <div className="w-fit min-w-0">
          <label htmlFor="catalogue-sort" className="sr-only">Ordenar por</label>
          <select
            id="catalogue-sort"
            className="min-h-10 max-w-full cursor-pointer rounded-lg border border-transparent bg-transparent px-2 text-xs text-foreground hover:bg-surface/70"
            value={sort}
            onChange={(event) => onSort(event.target.value as SortOrder)}
          >
            <option value="catalogue">Orden del catálogo</option>
            <option value="price-asc">Menor precio</option>
            <option value="price-desc">Mayor precio</option>
            <option value="name">Nombre</option>
          </select>
        </div>
        <button
          type="button"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Actualizar catálogo"
          title="Actualizar catálogo"
          disabled={disabled}
          onClick={onRefresh}
        >
          <RotateCw aria-hidden="true" size={14} />
        </button>
      </div>
    </div>
  );
}

export function ProductPhoto({ slug, product, detail = false }: { slug: string; product: Product; detail?: boolean }) {
  const sizeClass = detail ? "h-36 lg:h-40" : "aspect-[4/3]";
  if (!product.imageId) {
    return (
      <div className={`grid w-full place-items-center rounded-panel bg-inset/65 text-muted ${sizeClass}`} role="img" aria-label="Sin imagen">
        <ImageOff aria-hidden="true" size={21} strokeWidth={1.4} />
      </div>
    );
  }
  const src = storeMediaUrl(slug, product.imageId);

  if (detail) {
    return (
      <div className="grid min-h-28 place-items-center overflow-hidden rounded-panel bg-inset/65">
        <Image src={src} alt="" width={400} height={280} unoptimized className="block h-auto max-h-56 w-auto max-w-full object-contain" />
      </div>
    );
  }

  return (
    <MediaImage
      src={src}
      alt={product.name}
      className={`w-full rounded-panel bg-inset/65 ${sizeClass}`}
      sizes="(max-width: 600px) 44vw, (max-width: 1024px) 46vw, 380px"
    />
  );
}

export function ProductCard({ slug, product, selected, disabled, onSelect, onAdd }: {
  slug: string;
  product: Product;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onAdd: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <li className="relative flex min-w-0 flex-col pb-1">
      <ProductPhoto slug={slug} product={product} />
      <h3 className="mt-2.5 break-words text-sm leading-snug font-semibold sm:text-base">
        <button
          type="button"
          aria-label={`Ver detalle de ${product.name}`}
          aria-pressed={selected}
          className={`cursor-pointer rounded-xs text-left underline-offset-4 before:absolute before:inset-0 before:rounded-panel hover:underline ${selected ? "underline decoration-accent decoration-2" : ""}`}
          onClick={onSelect}
        >
          {product.name}
        </button>
      </h3>
      <div className="mt-auto flex min-h-11 flex-wrap items-center justify-between gap-x-1.5 gap-y-0">
        <span className="text-sm font-medium text-muted tabular-nums">{formatMoney(product.priceCents)}</span>
        {product.stock > 0 ? (
          <button
            type="button"
            className="relative z-1 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-full text-foreground hover:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-45 sm:px-2"
            aria-label={`Agregar ${product.name} al carrito`}
            title="Agregar al carrito"
            disabled={disabled}
            onClick={onAdd}
          >
            <Plus aria-hidden="true" size={17} strokeWidth={1.6} />
            <span className="hidden text-xs font-semibold xl:inline">Agregar</span>
          </button>
        ) : <span className="text-xs font-medium text-muted">Agotado</span>}
      </div>
    </li>
  );
}
