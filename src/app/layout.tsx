import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

// Tipografia: Serif para títulos, Sans para o corpo.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Accelera — V4 Company | Discador Automático",
  description:
    "Auto Dialer premium da V4 Company com detecção de secretária eletrônica (AMD) e transferência instantânea para operadores.",
  icons: {
    icon: "/v4logo.jpg",
    shortcut: "/v4logo.jpg",
    apple: "/v4logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans">
        {children}
        {/* Monitoramento obrigatório */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
