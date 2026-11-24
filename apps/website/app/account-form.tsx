"use client";

import { api, errorMessage, studioUrl } from "@vendelier/api-client";
import { actionClass, fieldClass, Field, Notice, panelClass } from "@vendelier/ui";
import { useState, type FormEvent } from "react";

type AccountMode = "register" | "login";

export function AccountForm({ initialMode }: { initialMode: AccountMode }) {
  const [mode, setMode] = useState(initialMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const registering = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const values = new FormData(event.currentTarget);
    const credentials = {
      email: String(values.get("email")).trim(),
      password: String(values.get("password")),
    };
    setSubmitting(true);
    setError("");
    try {
      if (registering) {
        await api.register({
          ...credentials,
          storeName: String(values.get("storeName")).trim(),
          slug: String(values.get("slug")).trim(),
        });
      } else {
        await api.login(credentials);
      }
      window.location.assign(studioUrl);
    } catch (cause) {
      setError(errorMessage(cause, "No pudimos completar el acceso. Inténtalo de nuevo.", {
        400: "Revisa los datos del formulario.",
        401: "El correo o la contraseña no coinciden.",
        403: "Esta cuenta no tiene acceso a Studio.",
        409: "Ese correo o identificador de tienda ya está registrado.",
      }));
      setSubmitting(false);
    }
  }

  return (
    <section id="acceso" className={panelClass + " scroll-mt-4 sm:p-7"} aria-labelledby="account-title">
      <div className="mb-6 grid grid-cols-2 gap-2 border-b border-border">
        {(["register", "login"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            disabled={submitting}
            className="-mb-px min-h-11 cursor-pointer border-b-2 border-transparent px-2 text-sm font-medium text-muted hover:text-foreground aria-pressed:border-foreground aria-pressed:font-semibold aria-pressed:text-foreground disabled:opacity-60"
            onClick={() => { setMode(option); setError(""); }}
          >
            {option === "register" ? "Crear tienda" : "Iniciar sesión"}
          </button>
        ))}
      </div>
      <h2 id="account-title" className="text-2xl font-semibold tracking-[-0.035em]">
        {registering ? "Crea tu tienda de prueba" : "Entra a Studio"}
      </h2>
      <form key={mode} onSubmit={submit} className="mt-5 grid gap-4">
        {registering && (
          <>
            <Field label="Nombre de la tienda">
              <input className={fieldClass} name="storeName" required maxLength={120} placeholder="Taller Nube" />
            </Field>
            <Field label="Identificador público" hint={{ id: "registration-slug-hint", text: "Usa letras minúsculas, números y guiones." }}>
              <input className={fieldClass} name="slug" required maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="taller-nube" autoCapitalize="none" spellCheck={false} aria-describedby="registration-slug-hint" />
            </Field>
          </>
        )}
        <Field label="Correo electrónico">
          <input className={fieldClass} type="email" name="email" required maxLength={254} autoComplete="username" />
        </Field>
        <Field label="Contraseña" hint={registering ? { id: "registration-password-hint", text: "Usa al menos 8 caracteres." } : undefined}>
          <input className={fieldClass} type="password" name="password" required minLength={8} maxLength={128} autoComplete={registering ? "new-password" : "current-password"} aria-describedby={registering ? "registration-password-hint" : undefined} />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <button type="submit" disabled={submitting} className={actionClass + " mt-1"}>
          {submitting ? "Conectando…" : registering ? "Crear tienda y entrar a Studio" : "Iniciar sesión en Studio"}
        </button>
      </form>
    </section>
  );
}
