// Review status of the pharmacist's shop (D6). Shown on the dashboard; the same
// result is also emailed from W1. Covers suspension (D18) and an approved shop
// whose licence date has passed (D12).
import Link from "next/link";
import { CircleCheck, Clock, ShieldAlert, XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STYLES = {
  pending: "border-primary/30 bg-secondary text-secondary-foreground", // amber is only for pickup code + timer
  rejected: "border-destructive/40 bg-destructive/5 text-destructive",
  suspended: "border-destructive/40 bg-destructive/5 text-destructive",
  licenceExpired: "border-destructive/40 bg-destructive/5 text-destructive",
  approved:
    "border-in-stock-foreground/30 bg-in-stock text-in-stock-foreground",
};

function ResubmitLink({ children = "Correct and resubmit" }) {
  return (
    <Link
      href="/pharmacy/register"
      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-1")}
    >
      {children}
    </Link>
  );
}

export function PharmacyStatusBanner({
  status,
  rejectionReason,
  licenceExpired = false,
  licenceExpiry,
  className,
}) {
  // An approved shop with a passed licence date is shown as its own state.
  const state =
    status === "approved" && licenceExpired ? "licenceExpired" : status;
  const Icon =
    state === "approved"
      ? CircleCheck
      : state === "pending"
        ? Clock
        : state === "rejected"
          ? XCircle
          : ShieldAlert;
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-xl border p-4",
        STYLES[state],
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1 text-sm">
        {state === "pending" && (
          <>
            <p className="font-semibold">Waiting for approval</p>
            <p>
              We are checking your DGDA licence. Customers can&apos;t see your
              pharmacy yet, but you can already add your stock. We&apos;ll try
              to email you the result; it always shows here.
            </p>
          </>
        )}
        {state === "rejected" && (
          <>
            <p className="font-semibold">Registration not approved</p>
            <p>
              Reason: {rejectionReason || "No reason given."} Please correct it
              and submit again.
            </p>
            <ResubmitLink />
          </>
        )}
        {state === "suspended" && (
          <>
            <p className="font-semibold">Your pharmacy is suspended</p>
            <p>
              Customers can&apos;t see it and its waiting reservations were
              cancelled. Reason: {rejectionReason || "No reason given."}
            </p>
            <ResubmitLink>Correct and resubmit for review</ResubmitLink>
          </>
        )}
        {state === "licenceExpired" && (
          <>
            <p className="font-semibold">Your DGDA licence has expired</p>
            <p>
              It expired on {licenceExpiry}, so customers can&apos;t see your
              pharmacy. Upload the renewed licence to be reviewed again.
            </p>
            <ResubmitLink>Update licence</ResubmitLink>
          </>
        )}
        {state === "approved" && (
          <>
            <p className="font-semibold">Your pharmacy is live</p>
            <p>Customers nearby can find your stock and reserve medicines.</p>
          </>
        )}
      </div>
    </div>
  );
}
