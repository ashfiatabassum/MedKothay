"use client";

// The basket and "Reserve". One pharmacy, 1–5 of each medicine (D4).
// Sign-in is asked for only when reserving; the server decides who may reserve.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { RxBadge } from "@/components/badges";
import { useBasket } from "@/components/basket/basket-provider";
import { SuccessHeading } from "@/components/form-field";
import { ReservationCard } from "@/components/reservation-card";
import { EmptyState, LoadingList } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { HOLD_MINUTES, MAX_UNITS_PER_ITEM, formatTaka } from "@/lib/constants";
import { reserveAction } from "./actions";

export function BasketView() {
  const basketApi = useBasket();
  const { basket, ready, clear } = basketApi;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState(null);
  // Any change to the basket makes an old "not enough stock" message stale.
  const setQuantity = (id, q) => {
    setResult(null);
    basketApi.setQuantity(id, q);
  };
  const remove = (id) => {
    setResult(null);
    basketApi.remove(id);
  };

  if (result?.status === "reserved") {
    return (
      <div className="space-y-4">
        <div role="status" className="space-y-1">
          <SuccessHeading>Reserved. Your pickup code is ready.</SuccessHeading>
          <p className="text-sm text-muted-foreground">
            The pharmacy holds these medicines for {HOLD_MINUTES} minutes. Show
            the code at the counter and pay there.
          </p>
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Demo: reservations are saved from step W3. This one is not saved
            yet.
          </p>
        </div>
        <ReservationCard reservation={result.reservation} />
        <Link
          href="/reservations"
          className={buttonVariants({ variant: "outline" })}
        >
          See my reservations
        </Link>
      </div>
    );
  }

  if (!ready) return <LoadingList rows={2} label="Loading your basket" />;

  if (!basket) {
    return (
      <EmptyState
        icon={ShoppingBasket}
        title="Your basket is empty"
        description="Search for a medicine and add it from a pharmacy near you."
        action={
          <Link href="/" className={buttonVariants()}>
            Search medicines
          </Link>
        }
      />
    );
  }

  const total = basket.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const shortId = result?.status === "error" ? result.medicineId : null;

  function reserve() {
    setResult(null);
    startTransition(async () => {
      const res = await reserveAction({
        pharmacyId: basket.pharmacyId,
        items: basket.items.map((i) => ({
          medicineId: i.medicineId,
          quantity: i.quantity,
        })),
      });
      if (res.status === "needs-sign-in") {
        router.push("/sign-in?next=%2Fbasket");
        return;
      }
      if (res.status === "reserved") clear();
      setResult(res);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">{basket.pharmacyName}</h2>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          {basket.address}
        </p>

        <ul className="mt-3 divide-y">
          {basket.items.map((i) => (
            <li
              key={i.medicineId}
              className={
                "flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between" +
                (shortId === i.medicineId
                  ? " rounded-lg bg-destructive/5 px-2"
                  : "")
              }
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{i.brandName}</span>
                  <span className="text-sm text-muted-foreground">
                    {i.strength} · {i.form}
                  </span>
                  {i.prescriptionOnly && <RxBadge />}
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {formatTaka(i.unitPrice)} each
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex items-center rounded-lg border"
                  role="group"
                  aria-label={`Quantity of ${i.brandName}`}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity(i.medicineId, i.quantity - 1)}
                    disabled={i.quantity <= 1 || pending}
                    aria-label={`One less ${i.brandName}`}
                  >
                    <Minus aria-hidden="true" />
                  </Button>
                  <output
                    aria-live="polite"
                    className="w-8 text-center font-medium tabular-nums"
                  >
                    {i.quantity}
                  </output>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity(i.medicineId, i.quantity + 1)}
                    disabled={i.quantity >= MAX_UNITS_PER_ITEM || pending}
                    aria-label={`One more ${i.brandName}`}
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                </div>
                <span className="w-16 text-right font-medium tabular-nums">
                  {formatTaka(i.quantity * i.unitPrice)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(i.medicineId)}
                  disabled={pending}
                  aria-label={`Remove ${i.brandName}`}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex justify-between border-t pt-3 font-semibold">
          <span>Estimated total</span>
          <span className="tabular-nums">{formatTaka(total)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Up to {MAX_UNITS_PER_ITEM} of each medicine. You pay at the pharmacy;
          the price is confirmed when you reserve.
        </p>
      </section>

      {result?.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {result.message}
        </p>
      )}
      {result?.status === "not-customer" && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          Pharmacy and admin accounts can&apos;t reserve medicines. To reserve
          for yourself, create a customer account with a different email.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={clear} disabled={pending}>
          Empty basket
        </Button>
        <Button
          size="lg"
          onClick={reserve}
          disabled={pending}
          className="sm:min-w-48"
        >
          {pending ? "Reserving…" : `Reserve for ${HOLD_MINUTES} minutes`}
        </Button>
      </div>
    </div>
  );
}
