import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageOff, MapPin, Phone } from "lucide-react";
import { PageHeading } from "@/components/area-shell";
import { LicenceBadge } from "@/components/licence-badge";
import { getPharmacy } from "@/lib/data/admin";
import { ReviewActions } from "./review-actions";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = await getPharmacy(id);
  return { title: p ? `Review ${p.name}` : "Pharmacy not found" };
}

function Row({ label, children }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium sm:col-span-2">{children}</dd>
    </div>
  );
}

export default async function ReviewPharmacyPage({ params }) {
  const { id } = await params;
  const p = await getPharmacy(id);
  if (!p) notFound();

  const mapUrl = `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=17/${p.latitude}/${p.longitude}`;

  return (
    <div className="space-y-5">
      <Link
        href={`/admin?status=${p.status}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to {p.status} pharmacies
      </Link>
      <PageHeading
        title={p.name}
        description={`${p.areaName} · submitted ${new Date(p.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" })}`}
      />

      {p.status !== "pending" && (
        <p
          role="status"
          className={
            "rounded-xl border p-4 text-sm " +
            (p.status === "approved"
              ? "bg-in-stock text-in-stock-foreground"
              : "bg-destructive/5 text-destructive")
          }
        >
          {p.status === "approved"
            ? "Approved: this pharmacy is visible to customers."
            : `Rejected. Reason given to the owner: ${p.rejectionReason || "none recorded"}`}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="licence-heading"
          className="space-y-3 rounded-xl border bg-card p-4"
        >
          <h2 id="licence-heading" className="font-semibold">
            DGDA licence
          </h2>
          <dl className="divide-y">
            <Row label="Licence number">{p.licenceNumber}</Row>
            <Row label="Expiry date">
              <span className="flex flex-wrap items-center gap-2">
                {p.licenceExpiry}
                <LicenceBadge state={p.licenceState} />
              </span>
            </Row>
          </dl>
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted p-4 text-center text-sm text-muted-foreground">
            <ImageOff className="size-8" aria-hidden="true" />
            <p>
              The licence photo appears here from step W1, when uploads are
              stored privately.
            </p>
            <p className="text-xs">
              Check that the number and expiry on the photo match the details
              above.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="shop-heading"
          className="space-y-3 rounded-xl border bg-card p-4"
        >
          <h2 id="shop-heading" className="font-semibold">
            Shop details
          </h2>
          <dl className="divide-y">
            <Row label="Address">{p.address}</Row>
            <Row label="Area">{p.areaName}</Row>
            <Row label="Phone">
              <a
                href={`tel:${p.phone}`}
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                <Phone className="size-3.5" aria-hidden="true" />
                {p.phone}
              </a>
            </Row>
            <Row label="Location">
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                <MapPin className="size-3.5" aria-hidden="true" />
                {p.latitude}, {p.longitude} (open map)
              </a>
            </Row>
          </dl>
        </section>
      </div>

      {p.status === "pending" && (
        <ReviewActions pharmacyId={p.id} pharmacyName={p.name} />
      )}
    </div>
  );
}
