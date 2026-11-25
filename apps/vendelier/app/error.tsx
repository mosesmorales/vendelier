"use client";

import { actionClass, panelClass, secondaryClass } from "@vendelier/ui";
import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6 py-16">
      <section className={`${panelClass} grid w-full gap-4 p-8`}>
        <h1 className="text-2xl font-bold tracking-tight">Ocurrió un error inesperado</h1>
        <p className="text-sm leading-relaxed text-muted">
          Algo falló al renderizar esta vista. Puedes reintentar o regresar al inicio.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="button" className={actionClass} onClick={reset}>Reintentar</button>
          <Link href="/" className={secondaryClass}>Volver al inicio</Link>
        </div>
      </section>
    </main>
  );
}
