import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "CREOTEC · Dashboard Comercial y Operativo",
  description:
    "Dashboard de servicios de prótesis y plantillas — CREOTEC (Bolivia)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${outfit.variable}`}>
      <body className="antialiased font-sans bg-[#0A192F] text-slate-100 min-h-screen selection:bg-teal-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
