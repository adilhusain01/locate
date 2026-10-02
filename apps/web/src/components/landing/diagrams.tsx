import { T, hv, vh, hvh } from "./tokens";
import { Defs, Figure, Label, Legend, Node } from "./svg-bits";

/// Roles: who gives what to whom. Focal element: the lending pool.
export function RolesDiagram() {
  const id = "roles";
  return (
    <Figure caption="Lenders hold shares over raw token units. Borrowers hold one USDG balance and owe raw units per ticker. Fees are USDG: 90 percent to the pool's shareholders, 10 percent to insurance." minWidth={680}>
      <svg viewBox="0 0 680 300" role="img" aria-labelledby={`${id}-title ${id}-desc`} className="h-auto w-full">
        <title id={`${id}-title`}>Who lends, who borrows, where USDG flows</title>
        <desc id={`${id}-desc`}>Lenders deposit stock tokens into a pool; borrowers post USDG collateral, borrow tokens from the pool and sell them on Uniswap; borrow fees in USDG flow back to lenders and to the insurance fund.</desc>
        <Defs id={id} />
        {/* arrows first */}
        <path d={hv(160, 84, 232, 84)} stroke={T.lend} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow-lend)`} />
        <Label x={196} y={70} text="DEPOSIT NVDA" tone={T.lend} />
        <path d={hv(232, 112, 160, 112)} stroke={T.lend} strokeWidth={1.2} fill="none" strokeDasharray="5,4" markerEnd={`url(#${id}-arrow-lend)`} />
        <Label x={196} y={132} text="lNVDA SHARES" tone={T.lend} />
        <path d={hv(392, 84, 464, 84)} stroke={T.short} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow-short)`} />
        <Label x={428} y={70} text="BORROW RAW" tone={T.short} />
        <path d={hv(464, 112, 392, 112)} stroke={T.short} strokeWidth={1.2} fill="none" strokeDasharray="5,4" markerEnd={`url(#${id}-arrow-short)`} />
        <Label x={428} y={132} text="REPAY RAW" tone={T.short} />
        <path d={vh(544, 128, 544, 196)} stroke={T.muted} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow)`} />
        <Label x={562} y={166} text="SELL, BUY BACK" anchor="start" />
        <path d={hvh(464, 100, 312, 128, 400)} stroke={T.muted} strokeWidth={1.2} fill="none" />
        <path d={vh(312, 128, 312, 128)} stroke="none" fill="none" />
        <path d={hvh(480, 104, 312, 128, 408)} stroke="none" fill="none" />
        <path d={hvh(496, 128, 332, 196, 420)} stroke={T.accent} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow-accent)`} />
        <Label x={420} y={176} text="USDG FEE, 90%" tone={T.accent} anchor="middle" />
        <path d={hvh(512, 128, 140, 232, 440)} stroke={T.muted} strokeWidth={1.2} fill="none" strokeDasharray="4,3" markerEnd={`url(#${id}-arrow)`} />
        <Label x={300} y={222} text="USDG FEE, 10%" />
        {/* nodes */}
        <Node x={40} y={60} w={120} h={72} kind="user" name="Lenders" sub="hold stock tokens" />
        <Node x={232} y={56} w={160} h={80} kind="focal" name="Lending pool" sub="ERC-4626, raw units" tag="ONE PER TICKER" />
        <Node x={464} y={60} w={160} h={72} kind="short" name="Borrowers" sub="USDG collateral" />
        <Node x={464} y={196} w={160} h={56} kind="external" name="Uniswap v3" sub="NVDA / USDG pool" />
        <Node x={232} y={196} w={160} h={56} kind="store" name="Lender rewards" sub="USDG, claim any time" />
        <Node x={40} y={208} w={120} h={48} kind="store" name="Insurance fund" sub="bad debt first" />
      </svg>
      <Legend items={[{ swatch: T.accentTint, label: "The pool, where every market lives" }, { swatch: T.lendTint, label: "Lender side" }, { swatch: T.shortTint, label: "Borrower side" }, { swatch: "rgba(20,26,31,0.05)", label: "USDG held by the Controller" }, { swatch: T.paper, label: "Dashed: returns and small flows", dashed: true }]} />
    </Figure>
  );
}

