import { platformUrl, storefrontUrl } from "@vendelier/api-client";
import { quietClass, SkipLink } from "@vendelier/ui";
import { VendelierMark, VendelierWordmark } from "@vendelier/ui/brand";
import { ArrowUpRight, Boxes, Palette, Receipt } from "lucide-react";
import { AccountForm } from "./account-form";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ mode?: string | string[] }> }) {
  const { mode } = await searchParams;
  const initialMode = mode === "login" ? "login" : "register";

  return (
    <>
      <SkipLink />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 sm:px-8">
          <VendelierWordmark width={144} />
          <a className={quietClass} href={storefrontUrl}>Visitar una tienda <ArrowUpRight size={15} aria-hidden="true" /></a>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto grid max-w-6xl items-start gap-8 px-4 py-8 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(21rem,0.78fr)] lg:gap-16 lg:py-16">
        <section className="min-w-0 pt-1 lg:pt-8" aria-labelledby="hero-title">
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.13em] text-muted uppercase">
            <span aria-hidden="true" className="size-2 rounded-full bg-accent" /> The Art of Commerce
          </p>
          <h1 id="hero-title" className="mt-4 max-w-[13.5ch] text-[clamp(2.55rem,6vw,4.75rem)] leading-[0.99] font-semibold tracking-[-0.062em]">
            Tu marca, tu tienda en línea.
          </h1>
          <p className="mt-5 max-w-[40ch] text-base leading-7 text-muted sm:text-lg">
            Personaliza tu escaparate y gestiona el catálogo y los pedidos desde el mismo lugar.
          </p>
          <div className="mt-7 flex items-center gap-3 border-t border-border pt-5 sm:mt-9">
            <div aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-lg bg-rail"><VendelierMark /></div>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-medium text-muted">
              <li className="flex items-center gap-1.5"><Boxes size={15} aria-hidden="true" /> Catálogo</li>
              <li className="flex items-center gap-1.5"><Palette size={15} aria-hidden="true" /> Marca</li>
              <li className="flex items-center gap-1.5"><Receipt size={15} aria-hidden="true" /> Pedidos</li>
            </ul>
          </div>
        </section>
        <AccountForm key={initialMode} initialMode={initialMode} />
      </main>
      <footer className="mx-auto flex max-w-6xl justify-end px-4 pb-6 sm:px-8">
        <a className="inline-flex items-center gap-1.5 text-sm font-medium text-muted underline-offset-4 hover:underline" href={platformUrl}>Administración de plataforma <ArrowUpRight size={14} aria-hidden="true" /></a>
      </footer>
    </>
  );
}
