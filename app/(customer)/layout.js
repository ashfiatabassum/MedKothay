import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AreaShell } from "@/components/area-shell";
import { customerLinks } from "@/components/site-header";
import { getCurrentUser } from "@/lib/data/session";

export default async function CustomerLayout({ children }) {
  const user = await getCurrentUser();
  // TODO(U2): pass the basket count once the basket exists.
  const links = customerLinks({ user, basketCount: 0 });

  return (
    <AreaShell
      area="customer"
      links={links}
      right={
        user ? null : ( // TODO(W1): account menu with "Sign out" when signed in
          <Link href="/sign-in" className={buttonVariants()}>
            Sign in
          </Link>
        )
      }
    >
      {children}
    </AreaShell>
  );
}
