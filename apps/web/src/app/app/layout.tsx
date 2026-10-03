import { Providers } from "@/components/providers";
import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <Nav />
      <main className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 py-6">{children}</main>
      <footer className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-10 text-xs text-muted-foreground">
        Robinhood Chain testnet. Prices mirror mainnet Chainlink feeds; USDG and most tokens here are testnet mocks with a faucet.
        Stock Tokens are not offered to US persons.
      </footer>
    </Providers>
  );
}
