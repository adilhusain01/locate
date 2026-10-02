import Link from "next/link";
import { AcknowledgeButton } from "@/components/acknowledge-button";

export default async function Restricted({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto max-w-xl px-4 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">A note for visitors from restricted regions</h1>
      <p className="mt-4 text-muted-foreground">
        Robinhood Chain Stock Tokens may not be offered, sold or delivered in the United States, Canada, the United Kingdom or
        Switzerland. Locate is a testnet demonstration: the tokens, USDG and prices behind it are mocks or mirrors with no value.
        Continue only to review the software.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <AcknowledgeButton next={next ?? "/app"} />
        <Link href="/" className="inline-flex h-9 items-center rounded-sm border px-4 text-sm">Back to the overview</Link>
      </div>
    </main>
  );
}
