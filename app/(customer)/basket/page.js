import { PageHeading } from "@/components/area-shell";
import { BasketView } from "./basket-view";

export const metadata = { title: "Basket" };

export default function BasketPage() {
  return (
    <>
      <PageHeading
        title="Your basket"
        description="Medicines from one pharmacy, reserved together with one pickup code."
      />
      <BasketView />
    </>
  );
}
