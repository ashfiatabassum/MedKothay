"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import {
  FormField,
  PasswordInput,
  TextInput,
  useFocusFirstError,
} from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { signInAction } from "./actions";

/** On success the server action redirects; this form only shows errors. */
export function SignInForm({ next, signUpHref = "/sign-in?mode=signup" }) {
  const [state, formAction, pending] = useActionState(signInAction, {
    status: "idle",
  });
  const formRef = useRef(null);
  useFocusFirstError(formRef, state, "#signin-email");

  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
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
          href={signUpHref}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
