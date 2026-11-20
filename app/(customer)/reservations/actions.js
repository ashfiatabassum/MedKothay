"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/data/session";
import { cancelReservation } from "@/lib/data/customer";
import { isUuid } from "@/lib/validation";

/** Cancel the signed-in customer's own reservation. */
export async function cancelAction(_prev, formData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") {
    return {
      status: "error",
      message: "Sign in with a customer account to cancel.",
    };
  }
  const reservationId = String(formData.get("reservationId") ?? "");
  if (!isUuid(reservationId))
    return {
      status: "error",
      message: "This reservation can no longer be cancelled.",
    };
  const result = await cancelReservation({ reservationId });
  if (result.ok) revalidatePath("/reservations");
  return result.ok
    ? { status: "cancelled" }
    : { status: "error", message: result.error };
}
