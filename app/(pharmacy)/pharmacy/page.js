import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <ComingSoon
      title="Dashboard"
      step="U3"
      description="Today's sales, low stock count and active reservations."
    />
  );
}
