// TODO(W1): AUTHORIZATION. Read the session on the server (lib/supabase/server.js,
// supabase.auth.getClaims()) and redirect to /sign-in unless the user has
// role 'admin'. Hidden links are not security; RLS is the final guard.
// Until W1 these pages show sample data to anyone.
import { AreaShell } from "@/components/area-shell";

export default function AdminLayout({ children }) {
  return <AreaShell area="admin">{children}</AreaShell>;
}
