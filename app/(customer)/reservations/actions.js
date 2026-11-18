"use server";

import { getCurrentUser } from "@/lib/data/session";
import { cancelReservation } from "@/lib/data/customer";

/** Cancel the signed-in customer's own reservation. */
export async function cancelAction(_prev, formData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") {
    return {
      status: "error",
      message: "Sign in with a customer account to cancel.",
    };
  }
  const reservationId = String(formData.get("reservationId") ?? "").slice(
    0,
    64,
  );
  const result = await cancelReservation({
    customerId: user.id,
    reservationId,
  });
  // TODO(W3): revalidatePath("/reservations") so the card moves to "Past".
  return result.ok
    ? { status: "cancelled" }
    : { status: "error", message: result.error };
}
