import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Medicine catalog" };

export default function Page() {
  return (
    <ComingSoon
      title="Medicine catalog"
      step="U4"
      description="The master list of medicines every pharmacy picks from."
    />
  );
}
