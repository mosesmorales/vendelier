import { actionClass, panelClass } from "@vendelier/ui";
import { VendelierWordmark } from "@vendelier/ui/brand";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6 py-16">
      <section className={`${panelClass} grid w-full gap-4 p-8`}>
        <VendelierWordmark tone="auto" width={132} />
        <h1 className="text-2xl font-bold tracking-tight">Página no encontrada</h1>
        <p className="text-sm leading-relaxed text-muted">
          No encontramos la ruta solicitada o la tienda aún no está disponible.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/" className={actionClass}>Ir al inicio</Link>
          <Link href="/tiendas" className="inline-flex min-h-10 items-center text-sm font-semibold underline underline-offset-4">
            Explorar tiendas
          </Link>
        </div>
      </section>
    </main>
  );
}
