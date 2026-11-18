// Status badges. Every badge has text, not only colour (CLAUDE.md "Theme").
import { BadgeCheck, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STOCK_BAND_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const BAND_CLASSES = {
  in: "bg-in-stock text-in-stock-foreground",
  low: "bg-low-stock text-low-stock-foreground",
  out: "bg-out-of-stock text-out-of-stock-foreground",
};

/** band: "in" | "low" | "out". Customers only ever see the band. */
export function StockBadge({ band, className }) {
  return (
    <Badge className={cn("border-transparent", BAND_CLASSES[band], className)}>
      {STOCK_BAND_LABELS[band]}
    </Badge>
  );
}

/** Shown on approved pharmacies. */
export function VerifiedBadge({ className }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-primary/30 text-primary", className)}
    >
      <BadgeCheck aria-hidden="true" />
      Verified
    </Badge>
  );
}

/** Prescription-only medicine. */
export function RxBadge({ className }) {
  return (
    <Badge
      className={cn("border-transparent bg-rx text-rx-foreground", className)}
      title="Prescription required"
    >
      <FileText aria-hidden="true" />
      Rx only
    </Badge>
  );
}
