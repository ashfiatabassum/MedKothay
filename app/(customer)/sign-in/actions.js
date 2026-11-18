"use server";

// Sign in and create account (CLAUDE.md "Accounts", decision D5).
// Validation happens here, on the server. The account type is only ever
// "customer" or "pharmacy"; the database maps it to a role in W1.
import { signInWithPassword, signUp } from "@/lib/data/auth";
import {
  checkEmail,
  checkFullName,
  checkPassword,
  normalizeBdPhone,
} from "@/lib/validation";

const ACCOUNT_TYPES = new Set(["customer", "pharmacy"]);

function field(formData, name) {
  return String(formData.get(name) ?? "").trim();
}

export async function signInAction(_prev, formData) {
  const email = field(formData, "email");
  // Passwords are not trimmed: spaces may be part of them.
  const password = String(formData.get("password") ?? "");

  const fieldErrors = {};
  const emailError = checkEmail(email);
  if (emailError) fieldErrors.email = emailError;
  const passwordError = checkPassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  if (Object.keys(fieldErrors).length) {
    return { status: "error", fieldErrors, values: { email } };
  }

  const result = await signInWithPassword({ email, password });
  if (!result.ok) {
    return { status: "error", formError: result.error, values: { email } };
  }
  // TODO(W1): redirect(result.redirectTo) once a real session exists.
  return {
    status: "signed-in",
    fullName: result.fullName,
    redirectTo: result.redirectTo,
  };
}

export async function signUpAction(_prev, formData) {
  const accountType = field(formData, "accountType");
  const fullName = field(formData, "fullName");
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");
  const phoneRaw = field(formData, "phone");
  const values = { accountType, fullName, email, phone: phoneRaw };

  const fieldErrors = {};
  if (!ACCOUNT_TYPES.has(accountType))
    fieldErrors.accountType = "Choose the type of account.";
  const nameError = checkFullName(fullName);
  if (nameError) fieldErrors.fullName = nameError;
  const emailError = checkEmail(email);
  if (emailError) fieldErrors.email = emailError;
  const passwordError = checkPassword(password, { forSignUp: true });
  if (passwordError) fieldErrors.password = passwordError;
  const phone = normalizeBdPhone(phoneRaw);
  if (phone.error) fieldErrors.phone = phone.error;
  if (Object.keys(fieldErrors).length) {
    return { status: "error", fieldErrors, values };
  }

  const result = await signUp({
    accountType,
    fullName,
    email,
    password,
    phone: phone.value,
  });
  if (!result.ok) {
    return {
      status: "error",
      formError: result.error,
      emailTaken: result.code === "email_taken",
      values,
    };
  }
  // TODO(W1): redirect(result.redirectTo) once a real session exists.
  return { status: "created", accountType, redirectTo: result.redirectTo };
}
