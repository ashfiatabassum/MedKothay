// TODO(W1): AUTHORIZATION. Read the session on the server (lib/supabase/server.js,
// supabase.auth.getClaims()) and redirect to /sign-in unless the user has
// role 'pharmacist' (and a pharmacy_id); a pending shop may still use these pages. Hidden links are not security; RLS is the final guard.
// Until W1 these pages show sample data to anyone.
import { AreaShell } from "@/components/area-shell";

export default function PharmacyLayout({ children }) {
  return <AreaShell area="pharmacy">{children}</AreaShell>;
}
