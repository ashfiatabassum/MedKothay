// Review status of the pharmacist's shop (D6). Shown on the dashboard; the same
// result is also emailed from W1.
import Link from "next/link";
import { CircleCheck, Clock, XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STYLES = {
  pending: "border-primary/30 bg-secondary text-secondary-foreground", // amber is only for pickup code + timer
  rejected: "border-destructive/40 bg-destructive/5 text-destructive",
  approved:
    "border-in-stock-foreground/30 bg-in-stock text-in-stock-foreground",
};

export function PharmacyStatusBanner({ status, rejectionReason, className }) {
  const Icon =
    status === "approved"
      ? CircleCheck
      : status === "rejected"
        ? XCircle
        : Clock;
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-xl border p-4",
        STYLES[status],
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1 text-sm">
        {status === "pending" && (
          <>
            <p className="font-semibold">Waiting for approval</p>
            <p>
              We are checking your DGDA licence. Customers can&apos;t see your
              pharmacy yet, but you can already add your stock. We&apos;ll email
              you the result.
            </p>
          </>
        )}
        {status === "rejected" && (
          <>
            <p className="font-semibold">Registration not approved</p>
            <p>
              Reason: {rejectionReason || "No reason given."} Please correct it
              and submit again.
            </p>
            <Link
              href="/pharmacy/register"
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "mt-1",
              )}
            >
              Correct and resubmit
            </Link>
          </>
        )}
        {status === "approved" && (
          <>
            <p className="font-semibold">Your pharmacy is live</p>
            <p>Customers nearby can find your stock and reserve medicines.</p>
          </>
        )}
      </div>
    </div>
  );
}
