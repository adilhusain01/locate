"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConnectButton } from "./connect-button";

const links = [
  { href: "/app", label: "Markets" },
  { href: "/app/lend", label: "Lend" },
  { href: "/app/short", label: "Short" },
  { href: "/app/portfolio", label: "Portfolio" },
  { href: "/app/auctions", label: "Auctions" },
  { href: "/app/faucet", label: "Faucet" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 sm:px-8 lg:px-12 py-3">
        <div className="contents min-w-0 items-center gap-6 md:flex">
          <Link href="/" className="shrink-0 font-display text-lg font-bold tracking-tight">
            Locate
          </Link>
          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 text-sm md:order-none md:w-auto">
            {links.map((l) => {
              const active = l.href === "/app" ? pathname === "/app" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
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
