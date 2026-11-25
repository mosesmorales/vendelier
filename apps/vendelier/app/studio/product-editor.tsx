"use client";

import {
  errorMessage,
  type Product,
  type ProductInput,
  type ProductOptionInput,
  type ProductVariantInput,
} from "@vendelier/api-client";
import { actionClass, fieldClass, Field, Notice, panelClass, quietClass, secondaryClass } from "@vendelier/ui";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MediaUrlField } from "./media-url-field";

interface ProductEditorProps {
  product?: Product;
  disabled: boolean;
  onSave: (values: ProductInput) => Promise<void>;
  onDelete?: (product: Product) => Promise<void>;
  onCancel: () => void;
}

interface DraftVariantRow {
  id?: string;
  title: string;
  sku: string;
  pricePesos: string;
  stock: string;
  selectedOptions: Record<string, string>;
}

function initialVariants(product?: Product): DraftVariantRow[] {
  return (product?.variants ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku,
    pricePesos: (v.priceCents / 100).toFixed(2),
    stock: String(v.stock),
    selectedOptions: v.selectedOptions,
  }));
}

export function ProductEditor({ product, disabled, onSave, onDelete, onCancel }: ProductEditorProps) {
  const [error, setError] = useState("");
  const [imageId, setImageId] = useState(product?.imageId ?? null);
  const [imagePending, setImagePending] = useState(false);
  const [optionName, setOptionName] = useState(product?.options?.[0]?.name ?? "");
  const [variants, setVariants] = useState<DraftVariantRow[]>(() => initialVariants(product));

  function addVariant() {
    setVariants((current) => [
      ...current,
      {
        title: "",
        sku: "",
        pricePesos: product ? (product.priceCents / 100).toFixed(2) : "0.00",
        stock: "0",
        selectedOptions: {},
      },
    ]);
  }

  function updateVariant(index: number, patch: Partial<DraftVariantRow>) {
    setVariants((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeVariant(index: number) {
    setVariants((current) => current.filter((_, i) => i !== index));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || imagePending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setError("");

    const activeVariants: ProductVariantInput[] = variants
      .filter((row) => row.title.trim() && row.sku.trim())
      .map((row) => ({
        ...(row.id ? { id: row.id } : {}),
        title: row.title.trim(),
        sku: row.sku.trim(),
        priceCents: Math.round(Number(row.pricePesos) * 100),
        stock: Math.max(0, Math.floor(Number(row.stock) || 0)),
        selectedOptions: optionName.trim() ? { [optionName.trim()]: row.title.trim() } : row.selectedOptions,
      }));

    const options: ProductOptionInput[] | undefined =
      activeVariants.length > 0 && optionName.trim()
        ? [{ name: optionName.trim(), values: [...new Set(activeVariants.map((v) => v.title))] }]
        : activeVariants.length === 0 && product
          ? []
          : undefined;

    try {
      await onSave({
        name: String(values.get("name")).trim(),
        sku: String(values.get("sku")).trim(),
        description: String(values.get("description")).trim(),
        priceCents: Math.round(Number(values.get("price")) * 100),
        stock: activeVariants.length > 0
          ? activeVariants.reduce((sum, v) => sum + v.stock, 0)
          : Number(values.get("stock")),
        imageId: imageId === (product?.imageId ?? null) ? undefined : imageId,
        ...(options !== undefined ? { options } : {}),
        ...(variants.length > 0 || product ? { variants: activeVariants } : {}),
      });
      if (!product) {
        form.reset();
        setImageId(null);
        setOptionName("");
        setVariants([]);
      }
    } catch (cause) {
      setError(errorMessage(cause, "No pudimos guardar los cambios.", {
        400: "Revisa los campos del producto, las variantes y la imagen seleccionada.",
        401: "Tu sesión terminó. Inicia sesión de nuevo para continuar.",
        409: "No se pudo guardar el producto. Comprueba que el SKU o variante no esté en uso o tenga pedidos.",
      }));
    }
  }

  async function handleDelete() {
    if (!product || !onDelete || disabled) return;
    setError("");
    try {
      await onDelete(product);
    } catch (cause) {
      setError(errorMessage(cause, "No pudimos eliminar el producto.", {
        409: "No se puede eliminar un producto que ya tiene pedidos registrados.",
      }));
    }
  }

  return (
    <form id="editar-producto" onSubmit={submit} className={`${panelClass} grid h-fit gap-4`}>
      <h3 className="border-b border-border pb-3 text-lg font-semibold tracking-tight">
        {product ? "Editar producto" : "Agregar producto"}
      </h3>
      <Field label="Nombre del producto">
        <input name="name" required maxLength={160} className={fieldClass} defaultValue={product?.name} />
      </Field>
      <Field label="SKU base">
        <input name="sku" required maxLength={80} className={fieldClass} defaultValue={product?.sku} />
      </Field>
      <Field label="Descripción">
        <textarea name="description" rows={3} maxLength={5000} className={fieldClass} defaultValue={product?.description} />
      </Field>
      <div className="grid gap-4 min-[360px]:grid-cols-2">
        <Field label="Precio base (MXN)">
          <input
            name="price"
            type="number"
            required
            min="0"
            max="21474836.47"
            step="0.01"
            className={fieldClass}
            defaultValue={product ? (product.priceCents / 100).toFixed(2) : undefined}
          />
        </Field>
        <Field label={variants.length > 0 ? "Existencias (calculadas)" : "Existencias"}>
          <input
            name="stock"
            type="number"
            required
            min="0"
            max="2147483647"
            step="1"
            readOnly={variants.length > 0}
            className={fieldClass}
            value={variants.length > 0 ? variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0) : undefined}
            defaultValue={variants.length > 0 ? undefined : product?.stock ?? 0}
          />
        </Field>
      </div>

      <div className="grid gap-3 rounded-lg border border-border/80 bg-inset/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Variantes (opcional)</p>
          <button type="button" className={quietClass} disabled={disabled} onClick={addVariant}>
            <Plus size={14} aria-hidden="true" /> Agregar variante
          </button>
        </div>
        {variants.length > 0 && (
          <>
            <Field label="Nombre de la opción (ej. Talla, Color, Tamaño)">
              <input
                className={fieldClass}
                maxLength={60}
                placeholder="Talla"
                value={optionName}
                onChange={(event) => setOptionName(event.target.value)}
              />
            </Field>
            <ul className="grid gap-2">
              {variants.map((row, index) => (
                <li key={row.id ?? index} className="grid gap-2 rounded-md border border-border bg-surface p-2.5">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      aria-label={`Variante ${index + 1} título`}
                      className={fieldClass}
                      placeholder="Ej. M / Negro"
                      required
                      maxLength={120}
                      value={row.title}
                      onChange={(event) => updateVariant(index, { title: event.target.value })}
                    />
                    <input
                      aria-label={`Variante ${index + 1} SKU`}
                      className={fieldClass}
                      placeholder="SKU-VAR"
                      required
                      maxLength={80}
                      value={row.sku}
                      onChange={(event) => updateVariant(index, { sku: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      aria-label={`Variante ${index + 1} precio`}
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      className={`${fieldClass} w-28 flex-1`}
                      value={row.pricePesos}
                      onChange={(event) => updateVariant(index, { pricePesos: event.target.value })}
                    />
                    <input
                      aria-label={`Variante ${index + 1} stock`}
                      type="number"
                      min="0"
                      step="1"
                      required
                      className={`${fieldClass} w-24`}
                      value={row.stock}
                      onChange={(event) => updateVariant(index, { stock: event.target.value })}
                    />
                    <button
                      type="button"
                      className={quietClass}
                      aria-label={`Quitar variante ${index + 1}`}
                      disabled={disabled}
                      onClick={() => removeVariant(index)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <MediaUrlField
        label="URL de la imagen principal"
        target="imagen"
        imageId={imageId}
        disabled={disabled}
        onChange={setImageId}
        onPending={setImagePending}
      />
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={actionClass} disabled={disabled || imagePending}>
          {disabled ? "Guardando…" : product ? "Guardar cambios" : "Agregar al catálogo"}
        </button>
        {product && (
          <>
            <button type="button" className={secondaryClass} disabled={disabled || imagePending} onClick={onCancel}>
              Cancelar
            </button>
            {onDelete && (
              <button type="button" className={`${quietClass} ml-auto text-danger`} disabled={disabled || imagePending} onClick={handleDelete}>
                <Trash2 size={14} aria-hidden="true" /> Eliminar
              </button>
            )}
          </>
        )}
      </div>
    </form>
  );
}
