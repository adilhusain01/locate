import type { Metadata } from "next";
import { Bricolage_Grotesque, Onest, Geist_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], axes: ["opsz", "wdth"] });
const sans = Onest({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Locate",
  description: "The first on-chain stock lending and borrowing market for Robinhood Chain stock tokens. Earn USDG on shares you hold, or short them against USDG, around the clock.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${sans.variable} ${mono.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}>{children}</body>
    </html>
  );
}
