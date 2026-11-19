// Supabase identity and database-owned profile role, scoped to each request.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient();
  const { data: identity, error: authError } = await supabase.auth.getClaims();
  const id = identity?.claims?.sub;
  if (authError || !id) return null;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, pharmacy_id")
    .eq("id", id)
    .single();
  if (error || !profile) return null;
  return {
    id: profile.id,
    role: profile.role,
    fullName: profile.full_name,
    pharmacyId: profile.pharmacy_id,
  };
});

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function requireRole(role) {
  const user = await getCurrentUser();
  if (user?.role !== role) redirect("/sign-in");
  return user;
}

export function homeFor(role) {
  if (role === "pharmacist") return "/pharmacy";
  if (role === "admin") return "/admin";
  return "/";
}

export function safeNextPath(next) {
  const s = String(next ?? "");
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\")) return null;
  if (s.length > 200 || /[\u0000-\u001f\u007f]/.test(s)) return null;
  return s;
}
