import Link from "next/link";
import { Store } from "lucide-react";
import { PageHeading } from "@/components/area-shell";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { getMyPharmacy } from "@/lib/data/pharmacy";
import { requireRole } from "@/lib/data/session";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Register your pharmacy" };

export default async function RegisterPage() {
  const user = await requireRole("pharmacist"); // not only the layout
  const pharmacy = await getMyPharmacy(user);
  const resubmit = pharmacy?.status === "rejected";

  if (pharmacy && !resubmit) {
    return (
      <>
        <PageHeading title="Register your pharmacy" />
        <EmptyState
          icon={Store}
          title="Your pharmacy is already registered"
          description={`${pharmacy.name} · ${pharmacy.status === "approved" ? "approved" : "waiting for approval"}`}
          action={
            <Link href="/pharmacy" className={buttonVariants()}>
              Go to dashboard
            </Link>
          }
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm font-medium text-primary">
        Step 2 of 2: your pharmacy
      </p>
      <PageHeading
        title={
          resubmit ? "Correct your registration" : "Register your pharmacy"
        }
        description="An admin checks your DGDA licence before customers can see your shop. We'll email you the result."
      />
      <RegisterForm
        resubmit={resubmit}
        rejectionReason={pharmacy?.rejectionReason}
        initial={
          resubmit
            ? {
                name: pharmacy.name,
                address: pharmacy.address,
                area: pharmacy.area,
                phone: pharmacy.phone,
                licenceNumber: pharmacy.licenceNumber,
                licenceExpiry: pharmacy.licenceExpiry,
              }
            : undefined
        }
      />
    </div>
  );
}
