import "@fontsource-variable/space-grotesk";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import vendelierIcon from "../../../resources/kit_logos/app_icon.svg";

export const metadata: Metadata = {
  icons: { icon: vendelierIcon.src },
  title: "Vendelier | The Art of Commerce",
  description: "Una plataforma de comercio electrónico para negocios independientes.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX" data-theme-scope="corporate">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
