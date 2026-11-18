// Header for each area of the app. On phones the links move to a second row
// whose links wrap if they do not fit (the page never scrolls sideways).
import Link from "next/link";
import { Pill } from "lucide-react";
import { NavLink } from "@/components/nav-link";

const NAV = {
  customer: [
    { href: "/", label: "Search", exact: true },
    { href: "/basket", label: "Basket" },
    { href: "/reservations", label: "My reservations" },
  ],
  pharmacy: [
    { href: "/pharmacy", label: "Dashboard", exact: true },
    { href: "/pharmacy/inventory", label: "Inventory" },
    { href: "/pharmacy/counter", label: "Counter" },
    { href: "/pharmacy/reservations", label: "Reservations" },
  ],
  admin: [
    { href: "/admin", label: "Pending pharmacies", exact: true },
    { href: "/admin/catalog", label: "Medicine catalog" },
  ],
};

const AREA_LABEL = { pharmacy: "Pharmacy", admin: "Admin" };

export function SiteHeader({ area = "customer", right }) {
  const links = NAV[area];

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
        <nav
          aria-label="Main"
          className="order-last -mx-4 flex w-[calc(100%+2rem)] flex-wrap gap-1 border-t px-3 py-1 md:order-none md:mx-0 md:ml-4 md:w-auto md:flex-nowrap md:border-0 md:p-0"
        >
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} exact={l.exact}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
