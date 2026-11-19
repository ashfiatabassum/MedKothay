"use client";

// Approve, or reject with a reason the owner will see (and receive by email from W1).
import { useActionState, useRef, useState } from "react";
import { CircleCheck, XCircle } from "lucide-react";
import {
  FocusMessage,
  FormField,
  useFocusFirstError,
} from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { approveAction, rejectAction } from "../../actions";

export function ReviewActions({ pharmacyId, pharmacyName }) {
  const [approve, approveFormAction, approving] = useActionState(
    approveAction,
    { status: "idle" },
  );
  const [reject, rejectFormAction, rejecting] = useActionState(rejectAction, {
    status: "idle",
  });
  const [mode, setMode] = useState("choose"); // choose | reject
  // Which action ran last, so an old error from the other one is not shown.
  const [last, setLast] = useState(null);
  const rejectRef = useRef(null);
  useFocusFirstError(rejectRef, reject);

  if (approve.status === "approved" || reject.status === "rejected") {
    const ok = approve.status === "approved";
    return (
      <FocusMessage
        className={
          "flex gap-2 rounded-xl border p-4 text-sm " +
          (ok
            ? "bg-in-stock text-in-stock-foreground"
            : "bg-destructive/5 text-destructive")
        }
      >
        {ok ? (
          <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
        ) : (
          <XCircle className="size-5 shrink-0" aria-hidden="true" />
        )}
        <span>
          {ok
            ? `${pharmacyName} approved. It becomes visible to customers and the owner is emailed.`
            : `${pharmacyName} not approved. The owner sees your reason on their dashboard and is emailed.`}
          <span className="block text-xs opacity-80">
            Demo: nothing is saved and no email is sent until step W1.
          </span>
        </span>
      </FocusMessage>
    );
  }

  const busy = approving || rejecting;

  return (
    <section
      aria-labelledby="decision-heading"
      className="space-y-3 rounded-xl border bg-card p-4"
    >
      <h2 id="decision-heading" className="font-semibold">
        Decision
      </h2>
      {(() => {
        const s =
          last === "reject" ? reject : last === "approve" ? approve : null;
        return s?.status === "error" && s.message ? (
          <FocusMessage
            key={s.message}
            role="alert"
            className="text-sm text-destructive"
          >
            {s.message}
          </FocusMessage>
        ) : null;
      })()}

      {mode === "choose" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={approveFormAction} onSubmit={() => setLast("approve")}>
            <input type="hidden" name="pharmacyId" value={pharmacyId} />
            <Button
              type="submit"
              size="lg"
              disabled={busy}
              className="w-full sm:w-auto"
            >
              {approving ? "Approving…" : "Approve pharmacy"}
            </Button>
          </form>
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setLast(null);
              setMode("reject");
            }}
          >
            Reject…
          </Button>
        </div>
      ) : (
        <form
          ref={rejectRef}
          action={rejectFormAction}
          onSubmit={() => setLast("reject")}
          noValidate
          className="space-y-3"
        >
          <input type="hidden" name="pharmacyId" value={pharmacyId} />
          <FormField
            id="reject-reason"
            label="Reason for the owner"
            hint="Say what to fix, e.g. 'The licence photo is blurry; upload a clearer one.' The owner sees this."
            error={last === "reject" ? reject.fieldErrors?.reason : undefined}
          >
            {(a) => (
              <textarea
                id="reject-reason"
                name="reason"
                rows={3}
                maxLength={300}
                required
                autoFocus
                defaultValue={
                  last === "reject" ? (reject.values?.reason ?? "") : ""
                }
                aria-invalid={a.invalid || undefined}
                aria-describedby={a.describedBy}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive"
              />
            )}
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" disabled={busy}>
              {rejecting ? "Rejecting…" : "Reject with this reason"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setLast(null);
                setMode("choose");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
