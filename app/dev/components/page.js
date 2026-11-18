// Temporary showcase of shared components (U1 "done when"). Removed in milestone F.
import { AreaShell, PageHeading } from "@/components/area-shell";
import { RxBadge, StockBadge, VerifiedBadge } from "@/components/badges";
import { Countdown } from "@/components/countdown";
import { PickupCode } from "@/components/pickup-code";
import { EmptyState, ErrorState, LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findArea } from "@/lib/areas";
import { formatTaka } from "@/lib/constants";
import { getMyReservations, searchMedicine } from "@/lib/data/customer";
import { formatDistance } from "@/lib/geo";

export const metadata = {
  title: "Components (dev)",
  robots: { index: false },
};

// Countdown times are computed per request, so do not prerender at build time.
export const dynamic = "force-dynamic";

function Section({ title, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export default async function ComponentsPage() {
  const dhanmondi = findArea("dhanmondi");
  const [search, reservations] = await Promise.all([
    searchMedicine({ query: "napa", lat: dhanmondi.lat, lng: dhanmondi.lng }),
    getMyReservations("u-demo-customer"),
  ]);
  const active = reservations.find((r) => r.status === "active");

  return (
    <AreaShell area="customer">
      <PageHeading
        title="Shared components"
        description="Development page for checking the theme and shared pieces. Sample data only."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Stock bands">
          <div className="flex flex-wrap gap-2">
            <StockBadge band="in" />
            <StockBadge band="low" />
            <StockBadge band="out" />
          </div>
        </Section>

        <Section title="Pharmacy and medicine badges">
          <div className="flex flex-wrap gap-2">
            <VerifiedBadge />
            <RxBadge />
          </div>
        </Section>

        <Section title="Pickup code and countdown">
          <PickupCode code={active.pickupCode} />
          <div className="flex flex-wrap gap-2">
            <Countdown expiresAt={active.expiresAt} />
            <Countdown expiresAt="2020-01-01T00:00:00Z" />
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-2">
            <Button>Reserve</Button>
            <Button variant="outline">Add to basket</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Cancel reservation</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title={`lib/data: searchMedicine("napa") from Dhanmondi`}>
          <ul className="divide-y text-sm">
            {search.withinRadius.map((r) => (
              <li
                key={`${r.pharmacyId}-${r.medicine.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  <span className="font-medium">{r.medicine.brandName}</span> at{" "}
                  {r.pharmacyName} · {formatDistance(r.distanceKm)} ·{" "}
                  {formatTaka(r.sellingPrice)}
                </span>
                <StockBadge band={r.stockBand} />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="lib/data: getMyReservations">
          <ul className="divide-y text-sm">
            {reservations.map((r) => (
              <li key={r.id} className="py-2">
                <span className="font-medium">{r.pharmacyName}</span> ·{" "}
                {r.items.length} item(s) · {r.status}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Loading state">
          <LoadingList rows={2} />
        </Section>

        <Section title="Empty and error states">
          <EmptyState
            headingLevel={3}
            title="No pharmacies within 5 km"
            description="Try another area, or check the nearest shops further away."
          />
          <ErrorState headingLevel={3} action={<Button>Try again</Button>} />
        </Section>
      </div>
    </AreaShell>
  );
}
