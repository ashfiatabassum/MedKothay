import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Reservations" };

export default function Page() {
  return (
    <ComingSoon
      title="Reservations"
      step="U3"
      description="Incoming reservations with a countdown. Enter the pickup code to mark one collected."
    />
  );
}
