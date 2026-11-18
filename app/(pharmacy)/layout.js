// TODO(W1): AUTHORIZATION. Read the session on the server (lib/supabase/server.js,
// supabase.auth.getClaims()) and redirect to /sign-in unless the user has
// role 'pharmacist' (and a pharmacy_id); a pending shop may still use these pages. Hidden links are not security; RLS is the final guard.
import { redirect } from "next/navigation";
import { AccountControls } from "@/components/account-controls";
import { AreaShell } from "@/components/area-shell";
import { getCurrentUser } from "@/lib/data/session";

export default async function PharmacyLayout({ children }) {
  const user = await getCurrentUser();
  // Server-side gate (security review U2). With the demo session this already
  // behaves like W1; W1 swaps getCurrentUser() for the Supabase session.
  if (user?.role !== "pharmacist") redirect("/sign-in");
  return (
    <AreaShell
      area="pharmacy"
      right={<AccountControls user={user} area="pharmacy" />}
    >
      {children}
    </AreaShell>
  );
}
