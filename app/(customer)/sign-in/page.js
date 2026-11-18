// Sign in | Create account (CLAUDE.md "Accounts", D5). The tab is in the URL
// (?mode=signup) so links like "Register your pharmacy" can open the right one.
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SignInForm } from "./sign-in-form";
import { SignUpForm } from "./sign-up-form";

export async function generateMetadata({ searchParams }) {
  const { mode } = await searchParams;
  return { title: mode === "signup" ? "Create account" : "Sign in" };
}

function Tab({ href, current, children }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex h-10 flex-1 items-center justify-center rounded-md text-sm font-medium transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        current
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export default async function SignInPage({ searchParams }) {
  const { mode, as } = await searchParams;
  const signUp = mode === "signup";
  const defaultType = as === "pharmacy" ? "pharmacy" : "customer";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        {signUp ? "Create your account" : "Sign in"}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {signUp
          ? "Searching is free. You need an account to reserve medicines or to run a pharmacy."
          : "Sign in with the email and password you used to create your account."}
      </p>

      <nav
        aria-label="Sign in or create account"
        className="mb-6 flex gap-1 rounded-lg bg-muted p-1"
      >
        <Tab href="/sign-in" current={!signUp}>
          Sign in
        </Tab>
        <Tab
          href={`/sign-in?mode=signup${as === "pharmacy" ? "&as=pharmacy" : ""}`}
          current={signUp}
        >
          Create account
        </Tab>
      </nav>

      {signUp ? (
        <SignUpForm key={defaultType} defaultType={defaultType} />
      ) : (
        <SignInForm />
      )}
    </div>
  );
}
