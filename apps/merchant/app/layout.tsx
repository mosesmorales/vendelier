import "@fontsource-variable/urbanist";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Merchant Studio",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX" data-theme-scope="studio">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
