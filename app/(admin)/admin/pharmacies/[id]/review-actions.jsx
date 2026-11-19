"use client";

// Decisions on one pharmacy (admin):
// - pending: checklist, Approve (with a confirmation naming the shop and
//   licence; refused for an expired licence, D17) or Reject with a reason;
// - approved: Suspend with a reason (D18).
// The owner sees the result on their dashboard; email is best effort (D6).
import { useActionState, useRef, useState } from "react";
import { CircleCheck, XCircle } from "lucide-react";
import {
  FocusMessage,
  FormField,
  useFocusFirstError,
  useReturnFocus,
} from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { approveAction, rejectAction, suspendAction } from "../../actions";

const IDLE = { status: "idle" };

const CHECKLIST = [
  "The licence photo is clear and readable",
  "Licence number, shop name and address match the photo",
  "The licence covers retail sale and has not expired",
  "No duplicate-licence warning above, or you have resolved it",
];

const EMAIL_NOTE =
  "We'll try to email the owner; their dashboard always shows the result. Demo: nothing is saved and no email is sent until step W1.";

function Done({ ok, children }) {
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
        {children}
        <span className="block text-xs opacity-80">{EMAIL_NOTE}</span>
      </span>
    </FocusMessage>
  );
}

/**
 * A reason form shared by Reject and Suspend. `state` is the result of THIS
 * opening only (IDLE otherwise), so reopening never shows an old error.
 */
function ReasonForm({
  id,
  pharmacyId,
  state,
  formAction,
  onSubmit,
  busy,
  label,
  hint,
  submit,
  onCancel,
}) {
  const formRef = useRef(null);
  useFocusFirstError(formRef, state);
  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="space-y-3"
    >
      <input type="hidden" name="pharmacyId" value={pharmacyId} />
      <FormField
        id={id}
        label={label}
        hint={hint}
        error={state.fieldErrors?.reason}
      >
        {(a) => (
          <textarea
            id={id}
            name="reason"
            rows={3}
            maxLength={300}
            required
            autoFocus
            defaultValue={state.values?.reason ?? ""}
            aria-invalid={a.invalid || undefined}
            aria-describedby={a.describedBy}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive"
          />
        )}
      </FormField>
      {state.status === "error" && state.message && (
        <FocusMessage
          key={state.message}
          role="alert"
          className="text-sm text-destructive"
        >
          {state.message}
        </FocusMessage>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={busy}>
          {busy ? "Saving…" : submit}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ReviewActions({ pharmacy: p }) {
  const [approve, approveFormAction, approving] = useActionState(
    approveAction,
    IDLE,
  );
  const [reject, rejectFormAction, rejecting] = useActionState(
    rejectAction,
    IDLE,
  );
  const [suspend, suspendFormAction, suspending] = useActionState(
    suspendAction,
    IDLE,
  );
  // choose | confirm-approve | reject | suspend
  const [mode, setMode] = useState("choose");
  // Each opening of a reason form is a new "round"; results only count for the
  // round in which they were submitted.
  const [round, setRound] = useState(0);
  const [submittedRound, setSubmittedRound] = useState(null);
  const approveButtonRef = useReturnFocus(mode === "confirm-approve");
  const busy = approving || rejecting || suspending;
  const open = (m) => {
    setRound((n) => n + 1);
    setMode(m);
  };
  const forThisRound = (s) => (submittedRound === round ? s : IDLE);

  if (approve.status === "approved")
    return <Done ok>{p.name} approved. It becomes visible to customers.</Done>;
  if (reject.status === "rejected")
    return (
      <Done ok={false}>
        {p.name} not approved. The owner sees your reason on their dashboard.
      </Done>
    );
  if (suspend.status === "suspended")
    return (
      <Done ok={false}>
        {p.name} suspended. It is hidden from customers and its waiting
        reservations are cancelled. The owner sees your reason.
      </Done>
    );

  if (p.status === "approved") {
    return (
      <section
        aria-labelledby="decision-heading"
        className="space-y-3 rounded-xl border bg-card p-4"
      >
        <h2 id="decision-heading" className="font-semibold">
          Take down
        </h2>
        {mode === "suspend" ? (
          <ReasonForm
            key={round}
            id="suspend-reason"
            pharmacyId={p.id}
            state={forThisRound(suspend)}
            formAction={suspendFormAction}
            onSubmit={() => setSubmittedRound(round)}
            busy={busy}
            label="Reason for the owner"
            hint="Say what was found, e.g. 'The licence number belongs to another shop.' The owner sees this."
            submit="Suspend pharmacy"
            onCancel={() => setMode("choose")}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Suspending hides this pharmacy from customers at once and cancels
              its waiting reservations. The owner can correct and resubmit.
            </p>
            <Button variant="outline" onClick={() => open("suspend")}>
              Suspend…
            </Button>
          </>
        )}
      </section>
    );
  }

  const expired = p.licenceState === "expired";

  return (
    <section
      aria-labelledby="decision-heading"
      className="space-y-3 rounded-xl border bg-card p-4"
    >
      <h2 id="decision-heading" className="font-semibold">
        Decision
      </h2>
      <div className="rounded-lg bg-muted p-3 text-sm">
        <p className="font-medium">Before approving, check:</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {CHECKLIST.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>

      {mode === "choose" && (
        <div className="space-y-2">
          {approve.status === "error" && approve.message && (
            <FocusMessage
              key={approve.message}
              role="alert"
              className="text-sm text-destructive"
            >
              {approve.message}
            </FocusMessage>
          )}
          {expired && (
            <p className="text-sm text-destructive">
              The licence expired on {p.licenceExpiry}, so this pharmacy
              can&apos;t be approved. Reject it and ask for the renewed licence.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              ref={approveButtonRef}
              size="lg"
              disabled={busy || expired}
              onClick={() => setMode("confirm-approve")}
            >
              Approve…
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={busy}
              onClick={() => open("reject")}
            >
              Reject…
            </Button>
          </div>
        </div>
      )}

      {mode === "confirm-approve" && (
        <form
          action={async (fd) => {
            await approveFormAction(fd);
            setMode("choose");
          }}
          className="space-y-3 rounded-lg border border-primary/30 p-3"
        >
          <input type="hidden" name="pharmacyId" value={p.id} />
          <p className="text-sm">
            Approve <span className="font-semibold">{p.name}</span> with licence{" "}
            <span className="font-mono font-semibold">{p.licenceNumber}</span>?
            It will appear in customer searches.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} autoFocus>
              {approving ? "Approving…" : "Yes, approve"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setMode("choose")}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {mode === "reject" && (
        <ReasonForm
          key={round}
          id="reject-reason"
          pharmacyId={p.id}
          state={forThisRound(reject)}
          formAction={rejectFormAction}
          onSubmit={() => setSubmittedRound(round)}
          busy={busy}
          label="Reason for the owner"
          hint="Say what to fix, e.g. 'The licence photo is blurry; upload a clearer one.' The owner sees this."
          submit="Reject with this reason"
          onCancel={() => setMode("choose")}
        />
      )}
    </section>
  );
}
