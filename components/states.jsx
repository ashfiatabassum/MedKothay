// Loading, empty and error states. Every data screen uses one of these instead
// of showing a blank page (CLAUDE.md "Conventions").
import { AlertTriangle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Placeholder cards while a list loads. */
export function LoadingList({ rows = 3, label = "Loading", className }) {
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="space-y-2 rounded-xl border bg-card p-4"
          aria-hidden="true"
        >
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}

/**
 * Nothing to show (yet). `action` is an optional button or link.
 * `headingLevel` sets the title's heading tag (2 by default; 1 when the empty
 * state is the whole page, as on the 404 page).
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  headingLevel = 2,
  className,
}) {
  const Heading = `h${headingLevel}`;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-10 text-center",
        className,
      )}
    >
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <Heading className="font-medium">{title}</Heading>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Something failed. `action` is usually a "Try again" button. */
export function ErrorState({
  title = "Something went wrong",
  description = "Please try again. If it keeps happening, refresh the page.",
  action,
  headingLevel = 2,
  className,
}) {
  const Heading = `h${headingLevel}`;
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-destructive/30 bg-card px-4 py-10 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      <Heading className="font-medium">{title}</Heading>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
