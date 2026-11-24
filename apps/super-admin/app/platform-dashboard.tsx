"use client";

import { api, errorMessage, errorStatus, storeUrl, websiteUrl, type PlatformOverview } from "@vendelier/api-client";
import { actionClass, DashboardShell, fieldClass, Field, formatMoney, Notice, panelClass, secondaryClass } from "@vendelier/ui";
import { VendelierWordmark } from "@vendelier/ui/brand";
import { useRef, useState, type FormEvent } from "react";

export function PlatformDashboard() {
  const [overview, setOverview] = useState<PlatformOverview>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const credential = useRef("");

  async function load(key: string) {
    setLoading(true);
    setError("");
    try {
      const data = await api.platform(key);
      credential.current = key;
      setOverview(data);
    } catch (cause) {
      if (errorStatus(cause) === 401 || errorStatus(cause) === 403) {
        credential.current = "";
        setOverview(undefined);
      }
      setError(errorMessage(cause, "No pudimos consultar la administración de plataforma.", {
        401: "La clave de demostración no es válida.",
        403: "La clave no tiene acceso a la plataforma.",
        503: "El acceso de plataforma no está configurado.",
      }));
    } finally {
      setLoading(false);
    }
  }

  function authorize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loading) void load(String(new FormData(event.currentTarget).get("platformKey")).trim());
  }

  function close() {
    credential.current = "";
    setOverview(undefined);
    setError("");
  }

  return (
    <DashboardShell
      brand={<VendelierWordmark />}
      surface="Super Admin"
      heading="Administración de plataforma"
      navigation={<a href={websiteUrl} className={`${secondaryClass} lg:mt-6`}>Volver a Vendelier</a>}
    >
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {!overview ? (
        <section className={`${panelClass} max-w-lg`} aria-labelledby="platform-access-title">
          <h2 id="platform-access-title" className="text-xl font-extrabold">Acceso de demostración</h2>
          <p className="mt-2 leading-relaxed text-muted">Introduce la clave de plataforma que configuraste en el entorno local.</p>
          <form onSubmit={authorize} className="mt-5 grid gap-4">
            <Field label="Clave de plataforma">
              <input className={fieldClass} name="platformKey" type="password" required autoComplete="off" />
            </Field>
            <button type="submit" className={actionClass} disabled={loading}>{loading ? "Consultando…" : "Consultar plataforma"}</button>
          </form>
        </section>
      ) : (
        <div className="grid gap-6">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={actionClass} disabled={loading} onClick={() => load(credential.current)}>Actualizar plataforma</button>
            <button type="button" className={secondaryClass} disabled={loading} onClick={close}>Cerrar acceso</button>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className={panelClass}>
              <dt className="text-sm font-bold text-muted">Tiendas registradas</dt>
              <dd className="mt-1 text-2xl font-extrabold">{overview.tenants.length}</dd>
            </div>
            <div className={panelClass}>
              <dt className="text-sm font-bold text-muted">Pedidos de prueba</dt>
              <dd className="mt-1 text-2xl font-extrabold">{overview.orderCount}</dd>
            </div>
            <div className={panelClass}>
              <dt className="text-sm font-bold text-muted">Ventas simuladas</dt>
              <dd className="mt-1 break-words text-2xl font-extrabold">{formatMoney(overview.revenueCents)}</dd>
            </div>
          </dl>
          <section aria-labelledby="tenants-title" className={panelClass}>
            <h2 id="tenants-title" className="text-xl font-extrabold">Tiendas</h2>
            {overview.tenants.length === 0 ? <p className="mt-4 text-muted">Aún no hay tiendas registradas.</p> : (
              <ul className="mt-2 divide-y divide-border">
                {overview.tenants.map((tenant) => (
                  <li key={tenant.slug} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="break-words font-bold">{tenant.name}</p>
                      <p className="break-words text-sm text-muted">{tenant.slug}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
                      <span className={tenant.status === "active" ? "text-success" : "text-danger"}>
                        {tenant.status === "active" ? "Activa" : "Suspendida"}
                      </span>
                      <span>{tenant.published ? "Publicada" : "Sin publicar"}</span>
                      {tenant.published && tenant.status === "active" && (
                        <a href={storeUrl(tenant.slug)} className={secondaryClass} target="_blank" rel="noreferrer" aria-label={`Visitar ${tenant.name}`}>Visitar tienda</a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
