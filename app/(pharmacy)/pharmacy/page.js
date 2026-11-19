import Link from "next/link";
import {
  ClipboardList,
  PackageMinus,
  ReceiptText,
  ShoppingCart,
  Boxes,
} from "lucide-react";
import { PageHeading } from "@/components/area-shell";
import { PharmacyStatusBanner } from "@/components/pharmacy-status-banner";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatTaka } from "@/lib/constants";
import { getDashboard } from "@/lib/data/pharmacy";
import { cn } from "@/lib/utils";
import { requireMyPharmacy } from "./require-pharmacy";

export const metadata = { title: "Dashboard" };

function Stat({ icon: Icon, label, value, detail, href, tone }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </div>
        <p className={cn("text-3xl font-semibold tabular-nums", tone)}>
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{detail}</p>
        {href && (
          <Link
            href={href.url}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {href.label}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default async function PharmacyDashboard() {
  const { pharmacy } = await requireMyPharmacy();
  const d = await getDashboard(pharmacy.id);

  return (
    <div className="space-y-6">
      <PageHeading title={pharmacy.name} description={pharmacy.address} />
      <PharmacyStatusBanner
        status={pharmacy.status}
        rejectionReason={pharmacy.rejectionReason}
      />

      <section aria-labelledby="today-heading" className="space-y-3">
        <h2 id="today-heading" className="text-lg font-semibold">
          Today
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            icon={ReceiptText}
            label="Counter sales"
            value={formatTaka(d.salesTotalToday)}
            detail={`${d.salesToday} ${d.salesToday === 1 ? "sale" : "sales"} today`}
          />
          <Stat
            icon={PackageMinus}
            label="Low stock"
            value={d.lowStock}
            tone={d.lowStock > 0 ? "text-low-stock-foreground" : undefined}
            detail={`1 to 5 left · ${d.outOfStock} out of stock`}
            href={{ url: "/pharmacy/inventory", label: "Check inventory" }}
          />
          <Stat
            icon={ClipboardList}
            label="Waiting for pickup"
            value={d.activeReservations}
            tone={d.activeReservations > 0 ? "text-primary" : undefined}
            detail="Active reservations"
            href={{ url: "/pharmacy/reservations", label: "See reservations" }}
          />
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/pharmacy/counter"
          className={buttonVariants({ size: "lg" })}
        >
          <ShoppingCart aria-hidden="true" />
          New counter sale
        </Link>
        <Link
          href="/pharmacy/inventory"
          className={buttonVariants({ size: "lg", variant: "outline" })}
        >
          <Boxes aria-hidden="true" />
          Manage inventory
        </Link>
      </div>
    </div>
  );
}
