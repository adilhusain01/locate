"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConnectButton } from "./connect-button";

const links = [
  { href: "/", label: "Markets" },
  { href: "/lend", label: "Lend" },
  { href: "/short", label: "Short" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/auctions", label: "Auctions" },
  { href: "/faucet", label: "Faucet" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="shrink-0 text-base font-semibold tracking-tight">
            Locate
          </Link>
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 text-sm">
            {links.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "shrink-0 rounded-sm px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
                    active && "bg-muted text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
