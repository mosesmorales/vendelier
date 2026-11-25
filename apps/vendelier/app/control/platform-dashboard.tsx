"use client";

import {
  api,
  errorMessage,
  errorStatus,
  storeUrl,
  websiteUrl,
  type PlatformOverview,
  type PlatformTenant,
} from "@vendelier/api-client";
import Link from "next/link";
import {
  actionClass,
  dashboardLinkClass,
  DashboardShell,
  fieldClass,
  Field,
  formatDate,
  formatMoney,
  MetricCard,
  metricGridClass,
  Notice,
  panelClass,
  quietClass,
  secondaryClass,
} from "@vendelier/ui";
import { VendelierWordmark } from "@vendelier/ui/brand";
import { ArrowLeft, ArrowUpRight, Building2, CircleDollarSign, History, LockKeyhole, Receipt, RefreshCw } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

export function PlatformDashboard() {
  const [overview, setOverview] = useState<PlatformOverview>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
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

  async function toggleStatus(tenant: PlatformTenant) {
    const nextStatus = tenant.status === "active" ? "suspended" : "active";
    setPendingSlug(tenant.slug);
    setError("");
    setNotice("");
    try {
      await api.setTenantStatus(credential.current, tenant.slug, nextStatus);
      await load(credential.current);
      setNotice(
        nextStatus === "suspended"
          ? `Tienda ${tenant.name} suspendida.`
          : `Tienda ${tenant.name} reactivada.`,
      );
    } catch (cause) {
      setError(errorMessage(cause, "No pudimos actualizar el estado de la tienda.", {
        401: "La clave de demostración ya no es válida.",
        404: "La tienda ya no existe.",
      }));
    } finally {
      setPendingSlug(null);
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
    setNotice("");
  }

  return (
    <DashboardShell
      brand={<VendelierWordmark tone="dark" width={132} />}
      surface="Super Admin"
      heading="Administración de plataforma"
      section={overview ? "Tiendas" : "Acceso"}
      navigation={
        <nav aria-label="Navegación de plataforma" className="flex flex-wrap gap-1 lg:grid">
          {overview && (
            <>
              <a className={dashboardLinkClass + " max-lg:w-auto"} aria-current="page" href="#tiendas">
                <Building2 size={17} aria-hidden="true" /> Tiendas
              </a>
              <a className={dashboardLinkClass + " max-lg:w-auto"} href="#auditoria">
                <History size={17} aria-hidden="true" /> Auditoría
              </a>
            </>
          )}
          <Link href={websiteUrl} className={dashboardLinkClass + " max-lg:w-auto"}>
            <ArrowLeft size={17} aria-hidden="true" /> Volver a Vendelier
          </Link>
        </nav>
      }
      actions={overview && (
        <>
          <button type="button" className={quietClass} disabled={loading} onClick={() => load(credential.current)}>
            <RefreshCw size={15} aria-hidden="true" /> Actualizar plataforma
          </button>
          <button type="button" className={secondaryClass} disabled={loading} onClick={close}>Cerrar acceso</button>
        </>
      )}
    >
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
      {!overview ? (
        <section className={`${panelClass} max-w-lg`} aria-labelledby="platform-access-title">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-inset text-muted">
              <LockKeyhole size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 id="platform-access-title" className="text-lg font-semibold tracking-tight">Acceso de demostración</h2>
              <p className="mt-1 text-sm leading-6 text-muted">Introduce la clave de plataforma configurada en el entorno local.</p>
            </div>
          </div>
          <form onSubmit={authorize} className="mt-5 grid gap-4">
            <Field label="Clave de plataforma">
              <input className={fieldClass} name="platformKey" type="password" required autoComplete="off" />
            </Field>
            <button type="submit" className={actionClass} disabled={loading}>
              {loading ? "Consultando…" : "Consultar plataforma"}
            </button>
          </form>
        </section>
      ) : (
        <div className="grid gap-6">
          <dl className={metricGridClass}>
            <MetricCard
              label="Tiendas registradas"
              value={overview.tenants.length}
              detail={`${overview.tenants.filter((tenant) => tenant.published).length} publicadas`}
              icon={<Building2 size={18} />}
            />
            <MetricCard
              label="Pedidos de prueba"
              value={overview.orderCount}
              detail="De todas las tiendas"
              icon={<Receipt size={18} />}
            />
            <MetricCard
              label="Ventas simuladas"
              value={formatMoney(overview.revenueCents)}
              detail="Total de pedidos aprobados"
              icon={<CircleDollarSign size={18} />}
            />
          </dl>

          <section id="tiendas" aria-labelledby="tenants-title" className={panelClass + " scroll-mt-20"}>
            <h2 id="tenants-title" className="text-lg font-semibold tracking-tight">Tiendas</h2>
            {overview.tenants.length === 0 ? (
              <p className="mt-4 text-muted">Aún no hay tiendas registradas.</p>
            ) : (
              <table className="mt-4 w-full table-fixed border-collapse text-left text-sm md:table-auto">
                <thead className="border-y border-border text-xs text-muted">
                  <tr>
                    <th scope="col" className="py-2.5 font-medium">Empresa</th>
                    <th scope="col" className="w-24 px-1.5 py-2.5 font-medium md:w-auto md:px-3">Estado</th>
                    <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Publicación</th>
                    <th scope="col" className="py-2.5 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {overview.tenants.map((tenant) => (
                    <tr key={tenant.slug}>
                      <td className="py-3 pr-1.5">
                        <p className="wrap-break-word font-semibold">{tenant.name}</p>
                        <p className="mt-0.5 wrap-break-word text-xs text-muted">{tenant.slug}</p>
                      </td>
                      <td className="px-1.5 py-3 text-xs md:px-3 md:text-sm">
                        <span className={"inline-flex items-center gap-1.5 font-medium " + (tenant.status === "active" ? "text-success" : "text-danger")}>
                          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
                          {tenant.status === "active" ? "Activa" : "Suspendida"}
                        </span>
                        <p className="mt-0.5 text-muted md:hidden">{tenant.published ? "Publicada" : "Sin publicar"}</p>
                      </td>
                      <td className="hidden px-3 py-3 text-muted md:table-cell">
                        {tenant.published ? "Publicada" : "Sin publicar"}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            className={quietClass}
                            disabled={loading || pendingSlug === tenant.slug}
                            onClick={() => toggleStatus(tenant)}
                          >
                            {pendingSlug === tenant.slug
                              ? "Actualizando…"
                              : tenant.status === "active"
                                ? "Suspender"
                                : "Activar"}
                          </button>
                          {tenant.published && tenant.status === "active" && (
                            <a href={storeUrl(tenant.slug)} className={quietClass} target="_blank" rel="noreferrer" aria-label={`Visitar ${tenant.name}`}>
                              <span className="hidden md:inline">Visitar tienda</span>
                              <ArrowUpRight size={16} aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section id="auditoria" aria-labelledby="audit-title" className={panelClass + " scroll-mt-20"}>
            <h2 id="audit-title" className="text-lg font-semibold tracking-tight">Auditoría reciente</h2>
            {overview.auditLogs.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Aún no hay eventos de administración registrados.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border border-t border-border text-sm">
                {overview.auditLogs.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <span className="font-semibold">{entry.targetSlug}</span>
                      <span className="mx-2 text-muted">·</span>
                      <span>{entry.action === "tenant.suspended" ? "Tienda suspendida" : "Tienda reactivada"}</span>
                    </div>
                    <span className="text-xs text-muted">{entry.actor} · {formatDate(entry.createdAt)}</span>
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
