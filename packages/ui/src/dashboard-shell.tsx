import type { CSSProperties, ReactNode } from "react";
import { SkipLink } from "./skip-link";

interface DashboardShellProps {
  brand: ReactNode;
  surface: string;
  heading: string;
  theme?: CSSProperties;
  banner?: ReactNode;
  navigation?: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ brand, surface, heading, theme, banner, navigation, children }: DashboardShellProps) {
  return (
    <div data-tenant-theme={theme ? "" : undefined} style={theme} className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <div className="min-h-screen lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-5 py-4 lg:flex-col lg:items-start lg:justify-start lg:border-r lg:border-b-0 lg:px-6 lg:py-8">
          {brand}
          <p className="text-sm font-semibold text-muted">{surface}</p>
          {navigation}
        </header>
        <main id="main-content" tabIndex={-1} className="w-full max-w-7xl px-5 py-8 sm:px-8 lg:p-10">
          {banner}
          <h1 className="mb-7 break-words text-3xl font-extrabold tracking-tight sm:text-4xl">
            {heading}
          </h1>
          {children}
        </main>
      </div>
    </div>
  );
}
