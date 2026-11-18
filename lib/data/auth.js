// Account actions behind the sign-in page. Server-only.
// U1b: checked against sample accounts in lib/mock-data.js; nothing is saved and
// no session is created. W1: Supabase Auth (signInWithPassword / signUp with the
// account type, full name and phone as sign-up data; email confirmation off).
//
// Messages are deliberately neutral: they never say which kind of account an
// email belongs to, or whether the email or the password was wrong (D5).
import "server-only";
import { mockAccounts } from "@/lib/mock-data";
import { homeFor, startDemoSession } from "@/lib/data/session";

export const AUTH_MESSAGES = {
  badCredentials: "Email or password is incorrect.",
  emailTaken: "An account with this email already exists. Sign in instead.",
  failed: "We could not create your account. Please try again in a moment.",
};

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

function findAccount(email) {
  const e = email.toLowerCase();
  return mockAccounts.find((a) => a.email === e) ?? null;
}

/**
 * @returns {Promise<{ ok: true, fullName: string, redirectTo: string }
 *                 | { ok: false, error: string }>}
 */
export async function signInWithPassword({ email, password }) {
  // TODO(W1): supabase.auth.signInWithPassword({ email, password }), then read
  //   the profile role for redirectTo.
  await delay();
  const account = findAccount(email);
  if (!account || account.password !== password) {
    return { ok: false, error: AUTH_MESSAGES.badCredentials };
  }
  await startDemoSession(account.profile.role); // TODO(W1): Supabase sets the session
  return {
    ok: true,
    role: account.profile.role,
    fullName: account.profile.full_name,
    redirectTo: homeFor(account.profile.role),
  };
}

/**
 * accountType: "customer" | "pharmacy". The database turns it into a role
 * (pharmacy -> pharmacist, anything else -> customer); it is never trusted as
 * a role here.
 * @returns {Promise<{ ok: true, redirectTo: string }
 *   | { ok: false, code: "email_taken" | "failed", error: string }>}
 * W1: map Supabase's "already registered" to email_taken and every other error
 * (weak password, rate limit, network) to failed. Never show raw Supabase text.
 */
export async function signUp({
  accountType,
  fullName,
  email,
  password,
  phone,
}) {
  // TODO(W1): supabase.auth.signUp({ email, password, options: { data:
  //   { account_type: accountType, full_name: fullName, phone } } })
  void password;
  void fullName;
  void phone;
  await delay();
  if (findAccount(email))
    return { ok: false, code: "email_taken", error: AUTH_MESSAGES.emailTaken };
  return {
    ok: true,
    redirectTo: accountType === "pharmacy" ? "/pharmacy/register" : "/",
  };
}
