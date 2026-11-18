"use client";

// Labelled form field with a hint or a server error, wired for screen readers
// (aria-invalid, aria-describedby, role="alert" on errors).
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormField({ id, label, hint, error, children }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children({ describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Text input for FormField. */
export function TextInput({ id, describedBy, invalid, className, ...props }) {
  return (
    <Input
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn("h-11", className)}
      {...props}
    />
  );
}

/**
 * Password input with a show/hide button. Controlled, so the typed password
 * survives React's form reset after a rejected submit; the server never sends
 * the password back.
 */
export function PasswordInput({ id, describedBy, invalid, ...props }) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  return (
    <div className="relative">
      <TextInput
        id={id}
        type={visible ? "text" : "password"}
        describedBy={describedBy}
        invalid={invalid}
        className="pr-12"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label="Show password"
        aria-pressed={visible}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/**
 * Focus a success heading once it appears. Use on the h2 that replaces a form,
 * so keyboard and screen-reader users land on the result every time.
 */
export function useFocusOnMount() {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

/** The h2 shown when a form is replaced by its success message; takes focus. */
export function SuccessHeading({ children }) {
  const ref = useFocusOnMount();
  return (
    <h2
      ref={ref}
      tabIndex={-1}
      className="text-lg font-semibold focus:outline-none"
    >
      {children}
    </h2>
  );
}

/** After a failed submit, focus the first invalid field (or `fallbackSelector`). */
export function useFocusFirstError(formRef, state, fallbackSelector) {
  useEffect(() => {
    if (state?.status !== "error") return;
    const form = formRef.current;
    const target =
      form?.querySelector('[aria-invalid="true"]') ??
      (fallbackSelector ? form?.querySelector(fallbackSelector) : null);
    target?.focus();
  }, [formRef, state, fallbackSelector]);
}
