"use client";

// An active reservation with "Cancel" (and a confirm step, so a stray tap does
// not release the hold). After cancelling, the card itself switches to
// "Cancelled": no pickup code, no timer.
import { useActionState, useEffect, useRef, useState } from "react";
import { ReservationCard } from "@/components/reservation-card";
import { Button } from "@/components/ui/button";
import { cancelAction } from "./actions";

export function CancellableReservation({ reservation, headingLevel }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(cancelAction, {
    status: "idle",
  });
  const cancelRef = useRef(null);
  const messageRef = useRef(null);
  const wasConfirming = useRef(false);

  const cancelled = state.status === "cancelled";
  // Set when the countdown reaches zero while the page is open.
  const [expired, setExpired] = useState(false);
  const expiredRef = useRef(null);
  // Only move focus on expiry if the person was in the confirm step (whose
  // buttons disappear); otherwise leave their focus where it is.
  const focusOnExpiry = useRef(false);
  function handleExpire() {
    focusOnExpiry.current = confirming;
    setConfirming(false);
    setExpired(true);
  }
  useEffect(() => {
    if (expired && focusOnExpiry.current) expiredRef.current?.focus();
  }, [expired]);

  // Keep keyboard focus on something that still exists.
  useEffect(() => {
    if (cancelled) messageRef.current?.focus();
  }, [cancelled]);
  useEffect(() => {
    if (wasConfirming.current && !confirming) cancelRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  let actions;
  if (expired && !cancelled) {
    actions = (
      <p
        ref={expiredRef}
        tabIndex={-1}
        role="status"
        className="text-sm text-muted-foreground focus:outline-none"
      >
        The 30-minute hold has ended, so the pharmacy can sell these medicines
        again. Reserve again if you still need them.
      </p>
    );
  } else if (cancelled) {
    actions = (
      <p
        ref={messageRef}
        tabIndex={-1}
        role="status"
        className="text-sm text-muted-foreground focus:outline-none"
      >
        Reservation cancelled. The pharmacy can sell these medicines again.
      </p>
    );
  } else if (!confirming) {
    actions = (
      <Button
        ref={cancelRef}
        variant="outline"
        onClick={() => setConfirming(true)}
      >
        Cancel reservation
      </Button>
    );
  } else {
    actions = (
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="reservationId" value={reservation.id} />
        <p className="text-sm font-medium">Cancel this reservation?</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "Cancelling…" : "Yes, cancel it"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirming(false)}
            disabled={pending}
            autoFocus
          >
            Keep it
          </Button>
        </div>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
      </form>
    );
  }

  return (
    <ReservationCard
      reservation={
        cancelled
          ? { ...reservation, status: "cancelled", expiresAt: null }
          : expired
            ? { ...reservation, status: "expired", expiresAt: null }
            : reservation
      }
      headingLevel={headingLevel}
      actions={actions}
      onExpire={handleExpire}
    />
  );
}
