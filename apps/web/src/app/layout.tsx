import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Locate",
  description: "Lend and borrow Robinhood Chain stock tokens. Earn USDG on shares you hold, or short them against USDG.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}>
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-muted-foreground">
            Robinhood Chain testnet. Prices mirror mainnet Chainlink feeds; USDG and most tokens here are testnet mocks with a faucet.
            Stock Tokens are not offered to US persons.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
