"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** A header link that marks itself as the current page. */
export function NavLink({ href, exact = false, children }) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
        "hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}
