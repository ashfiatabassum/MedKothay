// Server-side gate: the Supabase session (getClaims) and the database-owned
// profile role. Hidden links are not security; RLS is the final guard.
import { redirect } from "next/navigation";
import { AccountControls } from "@/components/account-controls";
import { AreaShell } from "@/components/area-shell";
import { getCurrentUser } from "@/lib/data/session";

export default async function AdminLayout({ children }) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/sign-in");
  return (
    <AreaShell
      area="admin"
      right={<AccountControls user={user} area="admin" />}
    >
      {children}
    </AreaShell>
  );
}
