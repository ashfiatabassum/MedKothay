import "server-only";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/data/session";

export const AUTH_MESSAGES = {
  badCredentials: "Email or password is incorrect.",
  emailTaken: "An account with this email already exists. Sign in instead.",
  failed: "We could not create your account. Please try again in a moment.",
};

async function profileFor(supabase, id) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, full_name, pharmacy_id")
    .eq("id", id)
    .single();
  return error ? null : data;
}

export async function signInWithPassword({ email, password }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user)
      return { ok: false, error: AUTH_MESSAGES.badCredentials };
    const profile = await profileFor(supabase, data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return { ok: false, error: AUTH_MESSAGES.badCredentials };
    }
    return {
      ok: true,
      role: profile.role,
      fullName: profile.full_name,
      redirectTo:
        profile.role === "pharmacist" && !profile.pharmacy_id
          ? "/pharmacy/register"
          : homeFor(profile.role),
    };
  } catch {
    return { ok: false, error: AUTH_MESSAGES.badCredentials };
  }
}

export async function signUp({
  accountType,
  fullName,
  email,
  password,
  phone,
}) {
  if (!["customer", "pharmacy"].includes(accountType))
    return { ok: false, code: "failed", error: AUTH_MESSAGES.failed };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { account_type: accountType, full_name: fullName, phone },
      },
    });
    if (error) {
      if (["user_already_exists", "email_exists"].includes(error.code))
        return {
          ok: false,
          code: "email_taken",
          error: AUTH_MESSAGES.emailTaken,
        };
      return { ok: false, code: "failed", error: AUTH_MESSAGES.failed };
    }
    if (
      !data.user ||
      !data.session ||
      !(await profileFor(supabase, data.user.id))
    ) {
      await supabase.auth.signOut();
      return { ok: false, code: "failed", error: AUTH_MESSAGES.failed };
    }
    return {
      ok: true,
      redirectTo: accountType === "pharmacy" ? "/pharmacy/register" : "/",
    };
  } catch {
    return { ok: false, code: "failed", error: AUTH_MESSAGES.failed };
  }
}