/// A short, as a sequence. Five lifelines, seven messages, one check.
export function ShortSequence() {
  const id = "short-seq";
  const lanes = [
    { x: 64, name: "Trader" },
    { x: 200, name: "ShortRouter" },
    { x: 344, name: "Controller" },
    { x: 488, name: "Lending pool" },
    { x: 616, name: "Uniswap v3" },
  ];
  const top = 56;
  const bottom = 332;
  const msgs: { from: number; to: number; y: number; text: string; tone?: string; dashed?: boolean }[] = [
    { from: 0, to: 1, y: 92, text: "SHORT 10 NVDA, MIN OUT" },
    { from: 1, to: 2, y: 124, text: "BORROW WITH CALLBACK" },
    { from: 2, to: 3, y: 156, text: "BORROW 10 RAW TO ROUTER" },
    { from: 1, to: 4, y: 196, text: "SELL 10 NVDA FOR USDG" },
    { from: 4, to: 1, y: 220, text: "≈ 2,370 USDG", dashed: true },
    { from: 1, to: 2, y: 252, text: "DEPOSIT PROCEEDS AS MARGIN" },
    { from: 2, to: 0, y: 312, text: "DONE: DEBT 10 NVDA, HEALTH ↑", dashed: true },
  ];
  return (
    <Figure caption="The check runs after the callback, so the proceeds already count as margin. A trader needs 1.5 times the position in total, of which the sale itself provides one times, the same shape as a brokerage margin requirement." minWidth={680}>
      <svg viewBox="0 0 680 352" role="img" aria-labelledby={`${id}-title ${id}-desc`} className="h-auto w-full">
        <title id={`${id}-title`}>A short in one transaction</title>
        <desc id={`${id}-desc`}>Sequence of calls: the trader calls the ShortRouter, which borrows through the Controller with a callback, sells the tokens on Uniswap, deposits the USDG proceeds as collateral, and the Controller checks the initial ratio only then.</desc>
        <Defs id={id} />
        {lanes.map((l) => (
          <line key={l.name} x1={l.x} y1={top + 24} x2={l.x} y2={bottom} stroke={T.rule} strokeWidth={1} strokeDasharray="3,3" />
        ))}
        {msgs.map((m, i) => {
          const a = lanes[m.from].x;
          const b = lanes[m.to].x;
          const dir = Math.sign(b - a);
          const stroke = m.tone ?? (m.dashed ? T.soft : T.ink);
          return (
            <g key={i}>
              <line x1={a} y1={m.y} x2={b - dir * 6} y2={m.y} stroke={stroke} strokeWidth={1.2} strokeDasharray={m.dashed ? "5,4" : undefined} markerEnd={`url(#${id}-arrow)`} />
              <Label x={(a + b) / 2} y={m.y - 8} text={m.text} tone={m.dashed ? T.soft : T.muted} />
            </g>
          );
        })}
        {/* activation on the controller for the final check */}
        <rect x={340} y={264} width={8} height={36} fill={T.accentTint} stroke={T.accent} strokeWidth={1} />
        <Label x={356} y={288} text="CHECK INITIAL RATIO ≥ 1.5" tone={T.accent} anchor="start" />
        {lanes.map((l, i) => (
          <Node key={l.name} x={l.x - 56} y={top - 24} w={112} h={40} kind={i === 2 ? "focal" : i === 0 ? "user" : i === 4 ? "external" : "step"} name={l.name} />
        ))}
      </svg>
      <Legend items={[{ swatch: T.accentTint, label: "Controller, the only check that matters" }, { swatch: T.paper, label: "Dashed: returns", dashed: true }]} />
    </Figure>
  );
}

