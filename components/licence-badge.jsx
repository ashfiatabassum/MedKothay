// Warns the admin about a DGDA licence that is expired or about to expire.
import { Badge } from "@/components/ui/badge";
import { LICENCE_WARN_DAYS } from "@/lib/constants";

export function LicenceBadge({ state }) {
  if (state === "valid") return null;
  return (
    <Badge className="border-transparent bg-destructive/10 text-destructive">
      {state === "expired"
        ? "Licence expired"
        : state === "unknown"
          ? "Expiry date unreadable"
          : `Licence expires within ${LICENCE_WARN_DAYS} days`}
    </Badge>
  );
}
