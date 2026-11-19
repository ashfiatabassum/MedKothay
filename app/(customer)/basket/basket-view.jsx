"use client";

// The basket and "Reserve". One pharmacy, 1–5 of each medicine (D4).
// Sign-in is asked for only when reserving; the server decides who may reserve.
// Prices: the server compares them with what is shown here (D13). Retries reuse
// the same request id, so they never create a second reservation (D14).
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  MapPin,
  Minus,
  Plus,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { RxBadge } from "@/components/badges";
import { useBasket } from "@/components/basket/basket-provider";
import {
  basketFingerprint,
  finishReservationRequest,
  getBasket,
  reservationRequestId,
} from "@/components/basket/basket-store";
import { FocusMessage, SuccessHeading } from "@/components/form-field";
import { ReservationCard } from "@/components/reservation-card";
import { EmptyState, LoadingList } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  HOLD_MINUTES,
  MAX_UNITS_PER_ITEM,
  formatTaka,
  perUnit,
} from "@/lib/constants";
import { reserveAction } from "./actions";

const ALERT =
  "rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive";

function Confirmation({ reservation, basketCleared, onViewBasket }) {
  // The confirmation switches to Expired like My reservations does.
  const [expired, setExpired] = useState(false);
  return (
    <div className="space-y-4">
      <div role="status" className="space-y-1">
        <SuccessHeading>
          {expired
            ? "This reservation has expired."
            : "Reserved. Your pickup code is ready."}
        </SuccessHeading>
        <p className="text-sm text-muted-foreground">
          {expired
            ? "The 30-minute hold ended, so the pharmacy can sell these medicines again."
            : `The pharmacy holds these medicines for ${HOLD_MINUTES} minutes. Show the code at the counter and pay there. ${basketCleared ? "Your basket has been cleared." : "Your newer basket has been kept."}`}
        </p>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Demo: reservations are saved from step W3. This one is not saved yet.
        </p>
      </div>
      <ReservationCard
        reservation={
          expired
            ? { ...reservation, status: "expired", expiresAt: null }
            : reservation
        }
        onExpire={() => setExpired(true)}
      />
      <div className="flex flex-wrap gap-2">
        {onViewBasket && (
          <Button variant="outline" onClick={onViewBasket}>
            View current basket
          </Button>
        )}
        <Link
          href="/reservations"
          className={buttonVariants({ variant: "outline" })}
        >
          See my reservations
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Search again
        </Link>
      </div>
    </div>
  );
}

export function BasketView() {
  const basketApi = useBasket();
  const { basket, ready, clear, setPrices } = basketApi;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState(null);

  // Any change to the basket makes an old message stale.
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
      <Confirmation
        reservation={result.reservation}
        basketCleared={result.basketCleared}
        onViewBasket={basket ? () => setResult(null) : undefined}
      />
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
  const problemId = result?.status === "error" ? result.medicineId : null;
  const rxItems = basket.items.filter((i) => i.prescriptionOnly);

  function reserve() {
    const items = basket.items.map((i) => ({
      medicineId: i.medicineId,
      quantity: i.quantity,
      expectedPrice: i.unitPrice,
    }));
    const requestId = reservationRequestId(basket);
    setResult(null);
    startTransition(async () => {
      let res;
      try {
        res = await reserveAction({
          pharmacyId: basket.pharmacyId,
          items,
          requestId,
        });
      } catch {
        // The request may or may not have reached the server; the same id on
        // the next press means at most one reservation (D14).
        setResult({ status: "network" });
        return;
      }
      const currentAttempt = finishReservationRequest(basket, requestId);
      if (res.status === "needs-sign-in") {
        router.push("/sign-in?next=%2Fbasket");
        return;
      }
      if (res.status === "price_changed") {
        if (
          !currentAttempt ||
          basketFingerprint(getBasket()) !== basketFingerprint(basket)
        ) {
          setResult({ status: "basket-changed" });
          return;
        }
        setPrices(res.prices, basket);
      }
      if (res.status === "reserved") {
        setResult({ ...res, basketCleared: currentAttempt && clear(basket) });
        return;
      }
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
                (problemId === i.medicineId
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
                  {perUnit(i.unitPrice, i.form)}
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
        <Link
          href="/"
          className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Add another medicine from {basket.pharmacyName}
        </Link>
      </section>

      {rxItems.length > 0 && (
        <div className="flex gap-2 rounded-lg bg-rx px-3 py-2 text-sm text-rx-foreground">
          <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-medium">
              Prescription needed for{" "}
              {rxItems.map((i) => i.brandName).join(", ")}.
            </span>{" "}
            Bring it to the pharmacy. The whole basket is collected together, so
            if you can&apos;t bring the prescription, remove those medicines
            before reserving.
          </p>
        </div>
      )}

      {result?.status === "error" && (
        <FocusMessage key={result.message} role="alert" className={ALERT}>
          Nothing has been reserved. {result.message}
        </FocusMessage>
      )}
      {result?.status === "price_changed" && (
        <FocusMessage key="price" role="alert" className={ALERT}>
          Nothing has been reserved. {result.message}
        </FocusMessage>
      )}
      {result?.status === "basket-changed" && (
        <FocusMessage
          role="status"
          className="rounded-lg bg-muted px-3 py-2 text-sm"
        >
          Your basket changed while prices were being checked. Nothing was
          reserved. Review your current basket before reserving.
        </FocusMessage>
      )}
      {result?.status === "network" && (
        <FocusMessage key="network" role="alert" className={ALERT}>
          We couldn&apos;t reach the server. Check your connection and press
          Reserve again; you won&apos;t get a second reservation.
        </FocusMessage>
      )}
      {result?.status === "not-customer" && (
        <p role="alert" className={ALERT}>
          Pharmacy and admin accounts can&apos;t reserve medicines. To reserve
          for yourself, create a customer account with a different email.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={() => clear()} disabled={pending}>
          Empty basket
        </Button>
        <Button
          size="lg"
          onClick={reserve}
          disabled={pending}
          className="sm:min-w-48"
        >
          {pending
            ? "Reserving…"
            : result?.status === "price_changed"
              ? "Reserve at these prices"
              : `Reserve for ${HOLD_MINUTES} minutes`}
        </Button>
      </div>
    </div>
  );
}
