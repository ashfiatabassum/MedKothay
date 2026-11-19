import { ClipboardList } from "lucide-react";
import { PageHeading } from "@/components/area-shell";
import { EmptyState } from "@/components/states";
import { getIncomingReservations } from "@/lib/data/pharmacy";
import { requireMyPharmacy } from "../require-pharmacy";
import { CollectCard } from "./collect-card";

export const metadata = { title: "Reservations" };

export default async function PharmacyReservationsPage() {
  const { pharmacy } = await requireMyPharmacy();
  const all = await getIncomingReservations(pharmacy.id);
  const active = all.filter((r) => r.status === "active");
  const past = all.filter((r) => r.status !== "active");

  return (
    <div className="space-y-8">
      <PageHeading
        title="Reservations"
        description="Held stock can't be sold at the counter until it is collected, cancelled or the hold ends."
      />
      <section aria-labelledby="waiting-heading" className="space-y-3">
        <h2 id="waiting-heading" className="text-lg font-semibold">
          Waiting for pickup ({active.length})
        </h2>
        {active.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            headingLevel={3}
            title="No reservations waiting"
            description="New reservations from customers appear here."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((r) => (
              <CollectCard key={r.id} reservation={r} />
            ))}
          </div>
        )}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="done-heading" className="space-y-3">
          <h2 id="done-heading" className="text-lg font-semibold">
            Earlier
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {past.map((r) => (
              <CollectCard key={r.id} reservation={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
