import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/data/session";
import { getMyPharmacy } from "@/lib/data/pharmacy";

/**
 * For pharmacy pages that need a shop. The layout already ensures the role is
 * pharmacist; a pharmacist who has not registered a shop goes to step 2.
 */
export async function requireMyPharmacy() {
  const user = await requireRole("pharmacist"); // not only the layout
  const pharmacy = await getMyPharmacy(user);
  if (!pharmacy) redirect("/pharmacy/register");
  return { user, pharmacy };
}
