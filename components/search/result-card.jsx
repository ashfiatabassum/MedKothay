// One search result: a medicine at one pharmacy. Shows the stock BAND only.
import { MapPin } from "lucide-react";
import { RxBadge, StockBadge, VerifiedBadge } from "@/components/badges";
import { AddToBasketButton } from "@/components/search/add-to-basket-button";
import { ShopContact } from "@/components/shop-contact";
import { findArea } from "@/lib/areas";
import { formatTaka, unitOf } from "@/lib/constants";
import { formatDistance } from "@/lib/geo";

/**
 * `fromAreaName`: set when the customer picked an area instead of sharing their
 * location, so the distance is measured from that area's centre (approximate).
 */
export function ResultCard({ result, fromAreaName }) {
  const { medicine: m } = result;
  const shop = {
    pharmacyId: result.pharmacyId,
    pharmacyName: result.pharmacyName,
    address: result.address,
  };
  const item = {
    medicineId: m.id,
    brandName: m.brandName,
    strength: m.strength,
    form: m.form,
    prescriptionOnly: m.prescriptionOnly,
    unitPrice: result.sellingPrice, // shown; the server compares it on reserve (D13)
  };
  const distance = formatDistance(result.distanceKm);

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-semibold">
            {m.brandName}{" "}
            <span className="font-normal text-muted-foreground">
              {m.strength} · {m.form}
            </span>
          </h3>
          <p className="text-sm text-muted-foreground">
            {m.genericName} · {m.manufacturer}
          </p>
        </div>
        <p className="text-lg font-semibold tabular-nums">
          {formatTaka(result.sellingPrice)}
          <span className="text-xs font-normal text-muted-foreground">
            {" "}
            per {unitOf(m.form)}
          </span>
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StockBadge band={result.stockBand} />
        {result.verified && <VerifiedBadge />}
        {m.prescriptionOnly && <RxBadge />}
      </div>

      <div className="mt-3 space-y-3 border-t pt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-medium">{result.pharmacyName}</p>
            <p className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {fromAreaName
                  ? `≈ ${distance} from the centre of ${fromAreaName}`
                  : `${distance} away`}{" "}
                · {findArea(result.area)?.name ?? result.address}
              </span>
            </p>
          </div>
          <AddToBasketButton
            shop={shop}
            item={item}
            disabled={result.stockBand === "out"}
          />
        </div>
        <ShopContact
          name={result.pharmacyName}
          phone={result.phone}
          latitude={result.latitude}
          longitude={result.longitude}
        />
      </div>
    </li>
  );
}
