"use client";

import { api, errorMessage, studioMediaUrl } from "@vendelier/api-client";
import { Field, MediaImage, Notice, fieldClass, secondaryClass } from "@vendelier/ui";
import { Link2 } from "lucide-react";
import { useId, useState } from "react";

interface MediaUrlFieldProps {
  label: string;
  target: "logo" | "banner" | "imagen";
  imageId: string | null;
  disabled?: boolean;
  onChange: (id: string | null) => void;
  onPending: (pending: boolean) => void;
}

export function MediaUrlField({ label, target, imageId, disabled, onChange, onPending }: MediaUrlFieldProps) {
  const hintId = useId();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const assetThumbnail = imageId && target !== "imagen";

  async function importImage() {
    if (disabled || pending) return;
    setError("");
    const url = parseImageUrl(value);
    if (!url) {
      setError("Ingresa una URL pública HTTPS de una imagen PNG, JPG o WebP.");
      return;
    }
    setPending(true);
    onPending(true);
    try {
      const imported = await api.importMedia(url.href);
      onChange(imported.id);
      setValue("");
    } catch (cause) {
      setError(errorMessage(cause, "No pudimos importar la imagen. Revisa el enlace o prueba otro archivo.", {
        400: "La URL o el archivo no son válidos. Usa una imagen pública HTTPS en formato PNG, JPG o WebP.",
        401: "Tu sesión terminó. Inicia sesión de nuevo para importar imágenes.",
        413: "La imagen excede el tamaño permitido. Prueba con un archivo más ligero.",
        415: "El archivo no es una imagen PNG, JPG o WebP compatible.",
        422: "No se pudo leer la imagen. Verifica el enlace y el formato.",
        429: "Hay demasiadas solicitudes de importación. Inténtalo en unos minutos.",
        502: "No pudimos descargar la imagen. Prueba con otro enlace público.",
      }));
    } finally {
      setPending(false);
      onPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className={assetThumbnail ? "grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-3" : undefined}>
        {assetThumbnail && (
          <MediaImage src={studioMediaUrl(imageId)} alt="" className="mt-6 size-12 rounded-lg bg-inset" sizes="48px" fit={target === "logo" ? "contain" : "cover"} />
        )}
        <Field label={label} hint={{ id: hintId, text: "Enlace HTTPS directo a PNG, JPG o WebP." }}>
          <input
            className={fieldClass}
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://…"
            value={value}
            aria-describedby={hintId}
            disabled={disabled || pending}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void importImage();
              }
            }}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={secondaryClass} disabled={disabled || pending || !value.trim()} onClick={importImage}>
          <Link2 size={15} aria-hidden="true" />
          {pending ? "Importando…" : `Importar ${target}`}
        </button>
        {imageId && (
          <button
            type="button"
            className={secondaryClass}
            disabled={disabled || pending}
            onClick={() => { onChange(null); setError(""); setValue(""); }}
          >
            Quitar {target}
          </button>
        )}
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {target === "imagen" && imageId && (
        <MediaImage
          src={studioMediaUrl(imageId)}
          alt="Vista previa de la imagen del producto"
          className="aspect-video max-w-sm rounded-lg bg-background"
          fit="contain"
          sizes="(max-width: 640px) 90vw, 384px"
        />
      )}
    </div>
  );
}

function parseImageUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url : undefined;
  } catch {
    return undefined;
  }
}
