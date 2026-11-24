import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <section className="grid min-h-60 place-items-center rounded-panel border border-border bg-surface p-8 text-center">
      <div className="max-w-sm">
        <div aria-hidden="true" className="mx-auto mb-5 grid size-12 place-items-center rounded-xl bg-background">
          {icon}
        </div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-2 leading-relaxed text-muted">{description}</p>
      </div>
    </section>
  );
}
