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
            ? p.licenceState === "expired"
              ? `Approved, but the licence expired on ${p.licenceExpiry}: hidden from customers until the owner updates it.`
              : "Approved: this pharmacy is visible to customers."
            : `${p.status === "suspended" ? "Suspended" : "Rejected"}. Reason given to the owner: ${p.rejectionReason || "none recorded"}`}
        </p>
      )}

      {p.duplicates.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p className="font-semibold">Same licence number as another shop</p>
          <ul className="mt-1 list-disc pl-5">
            {p.duplicates.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/admin/pharmacies/${d.id}`}
                  className="underline underline-offset-4"
                >
                  {d.name}
                </Link>{" "}
                ({d.status})
              </li>
            ))}
          </ul>
          <p className="mt-1">
            A licence can move to a new owner, but check this before deciding.
          </p>
        </div>
      )}

      {p.status === "pending" && p.previousRejectionReason && (
        <p className="rounded-xl border bg-muted p-4 text-sm">
          <span className="font-semibold">Resubmitted.</span> Last time it was
          not approved because: {p.previousRejectionReason}
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
            <Row label="Last reviewed">
              {p.reviewedAt
                ? new Date(p.reviewedAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Dhaka",
                  })
                : "Not reviewed yet"}
            </Row>
            {p.reviewedBy && <Row label="Reviewed by">{p.reviewedBy}</Row>}
            <Row label="Expiry date">
              <span className="flex flex-wrap items-center gap-2">
                {p.licenceExpiry}
                <LicenceBadge state={p.licenceState} />
              </span>
            </Row>
          </dl>
          <div className="rounded-lg border bg-muted p-3">
            {p.licencePhotoUrl ? (
              // Signed for this admin review only; the bucket itself is private.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.licencePhotoUrl}
                alt={`Licence submitted by ${p.name}`}
                className="max-h-[32rem] w-full object-contain"
              />
            ) : (
              <p className="text-sm">
                The licence photo is unavailable. Refresh and try again.
              </p>
            )}
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
              <span className="block text-xs font-normal text-muted-foreground">
                {p.locationSource === "device"
                  ? "Set from the owner's phone location."
                  : "Area centre only: the exact shop position was not shared."}
              </span>
            </Row>
          </dl>
        </section>
      </div>

      {(p.status === "pending" || p.status === "approved") && (
        <ReviewActions pharmacy={p} />
      )}
    </div>
  );
}
