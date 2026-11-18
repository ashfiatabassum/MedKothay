import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Counter sale" };

export default function Page() {
  return (
    <ComingSoon
      title="Counter sale"
      step="U3"
      description="Sell at the counter. Stock on hold for a reservation cannot be sold."
    />
  );
}
