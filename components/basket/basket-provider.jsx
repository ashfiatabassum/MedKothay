"use client";

// The customer's basket: ONE pharmacy, several medicines, 1–5 units each
// (CLAUDE.md "Reservation", D4). Kept in this browser only (localStorage), as a
// convenience; the reservation itself is created on the server, which re-checks
// stock and prices. Never trust prices from here.
import { createContext, use, useCallback, useSyncExternalStore } from "react";
import {
  getBasket,
  getServerBasket,
  setBasket,
  subscribe,
} from "@/components/basket/basket-store";
import { MAX_UNITS_PER_ITEM } from "@/lib/constants";

const BasketContext = createContext(null);
const noopSubscribe = () => () => {};

const clamp = (n) =>
  Number.isFinite(n)
    ? Math.min(MAX_UNITS_PER_ITEM, Math.max(1, Math.trunc(n)))
    : 1;

export function BasketProvider({ children }) {
  // Server render and hydration see an empty basket; the stored one appears
  // right after, without a mismatch.
  const basket = useSyncExternalStore(subscribe, getBasket, getServerBasket);
  const ready = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const update = useCallback((fn) => setBasket(fn(getBasket())), []);

  /**
   * shop = { pharmacyId, pharmacyName, address }
   * item = { medicineId, brandName, strength, form, prescriptionOnly, unitPrice }
   * Returns "added" | "already" | "conflict" (another shop's basket exists).
   * With { replace: true } a basket from another shop is replaced.
   */
  const add = useCallback(
    (shop, item, { replace = false } = {}) => {
      if (basket && basket.pharmacyId !== shop.pharmacyId && !replace) {
        return "conflict";
      }
      if (
        basket?.pharmacyId === shop.pharmacyId &&
        basket.items.some((i) => i.medicineId === item.medicineId)
      ) {
        return "already";
      }
      update((prev) => {
        const base =
          prev && prev.pharmacyId === shop.pharmacyId
            ? prev
            : { ...shop, items: [] };
        return { ...base, items: [...base.items, { ...item, quantity: 1 }] };
      });
      return "added";
    },
    [basket, update],
  );

  const setQuantity = useCallback(
    (medicineId, quantity) =>
      update((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.medicineId === medicineId
                  ? { ...i, quantity: clamp(quantity) }
                  : i,
              ),
            }
          : prev,
      ),
    [update],
  );

  const remove = useCallback(
    (medicineId) =>
      update((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((i) => i.medicineId !== medicineId),
            }
          : prev,
      ),
    [update],
  );

  const clear = useCallback(() => update(() => null), [update]);

  const count = basket?.items.length ?? 0;

  return (
    <BasketContext
      value={{ basket, ready, count, add, setQuantity, remove, clear }}
    >
      {children}
    </BasketContext>
  );
}

export function useBasket() {
  const ctx = use(BasketContext);
  if (!ctx) throw new Error("useBasket must be used inside BasketProvider");
  return ctx;
}
