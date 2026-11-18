// Placeholder for screens built in a later UI step. Removed as each step lands.
import { Construction } from "lucide-react";
import { PageHeading } from "@/components/area-shell";
import { EmptyState } from "@/components/states";

export function ComingSoon({ title, step, description }) {
  return (
    <>
      <PageHeading title={title} />
      <EmptyState
        icon={Construction}
        title={`Built in step ${step}`}
        description={description}
      />
    </>
  );
}
