"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import {
  FormField,
  SuccessHeading,
  PasswordInput,
  TextInput,
  useFocusFirstError,
} from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { signInAction } from "./actions";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, {
    status: "idle",
  });
  const formRef = useRef(null);
  useFocusFirstError(formRef, state, "#signin-email");

  if (state.status === "signed-in") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border bg-card px-5 py-8 text-center"
      >
        <CircleCheck className="size-10 text-primary" aria-hidden="true" />
        <SuccessHeading>Welcome back, {state.fullName}</SuccessHeading>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Demo: real sign-in starts in step W1. You would now go to{" "}
          <span className="font-mono">{state.redirectTo}</span>.
        </p>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-5">
      {state.formError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {state.formError}
        </p>
      )}

      <FormField id="signin-email" label="Email address" error={errors.email}>
        {(a11y) => (
          <TextInput
            id="signin-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={state.values?.email ?? ""}
            {...a11y}
          />
        )}
      </FormField>

      <FormField id="signin-password" label="Password" error={errors.password}>
        {(a11y) => (
          <PasswordInput
            id="signin-password"
            name="password"
            autoComplete="current-password"
            required
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
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New to MedKothay?{" "}
        <Link
          href="/sign-in?mode=signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