/// Price regimes as a state machine with guards.
export function RegimeMachine() {
  const id = "regimes";
  return (
    <Figure caption="New borrows are allowed in Open and Closed, never in Paused or Degraded, and never in the last 30 minutes before a session opens. Repaying, covering, withdrawing and liquidating work in every state." minWidth={680}>
      <svg viewBox="0 0 680 300" role="img" aria-labelledby={`${id}-title ${id}-desc`} className="h-auto w-full">
        <title id={`${id}-title`}>The four price regimes</title>
        <desc id={`${id}-desc`}>State machine with Open, Closed, Paused and Degraded states; the session calendar moves between Open and Closed, stale or disagreeing prices move to Degraded, and a paused token or sequencer moves any state to Paused.</desc>
        <Defs id={id} />
        {/* Open <-> Closed */}
        <path d={hv(200, 76, 440, 76)} stroke={T.ink} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow)`} />
        <Label x={320} y={62} text="FRI 20:00 ET, SESSION ENDS" tone={T.muted} />
        <path d={hv(440, 104, 200, 104)} stroke={T.ink} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow)`} />
        <Label x={320} y={124} text="SUN 20:00 ET, FRESH PRINT" tone={T.muted} />
        {/* Open <-> Degraded */}
        <path d={vh(120, 120, 120, 200)} stroke={T.short} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow-short)`} />
        <Label x={132} y={164} text="PRINT OLDER THAN 25 H" tone={T.short} anchor="start" />
        <path d={vh(96, 200, 96, 120)} stroke={T.muted} strokeWidth={1.2} fill="none" strokeDasharray="5,4" markerEnd={`url(#${id}-arrow)`} />
        <Label x={84} y={164} text="FRESH PRINT" anchor="end" />
        {/* Open -> Degraded on pool deviation (second guard) shares the same transition */}
        {/* Closed -> Paused, Open -> Paused (any state) */}
        <path d={vh(520, 120, 520, 200)} stroke={T.short} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow-short)`} />
        <Label x={532} y={164} text="TOKEN PAUSED / SEQUENCER DOWN" tone={T.short} anchor="start" />
        <path d={vh(496, 200, 496, 120)} stroke={T.muted} strokeWidth={1.2} fill="none" strokeDasharray="5,4" markerEnd={`url(#${id}-arrow)`} />
        <Label x={484} y={164} text="HEALTHY FOR 1 H" anchor="end" />
        {/* nodes */}
        <Node x={40} y={56} w={160} h={64} kind="focal" name="Open" sub="fresh Chainlink print" />
        <Node x={440} y={56} w={160} h={64} kind="step" name="Closed" sub="last print, TWAP in a band" />
        <Node x={40} y={200} w={160} h={64} kind="short" name="Degraded" sub="stale, or pool off by > 10%" />
        <Node x={440} y={200} w={160} h={64} kind="short" name="Paused" sub="no new borrows" />
      </svg>
      <Legend items={[{ swatch: T.accentTint, label: "Normal trading state" }, { swatch: T.shortTint, label: "States that block new borrows" }, { swatch: T.paper, label: "Dashed: recovery", dashed: true }]} />
    </Figure>
  );
}

