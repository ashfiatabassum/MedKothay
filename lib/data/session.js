// Who is signed in. Server-only.
// U1–U4: always signed out (sessions arrive in W1), so every screen shows the
// signed-out view. W1: read the Supabase session (getClaims) and the profile.
import "server-only";

/**
 * @returns {Promise<null | { id: string, role: "customer"|"pharmacist"|"admin",
 *   fullName: string, pharmacyId: string|null }>}
 */
export async function getCurrentUser() {
  // TODO(W1): const supabase = await createClient(); const { data } = await
  //   supabase.auth.getClaims(); then select role, full_name, pharmacy_id from profiles.
  return null;
}

/** Where each account type lands after signing in (CLAUDE.md "Accounts"). */
export function homeFor(role) {
  if (role === "pharmacist") return "/pharmacy";
  if (role === "admin") return "/admin";
  return "/";
}
