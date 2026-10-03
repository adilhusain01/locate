"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Copies a value to the clipboard with a short tick for feedback; the toast carries the full value.
export function CopyValue({
  value,
  what = "Value",
  label,
  className,
  size = "icon",
}: {
  value: string;
  what?: string;
  label?: string;
  className?: string;
  size?: "icon" | "icon-sm" | "default" | "sm";
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${what} copied`, { description: value });
    } catch {
      toast.error("Could not reach the clipboard", { description: value });
    }
  }

  const Icon = copied ? CheckIcon : CopyIcon;
  return (
    <Button
      type="button"
      variant="outline"
      size={label ? "default" : size}
      onClick={copy}
      aria-label={label ?? `Copy ${what.toLowerCase()}`}
      title={value}
      className={className}
    >
      <Icon aria-hidden="true" />
      {label}
    </Button>
  );
}

// The connected wallet's full address, for the Robinhood faucet or an explorer.
export function CopyAddress({ address, label, className }: { address: string; label?: string; className?: string }) {
  return <CopyValue value={address} what="Address" label={label} className={className} />;
}
