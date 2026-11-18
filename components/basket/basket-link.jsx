"use client";

// Header link to the basket, shown only once it has items (CLAUDE.md "Customer").
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBasket } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useBasket } from "@/components/basket/basket-provider";
import { cn } from "@/lib/utils";

export function BasketLink() {
  const { count } = useBasket();
  const pathname = usePathname();
  if (count === 0) return null;
  const current = pathname === "/basket";
  return (
    <Link
      href="/basket"
      aria-current={current ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: current ? "secondary" : "outline" }),
        "gap-2",
      )}
    >
      <ShoppingBasket className="size-4" aria-hidden="true" />
      <span aria-hidden="true">Basket ({count})</span>
      <span className="sr-only">
        Basket, {count} {count === 1 ? "medicine" : "medicines"}
      </span>
    </Link>
  );
}
