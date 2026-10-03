import Link from "next/link";
import { Header, Footer, Section, Details } from "@/components/landing/sections";
import { Hero } from "@/components/landing/hero";
import { LiveMarkets, LiveTicket } from "@/components/landing/live";
import { AuctionCurve, RegimeMachine, RolesDiagram, ShortSequence, StylusArchitecture, WeekStrip } from "@/components/landing/diagrams";

const corporateAction = [
  ["Raw balance (what the ledger stores)", "10.000000", "10.000000"],
  ["uiMultiplier", "1.000000", "2.000000"],
  ["Effective shares (what the holder owns)", "10", "20"],
  ["Borrower owes", "10 raw", "10 raw"],
  ["Chainlink price per raw token", "$480.00", "$240.00"],
  ["Debt value", "$4,800", "$2,400 x 2 = $4,800"],
];

const safety = [
  ["Thin weekend pool", "Debt valued at the higher of print and banded TWAP; borrow caps tied to pool depth; pre-open guard"],
  ["Stale or paused feed", "Degraded or Paused regime: no new borrows, everything else open"],
  ["Reentrancy and callbacks", "Guards on every entry that can hurt an account; deposit and repay are the only calls allowed inside a callback"],
  ["ERC-4626 inflation", "Decimals offset of six, zero-share deposits revert, deployer seeds every pool"],
  ["Rounding", "Debt rounds up, health rounds down, flash fee rounds up"],
  ["Bad debt", "Insurance fund first, then a pro-rata haircut on that market's lenders, stated on the Markets page"],
  ["Admin keys", "Guardian can only pause borrows and listings; owner moves behind a multisig and timelock before mainnet"],
];

