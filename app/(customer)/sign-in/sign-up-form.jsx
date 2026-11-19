"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, Search, Store } from "lucide-react";
import {
  FormField,
  SuccessHeading,
  PasswordInput,
  TextInput,
  useFocusFirstError,
} from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { signUpAction } from "./actions";

const TYPES = [
  {
    value: "customer",
    icon: Search,
    title: "I'm looking for medicine",
    text: "Search nearby pharmacies and reserve medicines for pickup.",
  },
  {
    value: "pharmacy",
    icon: Store,
    title: "I own a pharmacy",
    text: "Run your shop: stock, counter sales and reservations. Pharmacy accounts can't reserve medicines.",
  },
];

// W1: signing up will also start the session, so "Continue" really continues
// (in the demo the new account is not saved, so the user is asked to sign in).
export function SignUpForm({ defaultType, next, signInHref = "/sign-in" }) {
  const [state, formAction, pending] = useActionState(signUpAction, {
    status: "idle",
  });
  const formRef = useRef(null);
  const [picked, setPicked] = useState(null); // the type chosen on this page
  useFocusFirstError(
    formRef,
    state,
    state.emailTaken ? "#signup-email" : 'input[name="accountType"]',
  );

  if (state.status === "created") {
    const pharmacy = state.accountType === "pharmacy";
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border bg-card px-5 py-8 text-center"
      >
        <CircleCheck className="size-10 text-primary" aria-hidden="true" />
        <SuccessHeading>Account created</SuccessHeading>
        <p className="max-w-sm text-sm text-muted-foreground">
          {pharmacy
            ? "Next, register your pharmacy. It stays hidden from customers until an admin approves it."
            : "You can now reserve medicines from pharmacies near you."}
        </p>
        <Link
          href={pharmacy ? "/pharmacy/register" : (next ?? "/")}
          className={buttonVariants()}
        >
          {pharmacy
            ? "Register your pharmacy"
            : next
              ? "Continue"
              : "Search medicines"}
        </Link>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Demo: accounts are saved from step W1. Nothing was saved yet.
        </p>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const type = picked ?? (v.accountType || defaultType);
  const owner = type === "pharmacy";

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-5">
      {owner && (
        <p className="text-sm font-medium text-primary">
          Step 1 of 2: your account. Next, your pharmacy&apos;s details.
        </p>
      )}
      <p className="text-sm text-muted-foreground">All fields are required.</p>
      {state.formError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {state.emailTaken ? (
            <>
              An account with this email already exists.{" "}
              <Link
                href={signInHref}
                className="font-medium underline underline-offset-4"
              >
                Sign in instead
              </Link>
              .
            </>
          ) : (
            state.formError
          )}
        </p>
      )}

      <fieldset
        aria-describedby={errors.accountType ? "type-error" : undefined}
        className="space-y-3"
      >
        <legend className="mb-3 text-sm font-medium">Account type</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {TYPES.map(({ value, icon: Icon, title, text }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border-2 bg-card p-4 transition-colors",
                "hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-secondary",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              )}
            >
              <input
                type="radio"
                name="accountType"
                value={value}
                checked={type === value}
                onChange={() => setPicked(value)}
                className="sr-only"
              />
              <Icon
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-muted-foreground">
                  {text}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.accountType && (
          <p id="type-error" role="alert" className="text-sm text-destructive">
            {errors.accountType}
          </p>
        )}
      </fieldset>

      <FormField
        id="signup-name"
        label={owner ? "Owner's full name" : "Full name"}
        error={errors.fullName}
      >
        {(a11y) => (
          <TextInput
            id="signup-name"
            name="fullName"
            autoComplete="name"
            required
            maxLength={80}
            defaultValue={v.fullName ?? ""}
            {...a11y}
          />
        )}
      </FormField>

      <FormField id="signup-email" label="Email address" error={errors.email}>
        {(a11y) => (
          <TextInput
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={v.email ?? ""}
            {...a11y}
          />
        )}
      </FormField>

      <FormField
        id="signup-password"
        label="Password"
        hint={`${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`}
        error={errors.password}
      >
        {(a11y) => (
          <PasswordInput
            id="signup-password"
            name="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            {...a11y}
          />
        )}
      </FormField>

      <FormField
        id="signup-phone"
        label={owner ? "Your mobile number" : "Mobile number"}
        hint="Bangladeshi mobile, like 01712-345678."
        error={errors.phone}
      >
        {(a11y) => (
          <TextInput
            id="signup-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            defaultValue={v.phone ?? ""}
            {...a11y}
          />
        )}
      </FormField>

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-11 w-full"
      >
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={signInHref}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
