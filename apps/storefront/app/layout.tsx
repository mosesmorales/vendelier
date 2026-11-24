import "@fontsource-variable/urbanist";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Storefront | Atelier",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX" data-theme-scope="storefront">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
