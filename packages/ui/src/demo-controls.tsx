import type { ReactNode } from "react";

export const actionClass =
  "press-feedback inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10";

export const secondaryClass =
  "press-feedback inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium hover:bg-inset disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10";

export const quietClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-inset disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10";

export const fieldClass =
  "block min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-normal text-foreground placeholder:text-muted focus:border-focus disabled:opacity-55 sm:min-h-10";

export const panelClass = "min-w-0 rounded-panel border border-border bg-surface p-4 sm:p-5";

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
      <label className="grid gap-1.5 font-semibold">
        <span>{label}</span>
        {children}
      </label>
      {hint && <p id={hint.id} className="text-xs leading-relaxed text-muted">{hint.text}</p>}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
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
