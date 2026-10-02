import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Re-render at most every 15 seconds whatever the fetch did at build time, so the page follows the indexer.
export const revalidate = 15;

type Account = { address: string; auctionOpenSince: string | null; lastSeen: string };

async function openAuctions(): Promise<Account[] | null> {
  const url = process.env.NEXT_PUBLIC_INDEXER_URL;
  if (!url) return null;
  try {
    const res = await fetch(`${url}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: `{ accounts(where: { auctionOpenSince_not: null }, limit: 100) { items { address auctionOpenSince lastSeen } } }` }),
      next: { revalidate: 15 },
    });
    const json = await res.json();
    return json.data?.accounts?.items ?? [];
  } catch {
    return null;
  }
}

export default async function AuctionsPage() {
  const rows = await openAuctions();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auctions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Accounts below health 1.00. The discount runs from 1 to 12 percent over 20 minutes. Anyone can liquidate; the flash path needs no capital.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Open auctions</CardTitle><CardDescription>{rows === null ? "The indexer is not configured, so this list is empty here. Keepers still liquidate on-chain." : `${rows.length} open`}</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Open since</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows?.map((r) => (
                <TableRow key={r.address}>
                  <TableCell className="font-mono text-xs">{r.address}</TableCell>
                  <TableCell>{r.auctionOpenSince ? new Date(Number(r.auctionOpenSince) * 1000).toUTCString() : ""}</TableCell>
                </TableRow>
              ))}
              {rows && rows.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">None right now</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
