"use server";

// Reserve the basket. Sign-in is asked for only here (CLAUDE.md "Customer").
// Pharmacy and admin accounts cannot reserve (D5). The payload from the browser
// is untrusted: it is re-validated here and prices are taken from the server.
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/data/session";
import { reserveBasket } from "@/lib/data/customer";
import { MAX_BASKET_ITEMS, MAX_UNITS_PER_ITEM } from "@/lib/constants";
import { isUuid } from "@/lib/validation";

function parseItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BASKET_ITEMS)
    return null;
  const seen = new Set();
  const items = [];
  for (const i of raw) {
    const medicineId = typeof i?.medicineId === "string" ? i.medicineId : "";
    const quantity = Number(i?.quantity);
    // The price the customer saw (D13); only compared, never used as the price.
    const expectedPrice = Number(i?.expectedPrice);
    if (
      !isUuid(medicineId) ||
      seen.has(medicineId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_UNITS_PER_ITEM ||
      !Number.isFinite(expectedPrice) ||
      expectedPrice <= 0
    )
      return null;
    seen.add(medicineId);
    items.push({ medicineId, quantity, expectedPrice });
  }
  return items;
}

/**
 * @param {{ pharmacyId: string, requestId: string,
 *   items: { medicineId: string, quantity: number, expectedPrice: number }[] }} payload
 * @returns {{ status: "needs-sign-in" } | { status: "not-customer" }
 *   | { status: "price_changed", message, prices }
 *   | { status: "error", message, medicineId? } | { status: "reserved", reservation }}
 */
export async function reserveAction(payload) {
  const user = await getCurrentUser();
  if (!user) return { status: "needs-sign-in" };
  if (user.role !== "customer") return { status: "not-customer" };

  const pharmacyId =
    typeof payload?.pharmacyId === "string" ? payload.pharmacyId : "";
  const items = parseItems(payload?.items);
  if (!isUuid(pharmacyId) || !items) {
    return {
      status: "error",
      message:
        "Your basket could not be read. Remove the items and add them again.",
    };
  }

  // One id per reserve attempt, reused by the browser on retry (D14).
  const requestId = isUuid(payload?.requestId) ? payload.requestId : null;
  if (!requestId) {
    return {
      status: "error",
      message: "Please try reserving again.",
    };
  }

  const result = await reserveBasket({ pharmacyId, items, requestId });
  if (result.ok) revalidatePath("/reservations");
  if (!result.ok) {
    if (result.code === "price_changed")
      return {
        status: "price_changed",
        message: result.error,
        prices: result.prices,
      };
    return {
      status: "error",
      message: result.error,
      medicineId: result.medicineId,
    };
  }
  return { status: "reserved", reservation: result.reservation };
}
