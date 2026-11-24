"use client";

import { errorMessage, type Product, type ProductInput } from "@vendelier/api-client";
import { actionClass, fieldClass, Field, Notice, panelClass, secondaryClass } from "@vendelier/ui";
import { useState, type FormEvent } from "react";
import { MediaUrlField } from "./media-url-field";

interface ProductEditorProps {
  product?: Product;
  disabled: boolean;
  onSave: (values: ProductInput) => Promise<void>;
  onCancel: () => void;
}

export function ProductEditor({ product, disabled, onSave, onCancel }: ProductEditorProps) {
  const [error, setError] = useState("");
  const [imageId, setImageId] = useState(product?.imageId ?? null);
  const [imagePending, setImagePending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || imagePending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setError("");
    try {
      await onSave({
        name: String(values.get("name")).trim(),
        sku: String(values.get("sku")).trim(),
        description: String(values.get("description")).trim(),
        priceCents: Math.round(Number(values.get("price")) * 100),
        stock: Number(values.get("stock")),
        imageId: imageId === (product?.imageId ?? null) ? undefined : imageId,
      });
      if (!product) {
        form.reset();
        setImageId(null);
      }
    } catch (cause) {
      setError(errorMessage(cause, "No pudimos guardar los cambios.", {
        400: "Revisa los campos del producto y la imagen seleccionada.",
        401: "Tu sesión terminó. Inicia sesión de nuevo para continuar.",
        409: "No se pudo guardar el producto. Comprueba que el SKU no esté en uso.",
      }));
    }
  }

  return (
    <form id="editar-producto" onSubmit={submit} className={`${panelClass} grid h-fit gap-4`}>
      <h3 className="text-xl font-extrabold">{product ? "Editar producto" : "Agregar producto"}</h3>
      <Field label="Nombre del producto">
        <input name="name" required maxLength={160} className={fieldClass} defaultValue={product?.name} />
      </Field>
      <Field label="SKU">
        <input name="sku" required maxLength={80} className={fieldClass} defaultValue={product?.sku} />
      </Field>
      <Field label="Descripción">
        <textarea name="description" rows={3} maxLength={5000} className={fieldClass} defaultValue={product?.description} />
      </Field>
      <div className="grid gap-4 min-[360px]:grid-cols-2">
        <Field label="Precio (MXN)">
          <input name="price" type="number" required min="0" max="21474836.47" step="0.01" className={fieldClass} defaultValue={product ? (product.priceCents / 100).toFixed(2) : undefined} />
        </Field>
        <Field label="Existencias">
          <input name="stock" type="number" required min="0" max="2147483647" step="1" className={fieldClass} defaultValue={product?.stock ?? 0} />
        </Field>
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
        {product && <button type="button" className={secondaryClass} disabled={disabled || imagePending} onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}
