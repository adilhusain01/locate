import Link from "next/link";

export function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t py-14 sm:py-20">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          {lead && <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">{lead}</p>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="max-w-prose space-y-4 text-[15px] leading-relaxed">{children}</div>;
}

export function Header() {
  const anchors = [
    ["#how", "How it works"],
    ["#prices", "Prices"],
    ["#liquidations", "Liquidations"],
    ["#stylus", "Stylus"],
    ["#safety", "Safety"],
  ];
  return (
    <header className="border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="shrink-0 text-base font-semibold tracking-tight">Locate</Link>
          <nav className="-mx-1 hidden gap-1 px-1 text-sm md:flex">
            {anchors.map(([href, label]) => (
              <a key={href} href={href} className="rounded-sm px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground">{label}</a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://github.com/adilhusain01/locate" className="hidden rounded-sm px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline" target="_blank" rel="noreferrer">GitHub</a>
          <Link href="/app" className="key inline-flex h-9 items-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground">Open app</Link>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t py-10 text-sm text-muted-foreground">
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <p className="font-medium text-foreground">Locate</p>
          <p className="mt-2 max-w-xs">Built for the Arbitrum Open House Singapore buildathon on Robinhood Chain testnet. Everything here is testnet: mock USDG, mock and faucet stock tokens, mirrored prices.</p>
        </div>
        <div>
          <p className="font-medium text-foreground">Read</p>
          <ul className="mt-2 space-y-1">
            <li><a className="hover:text-foreground" href="https://github.com/adilhusain01/locate/blob/main/docs/spec.md" target="_blank" rel="noreferrer">Protocol specification</a></li>
            <li><a className="hover:text-foreground" href="https://github.com/adilhusain01/locate/blob/main/docs/deployments.md" target="_blank" rel="noreferrer">Deployed addresses</a></li>
            <li><a className="hover:text-foreground" href="https://github.com/adilhusain01/locate/blob/main/docs/threat-model.md" target="_blank" rel="noreferrer">Threat model</a></li>
            <li><a className="hover:text-foreground" href="https://github.com/adilhusain01/locate" target="_blank" rel="noreferrer">Source</a></li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-foreground">Note</p>
          <p className="mt-2 max-w-xs">Robinhood Chain Stock Tokens are not offered to US persons, nor in Canada, the United Kingdom or Switzerland. Locate is software, not a broker.</p>
        </div>
      </div>
    </footer>
  );
}
