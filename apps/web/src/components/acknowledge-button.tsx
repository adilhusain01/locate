"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AcknowledgeButton({ next }: { next: string }) {
  const router = useRouter();
  return (
    <Button
      className="key"
      onClick={() => {
        document.cookie = "locate_ack=1; path=/; max-age=2592000; samesite=lax";
        router.push(next);
      }}
    >
      Continue to the testnet demo
    </Button>
  );
}
