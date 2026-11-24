import { websiteUrl } from "@vendelier/api-client";
import { panelClass, secondaryClass, SkipLink } from "@vendelier/ui";
import { StoreEntry } from "./store-entry";

export default function StorefrontPage() {
  return (
    <>
      <SkipLink />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-5 sm:px-8">
          <span className="text-xl font-extrabold tracking-tight">Atelier</span>
          <a className={secondaryClass} href={websiteUrl}>Vendelier</a>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-5 py-8 sm:py-16">
        <section className={panelClass} aria-labelledby="entry-title">
          <h1 id="entry-title" className="text-3xl font-extrabold tracking-tight">Visita una tienda</h1>
          <p className="mt-2 leading-relaxed text-muted">Usa el enlace que compartió el comercio o ingresa su identificador público.</p>
          <StoreEntry />
        </section>
      </main>
    </>
  );
}
