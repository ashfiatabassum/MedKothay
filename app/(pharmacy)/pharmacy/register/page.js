import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Register your pharmacy" };

export default function Page() {
  return (
    <ComingSoon
      title="Register your pharmacy"
      step="U3"
      description="Shop details, DGDA licence number, licence photo and expiry. Your shop stays hidden until an admin approves it."
    />
  );
}
