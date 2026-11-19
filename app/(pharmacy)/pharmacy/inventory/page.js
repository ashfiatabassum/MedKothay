import { PageHeading } from "@/components/area-shell";
import { getCatalogNotStocked, getInventory } from "@/lib/data/pharmacy";
import { requireMyPharmacy } from "../require-pharmacy";
import { InventoryManager } from "./inventory-manager";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const { pharmacy } = await requireMyPharmacy();
  const [rows, catalog] = await Promise.all([
    getInventory(pharmacy.id),
    getCatalogNotStocked(pharmacy.id),
  ]);

  return (
    <>
      <PageHeading
        title="Inventory"
        description="One stock for counter sales and online reservations. Reserved units can't be sold at the counter."
      />
      <InventoryManager rows={rows} catalog={catalog} />
    </>
  );
}
