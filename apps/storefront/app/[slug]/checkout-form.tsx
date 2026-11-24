"use client";

import { api, errorMessage, type CheckoutInput, type Order } from "@vendelier/api-client";
import { actionClass, fieldClass, Field, Notice } from "@vendelier/ui";
import { useRef, useState, type FormEvent } from "react";

interface CheckoutFormProps {
  slug: string;
  items: CheckoutInput["items"];
  onPending: (pending: boolean) => void;
  onConfirmation: (order: Order) => void;
}

export function CheckoutForm({ slug, items, onPending, onConfirmation }: CheckoutFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const retry = useRef<{ intent: string; checkoutKey: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || items.length === 0) return;
    const values = new FormData(event.currentTarget);
    const customer = {
      name: String(values.get("name")).trim(),
      email: String(values.get("email")).trim(),
      address: String(values.get("address")).trim(),
    };
    const payment = values.get("payment") === "declined" ? "declined" : "approved";
    const intent = JSON.stringify({ items, customer, payment });
    const checkoutKey = retry.current?.intent === intent ? retry.current.checkoutKey : crypto.randomUUID();
    retry.current = { intent, checkoutKey };
    setError("");
    setSubmitting(true);
    onPending(true);

    try {
      onConfirmation(await api.checkout(slug, { checkoutKey, items, customer, payment }));
    } catch (cause) {
      setError(errorMessage(cause, "No pudimos confirmar el pedido. Tu carrito sigue disponible.", {
        400: "Revisa tus datos de contacto y la cantidad de productos.",
        402: "El pago de prueba fue rechazado. Tu carrito sigue disponible. Puedes elegir un pago aprobado y volver a intentar.",
        404: "La tienda o algún producto ya no está disponible. Vuelve a consultar el catálogo.",
        409: "Las existencias cambiaron. Actualiza el catálogo y ajusta las cantidades.",
      }));
    } finally {
      setSubmitting(false);
      onPending(false);
    }
  }

  return (
    <section className="mt-6 border-t border-border pt-6" aria-labelledby="checkout-title">
      <h3 id="checkout-title" className="text-xl font-extrabold">Finalizar compra de prueba</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Compra como invitado. Usa datos ficticios y elige un resultado de pago para la demostración.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <Field label="Nombre">
          <input name="name" required maxLength={160} autoComplete="off" className={fieldClass} />
        </Field>
        <Field label="Correo electrónico">
          <input name="email" type="email" required maxLength={254} autoComplete="off" className={fieldClass} />
        </Field>
        <Field label="Dirección de prueba">
          <textarea name="address" rows={2} required maxLength={500} autoComplete="off" className={fieldClass} />
        </Field>
        <Field label="Resultado del pago simulado">
          <select name="payment" className={fieldClass} defaultValue="approved">
            <option value="approved">Pago aprobado</option>
            <option value="declined">Pago rechazado</option>
          </select>
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <button type="submit" className={actionClass} disabled={submitting}>
          {submitting ? "Procesando pedido…" : "Simular pago y confirmar pedido"}
        </button>
      </form>
    </section>
  );
}
