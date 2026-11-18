// The 6-digit pickup code, shown large in the amber highlight.
import { cn } from "@/lib/utils";

export function PickupCode({ code, className }) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 border-highlight bg-highlight-soft px-4 py-3 text-center",
        className,
      )}
    >
      <p className="text-xs font-medium tracking-wide text-highlight-foreground uppercase">
        Pickup code
      </p>
      <p
        className="font-mono text-3xl font-bold tracking-[0.3em] text-highlight-foreground tabular-nums"
        aria-label={`Pickup code ${code.split("").join(" ")}`}
      >
        {code}
      </p>
      <p className="mt-1 text-xs text-highlight-foreground">
        Show this at the pharmacy counter
      </p>
    </div>
  );
}
