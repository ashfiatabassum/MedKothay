import Link from "next/link";
import { CalendarClock, LogIn } from "lucide-react";
import { PageHeading } from "@/components/area-shell";
import { ReservationCard } from "@/components/reservation-card";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { getMyReservations } from "@/lib/data/customer";
import { getCurrentUser } from "@/lib/data/session";
import { CancellableReservation } from "./cancel-button";

export const metadata = { title: "My reservations" };

export default async function ReservationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <PageHeading title="My reservations" />
        <EmptyState
          icon={LogIn}
          title="Sign in to see your reservations"
          action={
            <Link
              href="/sign-in?next=%2Freservations"
              className={buttonVariants()}
            >
              Sign in
            </Link>
          }
        />
      </>
    );
  }

  if (user.role !== "customer") {
    return (
      <>
        <PageHeading title="My reservations" />
        <EmptyState
          title="Reservations are for customer accounts"
          description="Pharmacy and admin accounts can't reserve medicines."
        />
      </>
    );
  }

  const reservations = await getMyReservations(user.id);
  const active = reservations.filter((r) => r.status === "active");
  const past = reservations.filter((r) => r.status !== "active");

  return (
    <>
      <PageHeading
        title="My reservations"
        description="Show the pickup code at the pharmacy counter and pay there."
      />
      {reservations.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No reservations yet"
          description="Search for a medicine, add it to your basket and reserve it."
          action={
            <Link href="/" className={buttonVariants()}>
              Search medicines
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="active-heading" className="space-y-3">
            <h2 id="active-heading" className="text-lg font-semibold">
              Waiting for pickup
            </h2>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing waiting for pickup.
              </p>
            ) : (
              active.map((r) => (
                <CancellableReservation
                  key={r.id}
                  reservation={r}
                  headingLevel={3}
                />
              ))
            )}
          </section>
          {past.length > 0 && (
            <section aria-labelledby="past-heading" className="space-y-3">
              <h2 id="past-heading" className="text-lg font-semibold">
                Past
              </h2>
              {past.map((r) => (
                <ReservationCard key={r.id} reservation={r} headingLevel={3} />
              ))}
            </section>
          )}
        </div>
      )}
    </>
  );
}
