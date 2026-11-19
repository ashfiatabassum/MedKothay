"use client";

// One incoming reservation. The pharmacist enters the customer's 6-digit
// pickup code to mark the whole reservation collected (no partial pickup).
import { useActionState, useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import { ReservationStatusBadge, RxBadge } from "@/components/badges";
import { Countdown } from "@/components/countdown";
import {
  FormField,
  TextInput,
  useFocusFirstError,
} from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { countUnits, formatTaka } from "@/lib/constants";
import { collectAction } from "../actions";

export function CollectCard({ reservation: r }) {
  const [state, formAction, pending] = useActionState(collectAction, {
    status: "idle",
  });
  const formRef = useRef(null);
  useFocusFirstError(formRef, state);
  const doneRef = useRef(null);
  const collected = state.status === "collected";
  // Set when the countdown reaches zero while the page is open: the hold is
  // over, so the collect form goes away (the server refuses it anyway).
  const [expired, setExpired] = useState(false);
  const status = collected ? "collected" : expired ? "expired" : r.status;
  const total = r.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  useEffect(() => {
    if (collected) doneRef.current?.focus();
  }, [collected]);

  return (
    <article className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{r.customerName}</h3>
          <p className="text-sm text-muted-foreground">
            Reserved{" "}
            {new Date(r.createdAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Dhaka",
            })}
          </p>
        </div>
        <ReservationStatusBadge status={status} className="shrink-0" />
      </div>

      {status === "active" && (
        <Countdown expiresAt={r.expiresAt} onExpire={() => setExpired(true)} />
      )}
      {expired && !collected && (
        <p role="status" className="text-sm text-muted-foreground">
          The hold has ended. These units can be sold at the counter again.
        </p>
      )}

      <ul className="divide-y text-sm">
        {r.items.map((i) => (
          <li
            key={i.medicineId}
            className="flex items-center justify-between gap-2 py-2"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span>
                <span className="font-medium">{i.name}</span> ×{" "}
                {countUnits(i.quantity, i.form)}
              </span>
              {i.prescriptionOnly && <RxBadge />}
            </span>
            <span className="tabular-nums">
              {formatTaka(i.quantity * i.unitPrice)}
            </span>
          </li>
        ))}
        <li className="flex justify-between py-2 font-semibold">
          <span>{status === "active" ? "Total to collect" : "Total"}</span>
          <span className="tabular-nums">{formatTaka(total)}</span>
        </li>
      </ul>

      {r.items.some((i) => i.prescriptionOnly) && status === "active" && (
        <p className="rounded-lg bg-rx px-3 py-2 text-sm text-rx-foreground">
          Check the prescription for the Rx medicines before handing them over.
        </p>
      )}

      {collected ? (
        <p
          ref={doneRef}
          tabIndex={-1}
          role="status"
          className="flex items-center gap-1 text-sm text-in-stock-foreground focus:outline-none"
        >
          <CircleCheck className="size-4" aria-hidden="true" />
          Collected. Stock is reduced for every item.
        </p>
      ) : status === "active" ? (
        <form
          ref={formRef}
          action={formAction}
          noValidate
          className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="reservationId" value={r.id} />
          <div className="flex-1">
            <FormField
              id={`code-${r.id}`}
              label="Pickup code from the customer"
              error={state.status === "error" ? state.message : null}
            >
              {(a) => (
                <TextInput
                  id={`code-${r.id}`}
                  name="code"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={7}
                  defaultValue={state.code ?? ""}
                  placeholder="6 digits"
                  className="font-mono tracking-widest"
                  {...a}
                />
              )}
            </FormField>
          </div>
          <Button type="submit" disabled={pending} className="h-11">
            {pending ? "Checking…" : "Mark collected"}
          </Button>
        </form>
      ) : null}
    </article>
  );
}
