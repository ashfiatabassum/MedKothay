"use client";

// "Add to basket" for one search result. A basket holds one pharmacy (D4); adding
// from another shop asks before replacing it.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useBasket } from "@/components/basket/basket-provider";
import { MAX_BASKET_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function AddToBasketButton({ shop, item, disabled }) {
  const { basket, ready, add } = useBasket();
  const [conflict, setConflict] = useState(false);
  // After the conflict prompt closes, move focus to whatever replaced it
  // (the Add button or the "In basket" link), so it is not lost.
  const controlRef = useRef(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (refocus.current && !conflict) {
      refocus.current = false;
      controlRef.current?.focus();
    }
  });

  const inBasket =
    basket?.pharmacyId === shop.pharmacyId &&
    basket.items.some((i) => i.medicineId === item.medicineId);
  // Worked out from the basket each render, so it clears as soon as an item is
  // removed (here or in another tab).
  const full =
    basket?.pharmacyId === shop.pharmacyId &&
    basket.items.length >= MAX_BASKET_ITEMS &&
    !inBasket;

  if (disabled) {
    return (
      <Button variant="outline" disabled className="w-full sm:w-auto">
        Not available
      </Button>
    );
  }

  if (inBasket) {
    return (
      <Link
        ref={controlRef}
        href="/basket"
        className={cn(
          buttonVariants({ variant: "secondary" }),
          "w-full sm:w-auto",
        )}
      >
        <Check aria-hidden="true" />
        In basket · View
      </Link>
    );
  }

  // Another tab may have emptied or changed the basket meanwhile.
  const stillConflicts =
    conflict && basket !== null && basket.pharmacyId !== shop.pharmacyId;

  if (stillConflicts) {
    return (
      <div
        role="alert"
        className="w-full space-y-2 rounded-lg border border-primary/30 bg-secondary p-3 text-sm text-secondary-foreground"
      >
        <p>
          Your basket has medicines from {basket?.pharmacyName}. A reservation
          can only be from one pharmacy. Starting a new basket here removes the
          items from {basket?.pharmacyName}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              add(shop, item, { replace: true });
              setConflict(false);
              refocus.current = true;
            }}
          >
            Start a new basket here
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setConflict(false);
              refocus.current = true;
            }}
            autoFocus
          >
            Keep my basket
          </Button>
        </div>
      </div>
    );
  }

  if (full) {
    return (
      <p role="alert" className="w-full text-sm text-destructive sm:w-auto">
        Your basket is full ({MAX_BASKET_ITEMS} medicines). Reserve it first, or
        remove something.
      </p>
    );
  }

  return (
    <Button
      ref={controlRef}
      onClick={() => {
        const result = add(shop, item);
        if (result === "conflict") setConflict(true);
      }}
      disabled={!ready}
      className="w-full sm:w-auto"
      aria-label={`Add ${item.brandName} ${item.strength} from ${shop.pharmacyName} to basket`}
    >
      <Plus aria-hidden="true" />
      Add to basket
    </Button>
  );
}
