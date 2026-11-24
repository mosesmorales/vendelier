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
} from "@vendelier/api-client";
import {
  actionClass,
  appearanceStyle,
  fieldClass,
  Field,
  MediaImage,
  Notice,
  panelClass,
  secondaryClass,
  textContrast,
} from "@vendelier/ui";
import { useEffect, useRef, useState } from "react";
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

interface AppearanceEditorProps {
  studioName: string;
  onPublishStudio: (theme: AppearanceTheme | null) => void;
}

export function AppearanceEditor({ studioName, onPublishStudio }: AppearanceEditorProps) {
  const [themes, setThemes] = useState<AppearanceState>();
  const [edits, setEdits] = useState<Partial<Record<ThemeScope, AppearanceTheme>>>({});
  const [conflicts, setConflicts] = useState<Partial<Record<ThemeScope, boolean>>>({});
  const [scope, setScope] = useState<ThemeScope>("studio");
  const [mode, setMode] = useState<ThemeMode>("light");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const publishButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
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
    setConfirming(false);
    setError("");
    setNotice("");
  }

  function edit(next: AppearanceTheme) {
    setEdits((current) => ({ ...current, [scope]: next }));
    setNotice("");
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
    setConfirming(false);
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
    <section id="apariencia" className="scroll-mt-4" aria-labelledby="appearance-title">
      <div className="mb-4">
        <h2 id="appearance-title" className="text-2xl font-extrabold">Apariencia y marca</h2>
        <p className="mt-1 text-sm text-muted">Personaliza y publica la identidad de cada superficie de tu tienda.</p>
      </div>
      {loading && <p role="status">Cargando borradores…</p>}
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
      {sessionExpired && <a href={websiteLoginUrl()} className={actionClass}>Volver a iniciar sesión</a>}
      {!loading && !sessionExpired && !state && (
        <button type="button" className={secondaryClass} disabled={working} onClick={reload}>Volver a intentar</button>
      )}
      {state && draft && !sessionExpired && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2" role="group" aria-label="Superficie de la marca">
              {scopeOptions.map((option) => (
                <button key={option} type="button" aria-pressed={option === scope} disabled={disabled} className={option === scope ? actionClass : secondaryClass} onClick={() => switchScope(option)}>
                  {scopeLabels[option]}
                </button>
              ))}
            </div>
            <p className="text-sm font-semibold text-muted">{state.published ? `Versión publicada: ${state.version}` : "Sin tema publicado"}</p>
          </div>
          {conflicts[scope] && (
            <div className="mb-4 grid justify-items-start gap-2">
              <Notice kind="error">Otra sesión actualizó este borrador. Recárgalo para continuar. Se descartarán tus cambios sin guardar de esta superficie.</Notice>
              <button type="button" className={secondaryClass} disabled={working} onClick={reload}>Recargar borrador</button>
            </div>
          )}

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,0.75fr)]">
            <div className={`${panelClass} grid gap-5`}>
              <Field label="Nombre visible">
                <input className={fieldClass} value={draft.displayName} maxLength={120} disabled={disabled} required onChange={(event) => edit({ ...draft, displayName: event.target.value })} />
              </Field>
              <MediaUrlField key={`${scope}-logo`} label="URL del logotipo" target="logo" imageId={draft.logoId} disabled={disabled} onChange={(logoId) => edit({ ...draft, logoId })} onPending={setImporting} />
              <MediaUrlField key={`${scope}-banner`} label="URL del banner" target="banner" imageId={draft.bannerId} disabled={disabled} onChange={(bannerId) => edit({ ...draft, bannerId })} onPending={setImporting} />
              <div className="grid gap-3 sm:grid-cols-2">
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
              {!hasName && <p className="text-sm font-semibold text-danger">Escribe un nombre visible para guardar.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryClass} disabled={disabled || !dirty || !hasName || conflicts[scope]} onClick={() => persist("save")}>
                  Guardar borrador
                </button>
                <button ref={publishButton} type="button" className={actionClass} disabled={!canPublish} onClick={() => setConfirming(true)}>
                  Publicar tema
                </button>
              </div>
              {dirty && !working && <p className="text-sm text-muted">Guarda el borrador antes de publicarlo.</p>}
              {working && <p role="status" className="text-sm">Actualizando apariencia…</p>}
              {confirming && (
                <div className="grid gap-3 rounded-lg border border-border bg-background p-4" role="group" aria-label="Confirmar publicación del tema">
                  <p className="font-bold">¿Publicar este tema en {scopeLabels[scope]}?</p>
                  <p className="text-sm text-muted">El nombre, las imágenes y los colores guardados se aplicarán al publicar.</p>
                  <div className="flex flex-wrap gap-2">
                    <button ref={confirmButton} type="button" className={actionClass} onClick={() => persist("publish")}>Confirmar publicación</button>
                    <button
                      type="button"
                      className={secondaryClass}
                      onClick={() => {
                        setConfirming(false);
                        requestAnimationFrame(() => publishButton.current?.focus());
                      }}
                    >
                      Cancelar publicación
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`${panelClass} grid gap-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-extrabold">Vista previa</h3>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Modo de vista previa">
                  {modeOptions.map((entry) => (
                    <button type="button" key={entry} className={entry === mode ? actionClass : secondaryClass} aria-pressed={mode === entry} onClick={() => setMode(entry)}>
                      Modo {modeLabels[entry]}
                    </button>
                  ))}
                </div>
              </div>
              <ThemePreview mode={mode} theme={draft} fallbackName={studioName} label={scopeLabels[scope]} />
            </div>
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
    <fieldset className="min-w-0 rounded-lg border border-border p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-extrabold">Colores del modo {modeLabels[mode]}</legend>
      <div className="grid gap-2">
        {colorOptions.map((color) => (
          <label key={color} className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
            <span>{colorLabels[color]}</span>
            <span className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted tabular-nums" aria-hidden="true">{colors[color].toUpperCase()}</span>
              <input
                className="h-11 w-11 cursor-pointer rounded-lg border border-border bg-surface p-1"
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

function ThemePreview({ mode, theme, fallbackName, label }: {
  mode: ThemeMode;
  theme: AppearanceTheme;
  fallbackName: string;
  label: string;
}) {
  return (
    <div data-tenant-theme="" data-appearance-mode={mode} style={appearanceStyle(theme)} className="overflow-hidden rounded-lg border border-border bg-background text-foreground">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        {theme.logoId && <MediaImage src={studioMediaUrl(theme.logoId)} alt="Vista previa del logotipo" className="h-9 w-16" sizes="64px" fit="contain" />}
        <p className="min-w-0 break-words font-extrabold">{theme.displayName.trim() || fallbackName}</p>
      </div>
      {theme.bannerId && <MediaImage src={studioMediaUrl(theme.bannerId)} alt="Vista previa del banner" className="aspect-[3/1]" sizes="(max-width: 640px) 90vw, 360px" />}
      <div className="p-3">
        <p className="mb-2 text-sm font-bold">{label}</p>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="font-semibold">Catálogo</p>
          <span className="mt-3 inline-block rounded-lg bg-accent px-3 py-2 text-sm font-bold text-on-accent">Ver productos</span>
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
