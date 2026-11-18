import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }) {
  const { as } = await searchParams;
  const defaultIntent = as === "pharmacy" ? "pharmacy" : "customer";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Sign in or create an account
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Searching is free and needs no account. Sign in to reserve medicines or
        to manage a pharmacy.
      </p>
      <SignInForm defaultIntent={defaultIntent} />
    </div>
  );
}
