// Page frame shared by the three areas: header, centred content, footer.
import { SiteHeader } from "@/components/site-header";

export function AreaShell({ area, links, right, children }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-20 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteHeader area={area} links={links} right={right} />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 focus:outline-none md:py-8"
      >
        {children}
      </main>
      <footer className="border-t bg-card">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 text-xs text-muted-foreground">
          MedKothay · Find medicine at pharmacies near you in Dhaka
        </div>
      </footer>
    </>
  );
}

/** Page title block used at the top of every screen. */
export function PageHeading({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
