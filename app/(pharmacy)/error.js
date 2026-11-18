"use client";

import { RouteError } from "@/components/route-states";

export default function Error({ error, retry }) {
  return <RouteError error={error} retry={retry} />;
}
