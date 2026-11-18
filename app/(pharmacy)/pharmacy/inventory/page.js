import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Inventory" };

export default function Page() {
  return (
    <ComingSoon
      title="Inventory"
      step="U3"
      description="Add medicines from the catalog, set quantity, price and expiry, and adjust stock."
    />
  );
}
