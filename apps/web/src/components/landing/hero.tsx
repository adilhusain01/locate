"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { RolesDiagram } from "./diagrams";
import type { SceneHandle } from "./hero-scene";

const STEP_SECONDS = 4;

// The five beats of the loop. Each is a real step in a trade, so the numbers carry meaning.
const STEPS = [
  { title: "Holders lend", body: "Deposit NVDA you already own. You keep its price moves, splits and dividends." },
  { title: "Traders post USDG", body: "One USDG margin account backs a borrow in any listed ticker." },
  { title: "Borrow and sell", body: "One transaction borrows the shares, sells them on Uniswap and books the USDG as margin." },
  { title: "Fees flow back", body: "The borrower pays a fee in USDG. Ninety percent goes to the lenders." },
  { title: "Auction below health 1", body: "A Dutch auction repays the pool. The liquidator can use a flash loan, so it needs no capital." },
];

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

const LABELS = {
  holder: { name: "Holders", role: "lend NVDA, earn USDG" },
  pool: { name: "NVDA pool", role: "one vault per ticker" },
  controller: { name: "Margin account", role: "USDG backs every borrow" },
  dex: { name: "Uniswap", role: "where borrowed shares sell" },
  trader: { name: "Trader", role: "posts USDG, goes short" },
  liquidator: { name: "Liquidator", role: "repays below health 1" },
};

export function Hero() {
  const host = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const [step, setStep] = useState(0);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  // Plays by default unless the system asks for reduced motion; the button overrides either way.
  const [choice, setChoice] = useState<boolean | null>(null);
  const playing = choice ?? !reduced;
  const [failed, setFailed] = useState(false);
  const stepRef = useRef(0);

  useEffect(() => {
    handle.current?.setPlaying(playing);
  }, [playing]);

  useEffect(() => {
    const still = window.matchMedia(REDUCED).matches;
    let cancelled = false;
    import("./hero-scene")
      .then(({ createScene }) => {
        if (cancelled || !host.current) return;
        try {
          handle.current = createScene(host.current, {
            labels: LABELS,
            playing: !still,
            startAt: still ? STEP_SECONDS - 1 : 0,
            onTick: (t) => {
              const s = Math.min(STEPS.length - 1, Math.floor(t / STEP_SECONDS));
              rail.current?.style.setProperty("--step-progress", String((t % STEP_SECONDS) / STEP_SECONDS));
              if (s !== stepRef.current) {
                stepRef.current = s;
                setStep(s);
              }
            },
          });
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);

  const toggle = useCallback(() => setChoice(!playing), [playing]);

  const jump = useCallback(
    (i: number) => {
      // Playing: start the beat from its first frame. Paused: show the beat with its tokens in flight.
      handle.current?.setTime(i * STEP_SECONDS + (playing ? 0.001 : STEP_SECONDS - 1));
    },
    [playing],
  );

  return (
    <section className="border-b">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-8 px-5 sm:px-8 lg:px-12 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-12 lg:pt-6">
        <div className="lg:py-8">
          <h1 className="text-balance text-[2.9rem] font-bold leading-[1] tracking-[-0.018em] sm:text-7xl lg:text-[4.6rem]">
            Lend the stock you hold. Short the stock you don&apos;t.
          </h1>
          <p className="mt-7 max-w-[36rem] text-pretty text-xl leading-relaxed text-muted-foreground">
            Locate is a stock lending market for Robinhood Chain stock tokens, open every hour of the week. Lenders earn the borrow fee in USDG. Shorts post USDG once and borrow any listed ticker.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app" className="key inline-flex h-12 items-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground">
              Open the app
            </Link>
            <a href="#how" className="inline-flex h-12 items-center rounded-md border bg-card px-6 text-base font-medium">
              How it works
            </a>
          </div>
        </div>

        <div className="relative">
          {failed ? (
            <div className="px-4 sm:px-0"><RolesDiagram /></div>
          ) : (
            <div
              ref={host}
              role="img"
              aria-label={`Animated diagram of a Locate trade. Now showing step ${step + 1} of 5: ${STEPS[step].title}. ${STEPS[step].body}`}
              className="hero-stage relative aspect-[4/3] w-full overflow-hidden rounded-2xl border sm:aspect-[3/2] sm:rounded-[2rem]"
            />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 pb-10">
        <div className="flex items-start gap-3 border-t pt-4">
          <ol ref={rail} className="grid flex-1 grid-cols-5 gap-2 sm:gap-4" style={{ ["--step-progress" as string]: "0" }}>
            {STEPS.map((s, i) => {
              const active = i === step;
              return (
                <li key={s.title} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => jump(i)}
                    aria-current={active ? "step" : undefined}
                    className="group block w-full rounded-md text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="relative block h-1 overflow-hidden rounded-full bg-border">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--primary-2)] to-primary"
                        style={{ width: active ? (playing ? "calc(var(--step-progress) * 100%)" : "100%") : i < step ? "100%" : "0%" }}
                      />
                    </span>
                    <span className={`mt-3 flex items-baseline gap-2 text-sm font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                      <span className="tabular text-xs">{i + 1}</span>
                      <span className="hidden truncate sm:inline">{s.title}</span>
                    </span>
                    <span className={`mt-1 hidden text-sm leading-snug transition-opacity md:block ${active ? "text-foreground/80 opacity-100" : "text-muted-foreground opacity-60"}`}>{s.body}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {!failed && (
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "Pause the animation" : "Play the animation"}
              title={reduced && !playing ? "Play (your system asks for reduced motion)" : undefined}
              className="mt-2 inline-flex size-9 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {playing ? <PauseIcon className="size-4" aria-hidden="true" /> : <PlayIcon className="size-4" aria-hidden="true" />}
            </button>
          )}
        </div>
        <p className="mt-4 text-sm md:hidden" aria-live="polite">
          <span className="font-medium">{step + 1}. {STEPS[step].title}.</span> <span className="text-muted-foreground">{STEPS[step].body}</span>
        </p>
      </div>
    </section>
  );
}
