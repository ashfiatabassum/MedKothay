// A reservation: shop, items, total, status; pickup code and countdown while
// active. Used on the basket confirmation and on "My reservations".
import { Phone, MapPin } from "lucide-react";
import { ReservationStatusBadge, RxBadge } from "@/components/badges";
import { Countdown } from "@/components/countdown";
import { PickupCode } from "@/components/pickup-code";
import { formatTaka } from "@/lib/constants";

export function ReservationCard({
  reservation: r,
  headingLevel = 2,
  actions,
  onExpire,
}) {
  const Heading = `h${headingLevel}`;
  const total = r.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const active = r.status === "active";
  const needsPrescription = r.items.some((i) => i.medicine.prescriptionOnly);

  return (
    <article className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="font-semibold">{r.pharmacyName}</Heading>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {r.pharmacyAddress}
          </p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            <a
              href={`tel:${r.pharmacyPhone}`}
              className="underline-offset-4 hover:underline"
            >
              {r.pharmacyPhone}
            </a>
          </p>
        </div>
        <ReservationStatusBadge status={r.status} className="shrink-0" />
      </div>

      {active && (
        <div className="space-y-2">
          <PickupCode code={r.pickupCode} />
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Countdown expiresAt={r.expiresAt} onExpire={onExpire} />
            <span>Pick up before the hold ends, or it is released.</span>
          </div>
        </div>
      )}

      <ul className="divide-y text-sm">
        {r.items.map((i) => (
          <li
            key={i.medicine.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span>
                <span className="font-medium">{i.medicine.brandName}</span>{" "}
                {i.medicine.strength} × {i.quantity}
              </span>
              {i.medicine.prescriptionOnly && <RxBadge />}
            </span>
            <span className="tabular-nums">
              {formatTaka(i.quantity * i.unitPrice)}
            </span>
          </li>
        ))}
        <li className="flex justify-between py-2 font-semibold">
          <span>{active ? "Total, pay at the pharmacy" : "Total"}</span>
          <span className="tabular-nums">{formatTaka(total)}</span>
        </li>
      </ul>

      {active && needsPrescription && (
        <p className="rounded-lg bg-rx px-3 py-2 text-sm text-rx-foreground">
          Bring your prescription for the Rx medicines.
        </p>
      )}

      {actions}
    </article>
  );
}
