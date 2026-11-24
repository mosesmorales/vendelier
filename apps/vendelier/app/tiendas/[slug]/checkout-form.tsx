"use client";

import { api, errorMessage, errorStatus, type CheckoutInput, type Order } from "@vendelier/api-client";
import { actionClass, fieldClass, Field, Notice } from "@vendelier/ui";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";

interface CheckoutFormProps {
  slug: string;
  items: CheckoutInput["items"];
  onPending: (pending: boolean) => void;
  onConfirmation: (order: Order, fromPointer: boolean) => void;
}

export function CheckoutForm({ slug, items, onPending, onConfirmation }: CheckoutFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [declined, setDeclined] = useState(false);
  const retry = useRef<{ intent: string; checkoutKey: string } | null>(null);
  const paymentField = useRef<HTMLSelectElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const submitFromPointer = useRef(false);

  useLayoutEffect(() => {
    if (!error || submitting) return;
    if (declined) paymentField.current?.focus();
    else errorSummary.current?.focus();
  }, [declined, error, submitting]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || items.length === 0) return;
    const values = new FormData(event.currentTarget);
    const fromPointer = submitFromPointer.current;
    submitFromPointer.current = false;
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
    setDeclined(false);
    setSubmitting(true);
    onPending(true);

    try {
      onConfirmation(await api.checkout(slug, { checkoutKey, items, customer, payment }), fromPointer);
    } catch (cause) {
      setDeclined(errorStatus(cause) === 402);
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
    <section className="mt-5 border-t border-border/70 pt-5" aria-labelledby="checkout-title">
      <h3 id="checkout-title" className="text-lg font-semibold tracking-tight">Finalizar compra de prueba</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        Usa datos ficticios y elige un resultado de pago simulado.
      </p>
      <p role="status" className="sr-only">{submitting ? "Procesando pedido…" : ""}</p>
      <form onSubmit={submit} className="mt-4" aria-busy={submitting}>
        <fieldset disabled={submitting} className="grid min-w-0 gap-3">
          <Field label="Nombre">
            <input name="name" required maxLength={160} autoComplete="off" className={fieldClass} />
          </Field>
          <Field label="Correo electrónico">
            <input name="email" type="email" required maxLength={254} autoComplete="off" className={fieldClass} />
          </Field>
          <Field label="Dirección de prueba">
            <textarea name="address" rows={2} required maxLength={500} autoComplete="off" className={fieldClass} />
          </Field>
          <div className="grid gap-1.5 text-sm">
            <label htmlFor="checkout-payment" className="font-semibold">Resultado del pago simulado</label>
            <select ref={paymentField} id="checkout-payment" name="payment" className={fieldClass} defaultValue="approved" aria-describedby={error && declined ? "checkout-error" : undefined}>
              <option value="approved">Pago aprobado</option>
              <option value="declined">Pago rechazado</option>
            </select>
          </div>
          {error && <div id="checkout-error" ref={errorSummary} tabIndex={-1}><Notice kind="error">{error}</Notice></div>}
          <button type="submit" className={actionClass} onClick={(event) => { submitFromPointer.current = event.detail > 0; }}>
            {submitting ? "Procesando pedido…" : "Simular pago y confirmar pedido"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
