// Who is signed in. Server-only.
// U1b–U4: a DEMO session cookie that can only point at one of the three sample
// accounts in lib/mock-data.js, so the UI can be tried signed in and signed out.
// It grants nothing beyond sample data. W1 replaces all of this with the
// Supabase session (getClaims) and the profiles table.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { mockSession } from "@/lib/mock-data";

// The cookie holds the KEY of one sample account (customer, pharmacist,
// pharmacist_new, admin), never an id or role chosen by the browser.

const COOKIE = "mk_demo_session";
const KEYS = new Set(Object.keys(mockSession));

function toUser(p) {
  return {
    id: p.id,
    role: p.role,
    fullName: p.full_name,
    pharmacyId: p.pharmacy_id,
  };
}

/**
 * @returns {Promise<null | { id: string, role: "customer"|"pharmacist"|"admin",
 *   fullName: string, pharmacyId: string|null }>}
 */
// cache(): the layout and the page both ask; read the session once per request.
export const getCurrentUser = cache(async function getCurrentUser() {
  // TODO(W1): supabase.auth.getClaims(), then select role, full_name,
  //   pharmacy_id from profiles.
  const value = (await cookies()).get(COOKIE)?.value;
  return KEYS.has(value) ? toUser(mockSession[value]) : null;
});

/** Server actions only. TODO(W1): remove; Supabase sets its own cookies. */
export async function startDemoSession(key) {
  if (!KEYS.has(key)) return;
  (await cookies()).set(COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

/** Server actions only. TODO(W1): supabase.auth.signOut(). */
export async function endDemoSession() {
  (await cookies()).delete(COOKIE);
}

/** Where each account type lands after signing in (CLAUDE.md "Accounts"). */
export function homeFor(role) {
  if (role === "pharmacist") return "/pharmacy";
  if (role === "admin") return "/admin";
  return "/";
}

/**
 * A return path after sign-in, accepted only if it is a same-site path
 * (security review U1b, L6): starts with one "/", no "//", no backslash.
 */
export function safeNextPath(next) {
  const s = String(next ?? "");
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\")) return null;
  if (s.length > 200 || /[\u0000-\u001f]/.test(s)) return null;
  return s;
}
