import { platformUrl, storefrontUrl } from "@vendelier/api-client";
import { secondaryClass, SkipLink } from "@vendelier/ui";
import { VendelierWordmark } from "@vendelier/ui/brand";
import { AccountForm } from "./account-form";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ mode?: string | string[] }> }) {
  const { mode } = await searchParams;
  const initialMode = mode === "login" ? "login" : "register";

  return (
    <>
      <SkipLink />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-4 sm:px-10">
          <VendelierWordmark />
          <a className={secondaryClass} href={storefrontUrl}>Visitar una tienda</a>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-10 sm:px-10 lg:py-16">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
          <section className="rounded-panel bg-[#141414] p-7 text-white sm:p-10 lg:p-14" aria-labelledby="hero-title">
            <p className="mb-6 font-semibold text-accent">The Art of Commerce</p>
            <h1 id="hero-title" className="max-w-[13ch] text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-6xl">
              Tu negocio, tu tienda en línea.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-sand">
              Publica tu catálogo, comparte el enlace de tu tienda y completa tu primera compra de prueba.
            </p>
            <ol className="mt-10 grid gap-3 text-sm font-semibold text-sand sm:grid-cols-3">
              <li className="border-t border-white/20 pt-3">1. Agrega productos</li>
              <li className="border-t border-white/20 pt-3">2. Publica tu tienda</li>
              <li className="border-t border-white/20 pt-3">3. Recibe un pedido</li>
            </ol>
          </section>
          <AccountForm key={initialMode} initialMode={initialMode} />
        </div>
      </main>
      <footer className="mx-auto flex max-w-7xl justify-end px-5 pb-6 sm:px-10">
        <a className="text-sm font-semibold text-muted underline underline-offset-4" href={platformUrl}>Administración de plataforma</a>
      </footer>
    </>
  );
}
