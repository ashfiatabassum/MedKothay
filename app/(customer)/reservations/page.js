import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "My reservations" };

export default function Page() {
  return (
    <ComingSoon
      title="My reservations"
      step="U2"
      description="Your reservations with their pickup codes, time left and status."
    />
  );
}
