// Field checks shared by server actions. Pure functions: each returns an error
// message, or null when the value is fine. The server is the authority; the
// browser never decides what is valid.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Bangladeshi mobile: 01[3-9] + 8 digits, optionally with +88 / 88 in front.
const BD_MOBILE_RE = /^(?:\+?88)?(01[3-9]\d{8})$/;

/** Canonical UUID syntax for browser-generated reservation request IDs. */
export function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt (Supabase Auth) ignores bytes beyond 72

export function checkEmail(email) {
  if (!email) return "Enter your email address.";
  if (email.length > 254 || !EMAIL_RE.test(email))
    return "Enter a valid email address, like name@example.com.";
  return null;
}

export function checkPassword(password, { forSignUp = false } = {}) {
  if (!password) return "Enter your password.";
  if (!forSignUp) return null;
  if (password.length < PASSWORD_MIN)
    return `Use at least ${PASSWORD_MIN} characters.`;
  // bcrypt's limit is 72 *bytes*; Bangla and other non-ASCII characters take
  // 2-4 bytes each, so count bytes, not characters.
  if (new TextEncoder().encode(password).length > PASSWORD_MAX)
    return `Too long. Use at most ${PASSWORD_MAX} characters (fewer if you use Bangla letters or symbols).`;
  return null;
}

export function checkFullName(name) {
  if (!name) return "Enter your full name.";
  if (name.length < 2) return "Enter at least 2 characters.";
  if (name.length > 80) return "Use at most 80 characters.";
  return null;
}

/** Returns { value: "+8801XXXXXXXXX" } or { error }. Spaces and dashes are ignored. */
export function normalizeBdPhone(raw) {
  // Bangla digits (০১২৩৪৫৬৭৮৯) are accepted and turned into 0-9.
  const latin = String(raw ?? "").replace(/[০-৯]/g, (d) =>
    String(d.charCodeAt(0) - 0x09e6),
  );
  const compact = latin.replace(/[\s-]/g, "");
  if (!compact) return { error: "Enter your mobile number." };
  const m = BD_MOBILE_RE.exec(compact);
  if (!m)
    return { error: "Enter a Bangladeshi mobile number, like 01712-345678." };
  return { value: `+88${m[1]}` };
}
