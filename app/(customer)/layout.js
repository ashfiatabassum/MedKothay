import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AreaShell } from "@/components/area-shell";

export default function CustomerLayout({ children }) {
  return (
    <AreaShell
      area="customer"
      right={
        <Link href="/sign-in" className={buttonVariants()}>
          Sign in
        </Link>
      }
    >
      {children}
    </AreaShell>
  );
}
