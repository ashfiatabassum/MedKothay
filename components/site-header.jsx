// Header for each area of the app. On phones the links move to a second row
// whose links wrap if they do not fit (the page never scrolls sideways).
import Link from "next/link";
import { Pill } from "lucide-react";
import { NavLink } from "@/components/nav-link";

// Customer links depend on who is signed in and what is in the basket, so the
// customer layout passes them in (see customerLinks). No "Search" link: the
// search box is on the home page and the logo goes there.
const NAV = {
  pharmacy: [
    { href: "/pharmacy", label: "Dashboard", exact: true },
    { href: "/pharmacy/inventory", label: "Inventory" },
    { href: "/pharmacy/counter", label: "Counter" },
    { href: "/pharmacy/reservations", label: "Reservations" },
  ],
  admin: [
    {
      href: "/admin",
      label: "Pharmacies",
      exact: true,
      also: "/admin/pharmacies",
    },
    { href: "/admin/catalog", label: "Medicine catalog" },
  ],
};

const AREA_LABEL = { pharmacy: "Pharmacy", admin: "Admin" };

/**
 * Links for the customer header (CLAUDE.md "Customer"): "Basket" only once it
 * has items, "My reservations" only for a signed-in customer.
 */
export function customerLinks({ user, basketCount = 0 }) {
  const links = [];
  if (basketCount > 0)
    links.push({ href: "/basket", label: `Basket (${basketCount})` });
  if (user?.role === "customer")
    links.push({ href: "/reservations", label: "My reservations" });
  return links;
}

export function SiteHeader({ area = "customer", links: customLinks, right }) {
  const links = customLinks ?? NAV[area] ?? [];

  // One <nav> only. On phones it moves to a full-width second row (order-last,
  // w-full) whose links wrap onto another line if needed; from md it sits inline.
  return (
    <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 px-4 md:flex-nowrap">
        <Link
          href={area === "customer" ? "/" : `/${area}`}
          className="flex h-14 shrink-0 items-center gap-2 rounded-md font-semibold text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Pill className="size-4" aria-hidden="true" />
          </span>
          <span className="text-lg tracking-tight">MedKothay</span>
          {AREA_LABEL[area] && (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {AREA_LABEL[area]}
            </span>
          )}
        </Link>
        {links.length > 0 && (
          <nav
            aria-label="Main"
            className="order-last -mx-4 flex w-[calc(100%+2rem)] flex-wrap gap-1 border-t px-3 py-1 md:order-none md:mx-0 md:ml-4 md:w-auto md:flex-nowrap md:border-0 md:p-0"
          >
            {links.map((l) => (
              <NavLink key={l.href} href={l.href} exact={l.exact} also={l.also}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
