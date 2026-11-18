import Link from "next/link";
import { SearchX } from "lucide-react";
import { AreaShell } from "@/components/area-shell";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <AreaShell area="customer">
      <EmptyState
        icon={SearchX}
        headingLevel={1}
        title="This page doesn't exist"
        description="The link may be old or mistyped."
        action={
          <Link href="/" className={buttonVariants()}>
            Go to search
          </Link>
        }
      />
    </AreaShell>
  );
}
