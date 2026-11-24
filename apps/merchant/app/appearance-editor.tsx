"use client";

import {
  api,
  errorMessage,
  errorStatus,
  studioMediaUrl,
  websiteLoginUrl,
  type AppearanceState,
  type AppearanceTheme,
  type ThemeMode,
  type ThemePalette,
  type ThemeScope,
  type Product,
} from "@vendelier/api-client";
import {
  actionClass,
  appearanceStyle,
  fieldClass,
  formatMoney,
  Field,
  MediaImage,
  Notice,
  panelClass,
  secondaryClass,
  textContrast,
} from "@vendelier/ui";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, Globe, Image as ImageIcon, LayoutDashboard, Monitor, Moon, Package, Palette, Save, ShoppingBag, Smartphone, Sun, Tablet, Upload } from "lucide-react";
import { MediaUrlField } from "./media-url-field";

const scopeLabels = { studio: "Studio", storefront: "Storefront" } satisfies Record<ThemeScope, string>;
const modeLabels = { light: "claro", dark: "oscuro" } satisfies Record<ThemeMode, string>;
const surfaceToneLabels = { light: "clara", dark: "oscura" } satisfies Record<ThemeMode, string>;
const colorLabels = {
  background: "Fondo",
  surface: "Superficie",
  text: "Texto",
  accent: "Acento",
} satisfies Record<keyof ThemePalette, string>;
const scopeOptions = ["studio", "storefront"] as const;
const modeOptions = ["light", "dark"] as const;
const colorOptions = ["background", "surface", "text", "accent"] as const;


const viewports = [
  { id: "desktop", label: "Vista de escritorio", Icon: Monitor },
  { id: "tablet", label: "Vista de tableta", Icon: Tablet },
  { id: "phone", label: "Vista móvil", Icon: Smartphone },
] as const;

type PreviewWidth = (typeof viewports)[number]["id"];
const segmentedClass = "flex shrink-0 gap-0.5 rounded-lg bg-inset p-0.5";
const segmentClass = "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md px-2.5 text-xs font-semibold text-muted hover:text-foreground aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-sm disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-9 sm:min-w-9";

interface AppearanceEditorProps {
  studioName: string;
  publicUrl?: string;
  products: Product[];
  onPublishStudio: (theme: AppearanceTheme | null) => void;
}