/// The 24/5 week as a strip.
export function WeekStrip() {
  const id = "week";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const w = 640;
  const x0 = 20;
  const dayW = w / 7;
  // session: Sunday 20:00 ET to Friday 20:00 ET
  const openStart = x0 + dayW * (20 / 24);
  const openEnd = x0 + dayW * 5 + dayW * (20 / 24);
  return (
    <Figure caption="Chainlink's equity feeds on Robinhood Chain update inside this window. Outside it the oracle keeps the last print and lets the pool price move it within a band that starts at 2 percent and widens 0.1 percent per hour, to 10 percent at most. Debt is always valued at the higher of the two." minWidth={680}>
      <svg viewBox="0 0 680 120" role="img" aria-labelledby={`${id}-title ${id}-desc`} className="h-auto w-full">
        <title id={`${id}-title`}>Robinhood&apos;s 24/5 session across the week</title>
        <desc id={`${id}-desc`}>Timeline of a week with the trading session marked from Sunday 20:00 Eastern to Friday 20:00 Eastern, and the weekend gap where only the pool trades.</desc>
        <rect x={x0} y={40} width={w} height={28} fill="rgba(20,26,31,0.05)" stroke={T.rule} />
        <rect x={openStart} y={40} width={openEnd - openStart} height={28} fill={T.accentTint} stroke={T.accent} />
        {days.map((d, i) => (
          <g key={d}>
            <line x1={x0 + dayW * i} y1={36} x2={x0 + dayW * i} y2={72} stroke={T.rule} />
            <text x={x0 + dayW * i + 6} y={88} fontSize={10} fontFamily="var(--font-sans)" fill={T.muted}>{d}</text>
          </g>
        ))}
        <text x={openStart + 6} y={58} fontSize={10} fontFamily="var(--font-mono)" fill={T.accent}>SESSION OPEN, FEEDS LIVE</text>
        <text x={openEnd + 6} y={58} fontSize={9} fontFamily="var(--font-mono)" fill={T.muted}>CLOSED: POOL ONLY</text>
        <text x={x0} y={24} fontSize={10} fontFamily="var(--font-mono)" fill={T.muted}>SUN 20:00 ET</text>
        <text x={openEnd} y={24} fontSize={10} fontFamily="var(--font-mono)" fill={T.muted} textAnchor="middle">FRI 20:00 ET</text>
        <text x={x0 + w} y={108} fontSize={9} fontFamily="var(--font-mono)" fill={T.soft} textAnchor="end">US MARKET HOLIDAYS CLOSE THEIR SESSION DAY</text>
      </svg>
    </Figure>
  );
}

/// Dutch auction discount over time.
export function AuctionCurve() {
  const id = "auction";
  const x0 = 56;
  const y0 = 220;
  const w = 560;
  const h = 160;
  const px = (min: number) => x0 + (min / 30) * w;
  const py = (pct: number) => y0 - (pct / 15) * h;
  return (
    <Figure caption="A liquidator repays raw units and receives USDG at the current discount. Half of a position may be taken, or all of it below health 0.95. The flash path borrows the units from the pool itself and buys them back on Uniswap, so no capital is needed." minWidth={680}>
      <svg viewBox="0 0 680 260" role="img" aria-labelledby={`${id}-title ${id}-desc`} className="h-auto w-full">
        <title id={`${id}-title`}>Auction discount over the first 30 minutes</title>
        <desc id={`${id}-desc`}>Line chart of the liquidation discount rising linearly from 1 percent at the start of an auction to 12 percent at 20 minutes, then holding flat.</desc>
        {[0, 5, 10, 15].map((p) => (
          <g key={p}>
            <line x1={x0} y1={py(p)} x2={x0 + w} y2={py(p)} stroke={T.rule} strokeWidth={0.8} />
            <text x={x0 - 8} y={py(p) + 3} fontSize={9} fontFamily="var(--font-mono)" fill={T.muted} textAnchor="end">{p}%</text>
          </g>
        ))}
        {[0, 10, 20, 30].map((m) => (
          <text key={m} x={px(m)} y={y0 + 18} fontSize={9} fontFamily="var(--font-mono)" fill={T.muted} textAnchor="middle">{m} min</text>
        ))}
        <path d={`M${px(0)} ${py(1)} L${px(20)} ${py(12)} L${px(30)} ${py(12)}`} stroke={T.accent} strokeWidth={2} fill="none" />
        <circle cx={px(0)} cy={py(1)} r={3} fill={T.accent} />
        <circle cx={px(20)} cy={py(12)} r={3} fill={T.accent} />
        <text x={px(0) + 8} y={py(1) - 8} fontSize={10} fontFamily="var(--font-mono)" fill={T.accent}>1% AT OPEN</text>
        <text x={px(20)} y={py(12) - 10} fontSize={10} fontFamily="var(--font-mono)" fill={T.accent} textAnchor="middle">12% FROM 20 MIN</text>
        <text x={x0 + w} y={y0 + 40} fontSize={9} fontFamily="var(--font-mono)" fill={T.soft} textAnchor="end">AUCTION CLEARS WHEN HEALTH IS BACK AT 1.00</text>
      </svg>
    </Figure>
  );
}

