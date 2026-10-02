"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  pendingLabel?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
  write: () => Parameters<ReturnType<typeof useWriteContract>["writeContract"]>[0];
  onDone?: () => void;
};

/// One transaction per press: sends, waits for the receipt, toasts the result, then calls onDone.
export function TxButton({ label, pendingLabel, disabled, variant = "default", write, onDone }: Props) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (error) {
      const message = (error as any).shortMessage ?? error.message;
      toast.error(message.split("\n")[0]);
      reset();
    }
  }, [error, reset]);

  useEffect(() => {
    if (receipt.isSuccess) {
      toast.success(`${label}: confirmed`);
      onDone?.();
      reset();
    }
    if (receipt.isError) {
      toast.error(`${label}: transaction reverted`);
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess, receipt.isError]);

  const busy = isPending || receipt.isLoading;
  return (
    <Button variant={variant} disabled={disabled || busy} onClick={() => writeContract(write() as any)}>
      {busy ? (pendingLabel ?? "Confirming…") : label}
    </Button>
  );
}
