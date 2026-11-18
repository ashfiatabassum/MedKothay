import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Pending pharmacies" };

export default function Page() {
  return (
    <ComingSoon
      title="Pending pharmacies"
      step="U4"
      description="Review licence details and photo, then approve or reject with a reason."
    />
  );
}