/// What runs where: Solidity around a Stylus core.
export function StylusArchitecture() {
  const id = "stylus";
  return (
    <Figure caption="The Controller is Solidity and only knows two interfaces. Their production implementations are Rust on Stylus; Solidity reference copies stay deployed, and the live chain showed both identical to the wei before the switch." minWidth={680}>
      <svg viewBox="0 0 680 320" role="img" aria-labelledby={`${id}-title ${id}-desc`} className="h-auto w-full">
        <title id={`${id}-title`}>Solidity contracts around a Stylus core</title>
        <desc id={`${id}-desc`}>Architecture: the Solidity Controller calls a Rust risk engine and a Rust oracle router on Stylus; the oracle router reads a Rust market calendar, Chainlink feeds and Uniswap pools; the Controller moves tokens through the Solidity lending pools and the periphery.</desc>
        <Defs id={id} />
        {/* arrows */}
        <path d={hv(260, 92, 420, 92)} stroke={T.accent} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow-accent)`} />
        <Label x={340} y={78} text="EVALUATE, RATES" tone={T.accent} />
        <path d={hv(260, 124, 420, 124)} stroke={T.accent} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow-accent)`} />
        <Label x={340} y={144} text="QUOTE, REGIME" tone={T.accent} />
        <path d={hvh(580, 140, 580, 200, 580)} stroke={T.muted} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow)`} />
        <Label x={592} y={172} text="SESSION" anchor="start" />
        <path d={hvh(500, 140, 500, 200, 500)} stroke={T.muted} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow)`} />
        <Label x={488} y={172} text="LATEST PRINT" anchor="end" />
        <path d={hvh(440, 140, 440, 264, 440)} stroke={T.muted} strokeWidth={1.2} fill="none" strokeDasharray="4,3" markerEnd={`url(#${id}-arrow)`} />
        <Label x={428} y={236} text="OBSERVE TWAP" anchor="end" />
        <path d={vh(140, 140, 140, 200)} stroke={T.ink} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow)`} />
        <Label x={152} y={172} text="BORROW, REPAY, FEES" anchor="start" />
        <path d={vh(220, 140, 220, 264)} stroke={T.ink} strokeWidth={1.2} fill="none" markerEnd={`url(#${id}-arrow)`} />
        <Label x={232} y={236} text="CALLBACKS" anchor="start" />
        {/* nodes */}
        <Node x={60} y={64} w={200} h={76} kind="step" name="Controller" sub="Solidity, accounts and auctions" tag="SOLIDITY" />
        <Node x={420} y={64} w={240} h={44} kind="focal" name="Risk engine" sub="Rust on Stylus, 14.1 KB" tag="RUST" />
        <Node x={420} y={112} w={240} h={44} kind="focal" name="Oracle router" sub="Rust on Stylus, 29.6 KB" tag="RUST" />
        <Node x={60} y={200} w={160} h={48} kind="step" name="Lending pools" sub="14 ERC-4626 vaults" />
        <Node x={60} y={264} w={320} h={44} kind="step" name="ShortRouter, Liquidator" sub="Solidity periphery, Uniswap routes" />
        <Node x={420} y={200} w={120} h={48} kind="external" name="Chainlink" sub="per token, 24/5" />
        <Node x={548} y={200} w={112} h={48} kind="step" name="Calendar" sub="Rust on Stylus" tag="RUST" />
        <Node x={420} y={264} w={240} h={44} kind="external" name="Uniswap v3 pools" sub="token / USDG" />
      </svg>
      <Legend items={[{ swatch: T.accentTint, label: "Rust on Stylus, the two contracts the Controller calls" }, { swatch: T.paper2, label: "Solidity" }, { swatch: "rgba(20,26,31,0.03)", label: "External" }]} />
    </Figure>
  );
}