export function AppearanceEditor({ studioName, publicUrl, products, onPublishStudio }: AppearanceEditorProps) {
  const [themes, setThemes] = useState<AppearanceState>();
  const [edits, setEdits] = useState<Partial<Record<ThemeScope, AppearanceTheme>>>({});
  const [conflicts, setConflicts] = useState<Partial<Record<ThemeScope, boolean>>>({});
  const [scope, setScope] = useState<ThemeScope>("studio");
  const [mode, setMode] = useState<ThemeMode>("light");
  const [viewport, setViewport] = useState<PreviewWidth>("desktop");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmation, setConfirmation] = useState<"pointer" | "keyboard" | null>(null);
  const confirming = confirmation !== null;
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const publishButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const returnToPublish = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    api.appearance(controller.signal).then((data) => {
      setThemes(data);
      setLoading(false);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setError(loadError(cause));
      setSessionExpired(errorStatus(cause) === 401);
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  useLayoutEffect(() => {
    if (confirming) {
      confirmButton.current?.focus();
    } else if (returnToPublish.current) {
      returnToPublish.current = false;
      publishButton.current?.focus();
    }
  }, [confirming]);

  const state = themes?.[scope];
  const draft = edits[scope] ?? state?.draft;
  const dirty = JSON.stringify(draft) !== JSON.stringify(state?.draft);
  const draftContrast = draft && modeOptions.map((entry) => ({ mode: entry, contrast: textContrast(draft[entry]) }));
  const lowContrast = draftContrast?.filter((entry) => entry.contrast < 4.5) ?? [];
  const hasName = Boolean(draft?.displayName.trim());
  const disabled = working || importing || confirming || sessionExpired;
  const canPublish = !disabled && !conflicts[scope] && !dirty && hasName && lowContrast.length === 0;

  function switchScope(next: ThemeScope) {
    setScope(next);
    setConfirmation(null);
    setError("");
    setNotice("");
  }

  function edit(next: AppearanceTheme) {
    setEdits((current) => ({ ...current, [scope]: next }));
    setNotice("");
  }

  function cancelPublish() {
    returnToPublish.current = true;
    setConfirmation(null);
  }

  function handleConfirmationKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelPublish();
    }
  }

  async function reload() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const data = await api.appearance();
      setThemes((current) => current ? { ...current, [scope]: data[scope] } : data);
      setEdits((current) => ({ ...current, [scope]: undefined }));
      setConflicts((current) => ({ ...current, [scope]: false }));
      setSessionExpired(false);
      if (scope === "studio") onPublishStudio(data.studio.published);
      setNotice("Borrador actualizado desde el servidor.");
    } catch (cause) {
      setError(loadError(cause));
      setSessionExpired(errorStatus(cause) === 401);
    } finally {
      setWorking(false);
    }
  }

  async function persist(action: "save" | "publish") {
    if (!draft || !state || working || importing || sessionExpired || conflicts[scope]) return;
    setWorking(true);
    setConfirmation(null);
    setNotice("");
    setError("");
    try {
      const updated = action === "publish"
        ? await api.publishAppearance(scope, state.revision)
        : await api.saveAppearance(scope, { ...draft, displayName: draft.displayName.trim() }, state.revision);
      setThemes((current) => current && ({ ...current, [scope]: updated }));
      setEdits((current) => ({ ...current, [scope]: undefined }));
      if (action === "publish" && scope === "studio") onPublishStudio(updated.published);
      setNotice(action === "save" ? "Borrador guardado." : `Tema de ${scopeLabels[scope]} publicado.`);
    } catch (cause) {
      if (errorStatus(cause) === 409) {
        setConflicts((current) => ({ ...current, [scope]: true }));
        return;
      }
      if (errorStatus(cause) === 401) setSessionExpired(true);
      setError(errorMessage(cause, "No pudimos guardar la apariencia. Inténtalo de nuevo.", {
        400: "Revisa el nombre, el contraste y las imágenes de este tema.",
        401: "Tu sesión terminó. Inicia sesión de nuevo para cambiar la apariencia.",
        403: "Tu cuenta no tiene permiso para cambiar la apariencia.",
        404: "Una imagen ya no está disponible. Quítala o vuelve a importarla.",
      }));
    } finally {
      setWorking(false);
    }
  }


  return (
    <section aria-label="Editor de apariencia y marca" className="grid min-w-0 gap-4">
      {loading && <p role="status" className={panelClass}>Cargando borradores…</p>}
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}
      {sessionExpired && <div><a href={websiteLoginUrl()} className={actionClass}>Volver a iniciar sesión</a></div>}
      {!loading && !sessionExpired && !state && (
        <div><button type="button" className={secondaryClass} disabled={working} onClick={reload}>Volver a intentar</button></div>
      )}
      {state && draft && !sessionExpired && (
        <>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className={segmentedClass} role="group" aria-label="Superficie de la marca">
                {scopeOptions.map((option) => (
                  <button key={option} type="button" aria-pressed={option === scope} disabled={disabled} className={segmentClass} onClick={() => switchScope(option)}>
                    {scopeLabels[option]}
                  </button>
                ))}
              </div>
              <p className="px-1 text-xs font-medium text-muted" aria-live="polite">
                {dirty ? "Cambios sin guardar" : state.published ? "Versión publicada " + state.version : "Sin tema publicado"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={secondaryClass} disabled={disabled || !dirty || !hasName || conflicts[scope]} onClick={() => persist("save")}>
                <Save size={16} aria-hidden="true" /> Guardar borrador
              </button>
              <button ref={publishButton} type="button" className={actionClass} disabled={!canPublish} onClick={(event) => setConfirmation(event.detail > 0 ? "pointer" : "keyboard")}>
                <Upload size={16} aria-hidden="true" /> Publicar tema
              </button>
            </div>
          </div>
          <p role="status" className={working ? "text-sm font-medium text-muted" : "sr-only"}>{working ? "Actualizando apariencia…" : ""}</p>
          {confirming && (
            <div className={`${panelClass} grid gap-3 ${confirmation === "pointer" ? "publish-confirmation-entry" : ""}`} role="group" aria-label="Confirmar publicación del tema">
              <p className="font-semibold">¿Publicar este tema en {scopeLabels[scope]}?</p>
              <p className="text-sm text-muted">El nombre, las imágenes y los colores guardados se aplicarán al publicar.</p>
              <div className="flex flex-wrap gap-2">
                <button ref={confirmButton} type="button" className={actionClass} onClick={() => persist("publish")} onKeyDown={handleConfirmationKey}>Confirmar publicación</button>
                <button type="button" className={secondaryClass} onClick={cancelPublish} onKeyDown={handleConfirmationKey}>Cancelar publicación</button>
              </div>
            </div>
          )}
          {conflicts[scope] && (
            <div className="grid justify-items-start gap-2">
              <Notice kind="error">Otra sesión actualizó este borrador. Recárgalo para continuar. Se descartarán tus cambios sin guardar de esta superficie.</Notice>
              <button type="button" className={secondaryClass} disabled={working} onClick={reload}>Recargar borrador</button>
            </div>
          )}

          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(19rem,0.86fr)_minmax(0,1.45fr)] 2xl:grid-cols-[minmax(21rem,0.78fr)_minmax(0,1.55fr)]">
            <div className="grid min-w-0 gap-4">
              <section className={panelClass + " grid gap-4"} aria-labelledby="brand-identity">
                <div className="flex items-center gap-2.5 border-b border-border pb-3">
                  <ImageIcon size={17} aria-hidden="true" className="shrink-0 text-muted" />
                  <h2 id="brand-identity" className="text-base font-semibold tracking-tight">Identidad y recursos</h2>
                </div>
                <Field label="Nombre visible">
                  <input className={fieldClass} value={draft.displayName} maxLength={120} disabled={disabled} required onChange={(event) => edit({ ...draft, displayName: event.target.value })} />
                </Field>
                <MediaUrlField key={scope + "-logo"} label="URL del logotipo" target="logo" imageId={draft.logoId} disabled={disabled} onChange={(logoId) => edit({ ...draft, logoId })} onPending={setImporting} />
                <div className="border-t border-border pt-4">
                  <MediaUrlField key={scope + "-banner"} label="URL del banner" target="banner" imageId={draft.bannerId} disabled={disabled} onChange={(bannerId) => edit({ ...draft, bannerId })} onPending={setImporting} />
                </div>
                {!hasName && <p className="text-sm font-semibold text-danger">Escribe un nombre visible para guardar.</p>}
              </section>

              <section className={panelClass + " grid gap-4"} aria-labelledby="brand-palette">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <Palette size={17} aria-hidden="true" className="shrink-0 text-muted" />
                    <h2 id="brand-palette" className="text-base font-semibold tracking-tight">Paleta de colores</h2>
                  </div>
                  {lowContrast.length === 0 && <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Contraste válido</span>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 min-[1400px]:grid-cols-2">
                  {modeOptions.map((entry) => (
                    <PaletteFields
                      key={entry}
                      mode={entry}
                      colors={draft[entry]}
                      disabled={disabled}
                      onChange={(palette) => edit({ ...draft, [entry]: palette })}
                    />
                  ))}
                </div>
                {lowContrast.length > 0 && (
                  <Notice kind="error">
                    El texto necesita un contraste mínimo de 4.5:1 para publicar. Ajusta el texto, el fondo o la superficie en modo {lowContrast.map((entry) => modeLabels[entry.mode]).join(" y ")}.
                  </Notice>
                )}
              </section>
            </div>

            <section className="min-w-0 rounded-panel bg-inset p-2.5 sm:p-3.5 xl:sticky xl:top-[5.25rem]" aria-labelledby="preview-title">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="preview-title" className="px-1 text-sm font-semibold">Vista previa</h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className={segmentedClass + " border border-border bg-surface"} role="group" aria-label="Tamaño de vista previa">
                    {viewports.map(({ id, label, Icon }) => (
                      <button type="button" key={id} title={label} aria-label={label} aria-pressed={id === viewport} className={segmentClass + " size-9 px-0"} onClick={() => setViewport(id)}>
                        <Icon size={16} aria-hidden="true" strokeWidth={1.8} />
                      </button>
                    ))}
                  </div>
                  <div className={segmentedClass + " border border-border bg-surface"} role="group" aria-label="Modo de vista previa">
                    {modeOptions.map((entry) => {
                      const Icon = entry === "light" ? Sun : Moon;
                      return <button type="button" key={entry} title={"Modo " + modeLabels[entry]} aria-label={"Modo " + modeLabels[entry]} aria-pressed={entry === mode} className={segmentClass + " size-9 px-0"} onClick={() => setMode(entry)}><Icon size={16} aria-hidden="true" strokeWidth={1.8} /></button>;
                    })}
                  </div>
                </div>
              </div>
              <ThemePreview mode={mode} theme={draft} fallbackName={studioName} scope={scope} viewport={viewport} products={products} publicUrl={publicUrl} />
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function PaletteFields({ mode, colors, disabled, onChange }: {
  mode: ThemeMode;
  colors: ThemePalette;
  disabled: boolean;
  onChange: (palette: ThemePalette) => void;
}) {
  return (
    <fieldset className="min-w-0 rounded-lg border border-border bg-inset/60 p-2.5" disabled={disabled}>
      <legend className="px-1 text-sm font-extrabold">Colores del modo {modeLabels[mode]}</legend>
      <div className="grid gap-2">
        {colorOptions.map((color) => (
          <label key={color} className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-semibold">
            <span>{colorLabels[color]}</span>
            <span className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted tabular-nums" aria-hidden="true">{colors[color].toUpperCase()}</span>
              <input
                className="size-11 cursor-pointer rounded-md border border-border bg-surface p-0.5 sm:size-9"
                aria-label={`${colorLabels[color]} ${color === "surface" ? surfaceToneLabels[mode] : modeLabels[mode]}`}
                type="color"
                value={colors[color].toLowerCase()}
                onChange={(event) => onChange({ ...colors, [color]: event.target.value })}
              />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}


function ThemePreview({ mode, theme, fallbackName, scope, viewport, products, publicUrl }: {
  mode: ThemeMode;
  theme: AppearanceTheme;
  fallbackName: string;
  scope: ThemeScope;
  viewport: PreviewWidth;
  products: Product[];
  publicUrl?: string;
}) {
  const name = theme.displayName.trim() || fallbackName;
  const storePreview = scope === "storefront";
  const widthClass = viewport === "phone" ? "max-w-[23rem]" : viewport === "tablet" ? "max-w-[34rem]" : "max-w-full";
  const columns = viewport === "phone" ? "grid-cols-1" : viewport === "tablet" ? "sm:grid-cols-2" : "sm:grid-cols-2 2xl:grid-cols-3";
  return (
    <div className={"mx-auto w-full overflow-hidden rounded-panel border border-border bg-surface " + widthClass}>
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5 py-1 text-xs text-muted">
          <Globe size={13} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{storePreview && publicUrl ? publicUrl.replace(/^https?:\/\//, "") : scopeLabels[scope]}</span>
        </div>
        {storePreview && publicUrl ? (
          <a href={publicUrl} target="_blank" rel="noreferrer" className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-inset" aria-label="Abrir tienda publicada">
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ) : <span aria-hidden="true" className="size-7 shrink-0" />}
      </div>
      <div data-tenant-theme="" data-appearance-mode={mode} style={appearanceStyle(theme)} className="min-w-0 bg-background text-foreground xl:max-h-[calc(100dvh-12rem)] xl:overflow-y-auto">
        <div className={"flex items-center justify-between gap-3 border-b px-3 py-3 sm:px-4 " + (storePreview ? "border-border bg-surface text-foreground" : "border-white/10 bg-rail text-white")}>
          <div className="flex min-w-0 items-center gap-2">
            {theme.logoId && <MediaImage src={studioMediaUrl(theme.logoId)} alt="Vista previa del logotipo" className="h-8 w-10 rounded-sm" sizes="40px" fit="contain" />}
            <p className="min-w-0 break-words text-sm font-semibold tracking-tight">{name}</p>
          </div>
          {storePreview ? <ShoppingBag size={17} aria-hidden="true" className="shrink-0 text-muted" /> : <LayoutDashboard size={17} aria-hidden="true" className="shrink-0 text-zinc-300" />}
        </div>
        {theme.bannerId && (
          <div className="px-3 pt-3 sm:px-4 sm:pt-4">
            <MediaImage src={studioMediaUrl(theme.bannerId)} alt="Vista previa del banner" className="h-18 w-full rounded-lg sm:h-24" sizes="(max-width: 640px) 90vw, 680px" />
          </div>
        )}
        <div className="min-w-0 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold tracking-tight">{storePreview ? "Catálogo" : "Resumen"}</h3>
            <span className="text-xs text-muted">{products.length} productos</span>
          </div>
          {storePreview ? (
            products.length ? (
              <ul className={"grid gap-2.5 " + columns}>
                {products.slice(0, 3).map((product) => (
                  <li key={product.id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface">
                    {product.imageId ? (
                      <MediaImage src={studioMediaUrl(product.imageId)} alt="" className="aspect-[4/3] w-full bg-inset" sizes="(max-width: 640px) 45vw, 220px" />
                    ) : (
                      <span aria-hidden="true" className="grid aspect-[4/3] place-items-center bg-inset text-muted"><Package size={20} /></span>
                    )}
                    <div className="p-2.5">
                      <p className="break-words text-sm font-semibold">{product.name}</p>
                      <p className="mt-1 text-xs text-muted">{formatMoney(product.priceCents)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">Agrega un producto para previsualizar el catálogo.</p>
          ) : (
            <dl className={"grid gap-2.5 " + (viewport === "phone" ? "grid-cols-1" : "sm:grid-cols-2")}>
              <div className="rounded-lg border border-border bg-surface p-3"><dt className="text-xs text-muted">Productos</dt><dd className="mt-1.5 text-xl font-semibold tabular-nums">{products.length}</dd></div>
              <div className="rounded-lg border border-border bg-surface p-3"><dt className="text-xs text-muted">Unidades en inventario</dt><dd className="mt-1.5 text-xl font-semibold tabular-nums">{products.reduce((sum, item) => sum + item.stock, 0)}</dd></div>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

function loadError(cause: unknown) {
  return errorMessage(cause, "No pudimos cargar los borradores.", {
    401: "Tu sesión terminó. Inicia sesión de nuevo para cambiar la apariencia.",
    403: "Tu cuenta no tiene permiso para consultar la apariencia.",
  });
}
