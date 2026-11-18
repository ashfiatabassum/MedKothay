"use client";

import { useActionState, useEffect, useRef } from "react";
import { MailCheck, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { requestSignInLink } from "./actions";

const CHOICES = [
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
    text: "Register your shop and manage stock, sales and reservations.",
  },
];

export function SignInForm({ defaultIntent }) {
  const [state, formAction, pending] = useActionState(requestSignInLink, {
    status: "idle",
  });
  const formRef = useRef(null);

  // After a failed submit, put focus on the first field with an error.
  useEffect(() => {
    if (state.status !== "error") return;
    const form = formRef.current;
    const target = state.fieldErrors?.intent
      ? form?.querySelector('input[name="intent"]')
      : form?.querySelector('[aria-invalid="true"]');
    target?.focus();
  }, [state]);

  if (state.status === "sent") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border bg-card px-5 py-8 text-center"
      >
        <MailCheck className="size-10 text-primary" aria-hidden="true" />
        {/* The form (and the focused button) is gone; move focus here so
            keyboard and screen-reader users land on the result. */}
        <h2
          ref={(el) => el?.focus()}
          tabIndex={-1}
          className="text-lg font-semibold focus:outline-none"
        >
          Check your email
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          We sent a sign-in link to{" "}
          <span className="font-medium text-foreground">{state.email}</span>.
          Open it on this device to continue
          {state.intent === "pharmacy" ? " to your pharmacy registration" : ""}.
        </p>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Demo: emails are sent from step W1. Nothing was sent yet.
        </p>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};
  const intent = state.values?.intent ?? defaultIntent;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      <fieldset
        aria-describedby={errors.intent ? "intent-error" : undefined}
        className="space-y-3"
      >
        <legend className="mb-3 text-sm font-medium">
          How will you use MedKothay?
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {CHOICES.map(({ value, icon: Icon, title, text }) => (
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
                name="intent"
                value={value}
                defaultChecked={intent === value}
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
        {errors.intent && (
          <p
            id="intent-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {errors.intent}
          </p>
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email ?? ""}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : "email-hint"}
          className="h-11"
        />
        {errors.email ? (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {errors.email}
          </p>
        ) : (
          <p id="email-hint" className="text-sm text-muted-foreground">
            We&apos;ll email you a sign-in link. No password needed.
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-11 w-full"
      >
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
