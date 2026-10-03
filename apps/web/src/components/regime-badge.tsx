import { cn } from "@/lib/utils";
import { regimeLabel, regimeTone } from "@/lib/format";

export function RegimeBadge({ regime }: { regime: number }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium", regimeTone[regime] ?? "bg-muted")}>
      {regimeLabel[regime] ?? "Unknown"}
    </span>
  );
}
