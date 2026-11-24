import type { ReactNode } from "react";

export const actionClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-on-accent transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60";

export const fieldClass =
  "block min-h-11 w-full rounded-lg border border-muted/50 bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted";

export const panelClass = "rounded-panel border border-border bg-surface p-5 sm:p-6";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: { id: string; text: string };
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5 text-sm">
      <label className="grid gap-1.5 font-bold">
        <span>{label}</span>
        {children}
      </label>
      {hint && <p id={hint.id} className="text-muted">{hint.text}</p>}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : undefined}
      aria-live={kind === "success" ? "polite" : undefined}
      className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
        kind === "error"
          ? "border-danger/40 bg-danger/10 text-danger"
          : "border-success/40 bg-success/10 text-success"
      }`}
    >
      {children}
    </p>
  );
}
