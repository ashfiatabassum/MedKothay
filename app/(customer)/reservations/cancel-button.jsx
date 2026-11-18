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

  // Keep keyboard focus on something that still exists.
  useEffect(() => {
    if (cancelled) messageRef.current?.focus();
  }, [cancelled]);
  useEffect(() => {
    if (wasConfirming.current && !confirming) cancelRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  let actions;
  if (cancelled) {
    actions = (
      <p
        ref={messageRef}
        tabIndex={-1}
        role="status"
        className="text-sm text-muted-foreground focus:outline-none"
      >
        Reservation cancelled. The pharmacy can sell these medicines again.
        <span className="block text-xs">
          Demo: cancelling is saved from step W3, so after a refresh this card
          shows as active again.
        </span>
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
          : reservation
      }
      headingLevel={headingLevel}
      actions={actions}
    />
  );
}
