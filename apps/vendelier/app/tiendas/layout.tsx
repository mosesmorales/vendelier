import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Storefront | Atelier",
  robots: { index: false, follow: false },
};

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return <div data-theme-scope="storefront">{children}</div>;
}
