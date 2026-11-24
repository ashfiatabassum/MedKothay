// AI prescription reading (S1): photo → medicine names → edit → search.
import Link from "next/link";
import { LogIn } from "lucide-react";
import { PageHeading } from "@/components/area-shell";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/data/session";
import { PrescriptionReader } from "./prescription-reader";

export const metadata = { title: "Search from a prescription" };

const TITLE = "Search from a prescription";

export default async function PrescriptionPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <PageHeading title={TITLE} />
        <EmptyState
          icon={LogIn}
          title="Sign in to read a prescription"
          description="Reading a photo uses an AI service, so it needs a customer account. You can still type medicine names in search without signing in."
          action={
            <Link
              href="/sign-in?next=%2Fprescription"
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
        <PageHeading title={TITLE} />
        <EmptyState
          title="Prescription reading is for customer accounts"
          description="Pharmacy and admin accounts can't reserve medicines."
        />
      </>
    );
  }

  return (
    <>
      <PageHeading
        title={TITLE}
        description="Take a clear photo of the prescription. We list the medicine names; you check them and search."
      />
      <PrescriptionReader />
    </>
  );
}