export default function Landing() {
  return (
    <>
      <Header />
      <Hero />
      <main className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <section className="py-14 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold tracking-[-0.025em] sm:text-4xl lg:text-5xl">Live on the testnet</h2>
              <p className="mt-5 max-w-prose text-lg leading-relaxed text-muted-foreground">Fourteen markets read straight from Robinhood Chain testnet. Every ticker publishes its borrow rate, a short interest signal tokenized stocks did not have.</p>
              <div className="mt-6"><LiveTicket /></div>
            </div>
            <div className="min-w-0"><LiveMarkets /></div>
          </div>
        </section>

        <Section id="how" title="How a market works" lead="One pool per ticker, one USDG account per borrower. The pool is an ERC-4626 vault over raw token units; everything the protocol owes or is owed is counted in those units.">
          <RolesDiagram />
          <Details>
            <p>A lender deposits NVDA and receives lNVDA shares. The pool lends raw units to borrowers up to 90 percent utilisation and keeps the rest idle so lenders can always leave. The fee a borrower pays accrues in USDG against the borrower&apos;s collateral and is credited to the pool&apos;s shareholders as it accrues; a lender claims it whenever they like.</p>
            <p>A borrower deposits USDG once and can borrow any listed ticker against it. The initial ratio is 1.5 times the debt value for the large names and 2 times for the thinner ones; liquidation starts at 1.25 and 1.5 times. One account can hold several shorts, and the health factor adds them up.</p>
          </Details>
          <h3 className="mt-14 text-2xl font-semibold tracking-[-0.02em]">A short, step by step</h3>
          <ShortSequence />
          <Details>
            <p>The ShortRouter is an operator the trader approves once. It borrows through a deferred-check call: the Controller hands the tokens over, lets the router sell them on Uniswap and deposit the USDG, and only then checks the ratio. The whole thing reverts if the ratio is missed, so nothing half-happens.</p>
          </Details>
          <h3 className="mt-14 text-2xl font-semibold tracking-[-0.02em]">Corporate actions cost no code</h3>
          <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">A 2-for-1 split</th><th className="px-3 py-2 text-right font-medium">Before</th><th className="px-3 py-2 text-right font-medium">After</th></tr></thead>
              <tbody>{corporateAction.map(([k, a, b]) => (<tr key={k} className="border-t"><td className="px-3 py-2">{k}</td><td className="px-3 py-2 text-right font-mono tabular">{a}</td><td className="px-3 py-2 text-right font-mono tabular">{b}</td></tr>))}</tbody>
            </table>
          </div>
          <Details>
            <p>Robinhood Chain Stock Tokens follow ERC-8056: a split or a reinvested dividend never changes a raw balance, it changes a multiplier. Because Locate counts raw units and the Chainlink feed already prices one raw token, a 2-for-1 split moves nothing in the protocol.</p>
          </Details>
        </Section>

        <Section id="prices" title="Prices, around a 24/5 feed" lead="The tokens trade every hour of the week on Uniswap. Chainlink's equity feeds on Robinhood Chain update only while the US session runs. The oracle router treats that gap as a state, not a surprise.">
          <WeekStrip />
          <RegimeMachine />
          <Details>
            <p>Inside the session a fresh print is the price. Outside it, the router reads the pool&apos;s 30-minute TWAP, clamps it into a band around the last print, and values debt at the higher of the two. Sunday-night news that moves the pool therefore raises collateral requirements before Monday&apos;s first print.</p>
            <p>The token&apos;s own flags matter too: a Stock Token sets <span className="font-mono text-[13px]">oraclePaused()</span> while a corporate action is processed and <span className="font-mono text-[13px]">paused()</span> if transfers halt. Either one, or a sequencer outage, pauses new borrows.</p>
          </Details>
        </Section>

        <Section id="liquidations" title="Liquidations that need no capital" lead="Below health 1.00 an auction opens. The discount on the borrower's USDG grows with time, so the first liquidator to show up pays the fairest price and a slow weekend still clears.">
          <AuctionCurve />
          <Details>
            <p>The flash path lives in the Liquidator contract: it borrows the raw units from the pool&apos;s own ERC-3156 flash loan at 5 basis points, repays the unhealthy account, receives USDG at the discount, buys the units back on Uniswap, returns the loan and keeps the difference. The pool&apos;s lenders earn the flash fee. A keeper runs this every ten seconds on testnet; anyone can run one.</p>
            <p>If an account runs out of USDG with debt left, anyone can absorb it: the insurance fund, fed by its 10 percent of every fee, compensates lenders in USDG, and only the remainder becomes a pro-rata haircut on that pool.</p>
          </Details>
        </Section>

        <Section id="stylus" title="What runs on Stylus" lead="Two contracts do the arithmetic the Controller depends on every time money moves: the risk engine and the oracle router. Both are Rust, compiled to WebAssembly and activated on Robinhood Chain.">
          <StylusArchitecture />
          <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
            {[
              ["14.1 KB", "risk engine, compressed"],
              ["29.6 KB", "oracle router, two fragments"],
              ["10.9 KB", "market calendar"],
              ["100", "Foundry tests, requirements first"],
              ["6", "invariants over 8,192 random calls each"],
              ["17", "Rust unit tests"],
            ].map(([n, l]) => (
              <div key={l} className="card-wash wash-cobalt p-5"><dt className="font-display tabular text-4xl font-bold tracking-tight">{n}</dt><dd className="mt-1 text-sm text-muted-foreground">{l}</dd></div>
            ))}
          </dl>
          <Details>
            <p>The risk engine evaluates every position of an account in one call over 512-bit intermediates, rounding debt up and health down. The oracle router ports Uniswap&apos;s tick math to read the pool TWAP, runs the band and regime rules, and reads the token flags with tolerant static calls. The market calendar knows the session, US daylight saving and the holiday list.</p>
            <p>Each has a Solidity reference. <span className="font-mono text-[13px]">scripts/diff-check.ts</span> ran both on the live chain across 40 random health evaluations, nine rate points, six auction points and all 14 quotes, found them identical to the wei, and switched the Controller. The references stay deployed for anyone to repeat it.</p>
          </Details>
        </Section>

        <Section id="safety" title="Where it can go wrong, and what stops it" lead="The threat model is written down with the controls that answer each risk and a self-audit checklist that has to be ticked before any mainnet deployment.">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Risk</th><th className="px-3 py-2 font-medium">Control</th></tr></thead>
              <tbody>{safety.map(([k, v]) => (<tr key={k} className="border-t align-top"><td className="px-3 py-2 font-medium">{k}</td><td className="px-3 py-2 text-muted-foreground">{v}</td></tr>))}</tbody>
            </table>
          </div>
          <Details>
            <p>Still open: weekend pricing on thin pools is contained, not removed; an outside review of the Stylus and liquidation code is the first milestone; and securities lending of tokenized stock may draw regulatory comment even for non-custodial software, which is why the app carries the issuer&apos;s regional notice.</p>
          </Details>
        </Section>

        <section className="border-t py-14 sm:py-20">
          <div className="rounded-2xl border card-wash wash-cobalt p-8 sm:p-14">
            <h2 className="text-3xl font-bold tracking-[-0.025em] sm:text-5xl">Try it on the testnet</h2>
            <p className="mt-3 max-w-prose text-muted-foreground">Sign in with an email or a wallet, take mock USDG from the faucet, lend a token or short one. Robinhood&apos;s own faucet hands out ETH and the real AMD, AMZN, NFLX, PLTR and TSLA tokens that Locate lists.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/app" className="key inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">Open the app</Link>
              <Link href="/app/faucet" className="inline-flex h-11 items-center rounded-md border bg-background px-5 text-sm font-medium">Get testnet tokens</Link>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    </>
  );
}
