// Pharmacies by review status. Pending first: the admin's main job.
import Link from "next/link";
import { ChevronRight, Search, Store } from "lucide-react";
import { PageHeading } from "@/components/area-shell";
import { LicenceBadge } from "@/components/licence-badge";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUSES, getPharmacyCounts, listPharmacies } from "@/lib/data/admin";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pharmacies" };

const LABEL = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};
const one = (v) => String(Array.isArray(v) ? v[0] : (v ?? ""));

export default async function AdminPharmaciesPage({ searchParams }) {
  const params = await searchParams;
  const status = STATUSES.includes(one(params.status))
    ? one(params.status)
    : "pending";
  const q = one(params.q).slice(0, 60);
  const [counts, rows] = await Promise.all([
    getPharmacyCounts(),
    listPharmacies({ status, q }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeading
        title="Pharmacies"
        description="Check each new pharmacy's DGDA licence before customers can see it."
      />

      <nav
        aria-label="Review status"
        className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
      >
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "flex h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              s === status
                ? "bg-card shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LABEL[s]}
            <span className="rounded-full bg-secondary px-2 text-xs text-secondary-foreground tabular-nums">
              {counts[s]}
            </span>
          </Link>
        ))}
      </nav>

      <form role="search" className="flex gap-2">
        <input type="hidden" name="status" value={status} />
        <label htmlFor="admin-q" className="sr-only">
          Search by name, area or licence number
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="admin-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, area or licence number"
            className="h-11 pl-9"
          />
        </div>
        <button
          type="submit"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Store}
          title={
            q
              ? `No ${LABEL[status].toLowerCase()} pharmacy matches "${q}"`
              : status === "pending"
                ? "No pharmacies waiting for review"
                : `No ${LABEL[status].toLowerCase()} pharmacies`
          }
          description={
            status === "pending" && !q
              ? "New registrations appear here. You'll review them oldest first."
              : q
                ? "Check the spelling, or clear the search to see all of them."
                : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/pharmacies/${r.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.areaName} · Licence {r.licenceNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted{" "}
                    {new Date(r.submittedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Dhaka",
                    })}
                  </p>
                  <LicenceBadge state={r.licenceState} />
                </div>
                <span className="flex shrink-0 items-center text-sm font-medium text-primary">
                  {status === "pending" ? "Review" : "View"}
                  <ChevronRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
