"use server";

// Sign-in with an email magic link. The chosen role ("customer" | "pharmacy")
// only decides where the user goes after signing in; the database sets the real
// role (CLAUDE.md "How roles are assigned"). Never trust it as a role.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTENTS = new Set(["customer", "pharmacy"]);

export async function requestSignInLink(_prevState, formData) {
  const email = String(formData.get("email") ?? "").trim();
  const intent = String(formData.get("intent") ?? "");

  const fieldErrors = {};
  if (!INTENTS.has(intent))
    fieldErrors.intent = "Choose how you will use MedKothay.";
  if (!email) fieldErrors.email = "Enter your email address.";
  else if (!EMAIL_RE.test(email) || email.length > 254)
    fieldErrors.email = "Enter a valid email address, like name@example.com.";

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors, values: { email, intent } };
  }

  // TODO(W1): supabase.auth.signInWithOtp({ email, options: { emailRedirectTo:
  //   `${origin}/auth/callback?next=${intent === "pharmacy" ? "/pharmacy/register" : "/"}` } })
  await new Promise((r) => setTimeout(r, 400));

  return { status: "sent", email, intent };
}
