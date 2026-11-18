"use client";

// Shared bodies for each area's error.js. Next.js 16 passes `retry` (formerly
// `reset`) to error boundaries; see node_modules/next/dist/docs error.md.
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/states";

export function RouteError({ error, retry }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="This page could not load"
      description="Something went wrong on our side. Try again in a moment."
      action={<Button onClick={() => retry()}>Try again</Button>}
    />
  );
}
