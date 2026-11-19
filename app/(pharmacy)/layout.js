// Server-side gate: the Supabase session (getClaims) and the database-owned
// profile role. A pending shop may still use these pages. Hidden links are
// not security; RLS is the final guard.
import { redirect } from "next/navigation";
import { AccountControls } from "@/components/account-controls";
import { AreaShell } from "@/components/area-shell";
import { getCurrentUser } from "@/lib/data/session";
import { getMyPharmacy } from "@/lib/data/pharmacy";

export default async function PharmacyLayout({ children }) {
  const user = await getCurrentUser();
  if (user?.role !== "pharmacist") redirect("/sign-in");
  // Until a shop is registered there is nothing to manage: no menu, only step 2.
  const pharmacy = await getMyPharmacy(user);
  return (
    <AreaShell
      area="pharmacy"
      links={pharmacy ? undefined : []}
      right={<AccountControls user={user} area="pharmacy" />}
    >
      {children}
    </AreaShell>
  );
}
