import { websiteUrl } from "@vendelier/api-client";
import { SkipLink } from "@vendelier/ui";
import { ArrowUpRight, Store } from "lucide-react";
import Link from "next/link";
import { StoreEntry } from "./store-entry";

export default function StorefrontPage() {
  return (
    <>
      <SkipLink />
      <header className="border-b border-border/70 bg-surface">
        <div className="mx-auto flex min-h-15 max-w-[86rem] items-center justify-between gap-2 px-5 sm:px-8">
          <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"><Store size={18} strokeWidth={1.6} aria-hidden="true" /> Atelier</span>
          <Link className="inline-flex min-h-10 items-center gap-1 rounded-sm text-sm font-medium text-muted hover:text-foreground" href={websiteUrl}>
            Vendelier <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[35rem] px-5 py-16 sm:py-24">
        <section aria-labelledby="entry-title">
          <h1 id="entry-title" className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Visita una tienda</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">Abre el catálogo con el enlace que compartió el comercio o con su identificador.</p>
          <StoreEntry />
        </section>
      </main>
    </>
  );
}
