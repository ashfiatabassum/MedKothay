// Right side of every header: "Sign in" when signed out; otherwise the
// person's first name, a link to their own area when they are elsewhere, and
// "Sign out". Server component; sign-out is a plain form posting a server action.
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/app/(customer)/sign-in/actions";

const OWN_AREA = {
  pharmacist: { href: "/pharmacy", label: "My pharmacy" },
  admin: { href: "/admin", label: "Admin" },
};

export function AccountControls({ user, area }) {
  if (!user) {
    return (
      <Link href="/sign-in" className={buttonVariants()}>
        Sign in
      </Link>
    );
  }

  const own = OWN_AREA[user.role];
  const showOwn = own && area === "customer";
  const firstName = user.fullName.split(" ")[0];

  return (
    <>
      {showOwn && (
        <Link
          href={own.href}
          className={buttonVariants({ variant: "outline" })}
        >
          {own.label}
        </Link>
      )}
      <span className="hidden text-sm text-muted-foreground sm:inline">
        {firstName}
      </span>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" aria-label="Sign out">
          <LogOut aria-hidden="true" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </form>
    </>
  );
}
