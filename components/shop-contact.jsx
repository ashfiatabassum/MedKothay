// Call and Directions for a pharmacy, shown before and after reserving
// (customer workflow review). Opening hours are not modelled, so we say so.
import { Navigation, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function directionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lng)}`;
}

export function ShopContact({
  name,
  phone,
  latitude,
  longitude,
  note = true,
  className,
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap gap-2">
        {phone && (
          <a
            href={`tel:${phone}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            aria-label={`Call ${name}`}
          >
            <Phone aria-hidden="true" />
            Call
          </a>
        )}
        {Number.isFinite(latitude) && Number.isFinite(longitude) && (
          <a
            href={directionsUrl(latitude, longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
            aria-label={`Directions to ${name} (opens maps)`}
          >
            <Navigation aria-hidden="true" />
            Directions
          </a>
        )}
      </div>
      {note && (
        <p className="text-xs text-muted-foreground">
          Opening hours aren&apos;t shown; call if unsure.
        </p>
      )}
    </div>
  );
}
