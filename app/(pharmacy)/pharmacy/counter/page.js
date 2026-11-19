import { PageHeading } from "@/components/area-shell";
import { getInventory } from "@/lib/data/pharmacy";
import { requireMyPharmacy } from "../require-pharmacy";
import { CounterSale } from "./counter-sale";

export const metadata = { title: "Counter sale" };

export default async function CounterPage() {
  const { pharmacy } = await requireMyPharmacy();
  const stock = await getInventory(pharmacy.id);
  return (
    <>
      <PageHeading
        title="Counter sale"
        description="Sell to walk-in customers. Units reserved for pickup can't be sold here."
      />
      <CounterSale stock={stock} />
    </>
  );
}
