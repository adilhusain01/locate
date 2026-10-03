"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AmountField({
  id,
  label,
  value,
  onChange,
  unit,
  max,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  max?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.0" />
        <span className="inline-flex items-center rounded-md border px-2 text-sm text-muted-foreground">{unit}</span>
        {max !== undefined && (
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => onChange(max)}>Max</Button>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
