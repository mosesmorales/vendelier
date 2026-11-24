"use client";

import { actionClass, fieldClass, Field } from "@vendelier/ui";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

export function StoreEntry() {
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = String(new FormData(event.currentTarget).get("slug")).trim();
    router.push(`/${encodeURIComponent(slug)}`);
  }

  return (
    <form onSubmit={submit} className="mt-7 grid items-start gap-4 border-t border-border/70 pt-5">
      <Field label="Identificador de la tienda" hint={{ id: "store-slug-hint", text: "Lo encontrarás al final del enlace público del comercio." }}>
        <input name="slug" className={fieldClass} required maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" autoCapitalize="none" spellCheck={false} placeholder="taller-nube" aria-describedby="store-slug-hint" />
      </Field>
      <button type="submit" className={`${actionClass} min-h-11 sm:justify-self-start`}>Abrir catálogo</button>
    </form>
  );
}
