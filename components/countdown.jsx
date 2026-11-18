"use client";

// Time left on a reservation hold, counted from the server's expiresAt (never
// from when the page was opened). Renders "--:--" until mounted so server and
// client HTML match.
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function remaining(expiresAt) {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

function format(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Countdown({ expiresAt, className }) {
  const [msLeft, setMsLeft] = useState(null);

  useEffect(() => {
    let id;
    const tick = () => {
      const left = remaining(expiresAt);
      setMsLeft(left);
      if (left === 0) clearInterval(id); // stop once the hold has expired
    };
    id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [expiresAt]);

  const expired = msLeft === 0;

  return (
    <span
      role="timer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium tabular-nums",
        expired
          ? "bg-out-of-stock text-out-of-stock-foreground"
          : "bg-highlight-soft text-highlight-foreground",
        className,
      )}
    >
      <Clock className="size-4" aria-hidden="true" />
      {expired ? (
        "Hold expired"
      ) : (
        <>
          <span className="sr-only">Time left to pick up:</span>
          {msLeft === null ? "--:--" : format(msLeft)}
          <span aria-hidden="true">left</span>
        </>
      )}
    </span>
  );
}
