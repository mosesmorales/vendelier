import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Vendelier Super Admin",
  robots: { index: false, follow: false },
};

export default function ControlLayout({ children }: { children: ReactNode }) {
  return <div data-theme-scope="corporate">{children}</div>;
}
