import { AccountControls } from "@/components/account-controls";
import { AreaShell } from "@/components/area-shell";
import { BasketLink } from "@/components/basket/basket-link";
import { BasketProvider } from "@/components/basket/basket-provider";
import { customerLinks } from "@/components/site-header";
import { getCurrentUser } from "@/lib/data/session";

export default async function CustomerLayout({ children }) {
  const user = await getCurrentUser();

  return (
    <BasketProvider>
      <AreaShell
        area="customer"
        links={customerLinks({ user })}
        right={
          <>
            <BasketLink />
            <AccountControls user={user} area="customer" />
          </>
        }
      >
        {children}
      </AreaShell>
    </BasketProvider>
  );
}
