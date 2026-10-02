"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { markets } from "@/lib/locate";

export function MarketPicker({ value, onChange }: { value: string; onChange: (ticker: string) => void }) {
  return (
    <Select value={value} onValueChange={(v) => { if (v) onChange(v); }}>
      <SelectTrigger className="w-40"><SelectValue placeholder="Ticker" /></SelectTrigger>
      <SelectContent>
        {markets.map((m) => (
          <SelectItem key={m.ticker} value={m.ticker}>{m.ticker}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
