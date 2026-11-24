import type { CSSProperties, ReactNode } from "react";
import { SkipLink } from "./skip-link";

interface DashboardShellProps {
  brand: ReactNode;
  surface: string;
  heading: string;
  theme?: CSSProperties;
  navigation?: ReactNode;
  workspace?: ReactNode;
  section?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export const dashboardLinkClass = "relative inline-flex min-h-11 w-full shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-300 hover:bg-white/7 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:font-semibold aria-[current=page]:text-white aria-[current=page]:after:absolute aria-[current=page]:after:inset-y-2 aria-[current=page]:after:left-0 aria-[current=page]:after:w-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-accent sm:min-h-10";

export function DashboardShell({ brand, surface, heading, theme, navigation, workspace, section, actions, children }: DashboardShellProps) {
  return (
    <div data-tenant-theme={theme ? "" : undefined} style={theme} className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <div className="min-h-screen lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="min-w-0 bg-rail text-white lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto" style={{ "--vd-focus": "#d2ef66" } as CSSProperties}>
          <div className="flex min-h-15 items-center justify-between gap-3 px-4 sm:px-5">
            {brand}
            <span className="shrink-0 text-xs font-medium text-zinc-400 lg:hidden">{surface}</span>
          </div>
          {workspace && <div className="px-4 pt-2 lg:pt-4">{workspace}</div>}
          {navigation && <div className="min-w-0 px-3 py-2 lg:px-4 lg:py-5">{navigation}</div>}
        </aside>
        <div className="min-w-0">
          <header className="border-b border-border bg-surface/95 backdrop-blur lg:sticky lg:top-0 lg:z-20">
            <div className="mx-auto flex min-h-15 max-w-[94rem] flex-wrap items-center justify-between gap-x-7 gap-y-2 px-4 py-2 sm:px-7 lg:px-9">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className={section ? "text-muted" : "font-semibold"}>{surface}</span>
                {section && <><span aria-hidden="true" className="text-muted">/</span><span className="font-semibold">{section}</span></>}
              </div>
              {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[94rem] px-4 pt-7 pb-12 sm:px-7 lg:px-9 lg:pt-9">
            <h1 className="mb-6 break-words text-[clamp(1.625rem,3.4vw,2.25rem)] leading-[1.1] font-semibold tracking-[-0.04em]">{heading}</h1>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export const metricGridClass = "grid divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0";

export function MetricCard({ label, value, icon, detail }: { label: string; value: string | number; icon: ReactNode; detail: string }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
      <dt className="flex items-center justify-between gap-3 text-sm font-medium text-muted">
        {label}
        <span aria-hidden="true" className="flex shrink-0 text-foreground/60">{icon}</span>
      </dt>
      <dd className="mt-3 wrap-break-word text-[clamp(1.375rem,3vw,2rem)] leading-none font-semibold tracking-[-0.045em] tabular-nums">{value}</dd>
      <dd className="mt-2 text-xs leading-5 text-muted">{detail}</dd>
    </div>
  );
}
