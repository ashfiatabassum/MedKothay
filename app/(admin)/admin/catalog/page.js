import { PageHeading } from "@/components/area-shell";
import { listMedicines } from "@/lib/data/admin";
import { CatalogManager } from "./catalog-manager";

export const metadata = { title: "Medicine catalog" };

export default async function CatalogPage() {
  const medicines = await listMedicines();
  return (
    <>
      <PageHeading
        title="Medicine catalog"
        description="The master list every pharmacy picks from when adding stock."
      />
      <CatalogManager medicines={medicines} />
    </>
  );
}
