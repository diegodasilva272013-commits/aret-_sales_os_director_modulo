import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["300","400","500","600","700","800"] });

export const metadata: Metadata = {
  title: "Areté Sales OS",
  description: "Módulo Director de Ventas — Areté Soluciones",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} antialiased min-h-screen`} style={{ backgroundColor: '#080B14', color: '#F9FAFB' }}>
        {children}
      </body>
    </html>
  );
}
