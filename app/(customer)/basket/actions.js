"use server";

// Reserve the basket. Sign-in is asked for only here (CLAUDE.md "Customer").
// Pharmacy and admin accounts cannot reserve (D5). The payload from the browser
// is untrusted: it is re-validated here and prices are taken from the server.
import { getCurrentUser } from "@/lib/data/session";
import { reserveBasket } from "@/lib/data/customer";
import { MAX_UNITS_PER_ITEM } from "@/lib/constants";

const MAX_ITEMS = 20;

function parseItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS)
    return null;
  const seen = new Set();
  const items = [];
  for (const i of raw) {
    const medicineId = typeof i?.medicineId === "string" ? i.medicineId : "";
    const quantity = Number(i?.quantity);
    if (
      !medicineId ||
      medicineId.length > 64 ||
      seen.has(medicineId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_UNITS_PER_ITEM
    )
      return null;
    seen.add(medicineId);
    items.push({ medicineId, quantity });
  }
  return items;
}

/**
 * @param {{ pharmacyId: string, items: { medicineId: string, quantity: number }[] }} payload
 * @returns {{ status: "needs-sign-in" } | { status: "not-customer" }
 *   | { status: "error", message, medicineId? } | { status: "reserved", reservation }}
 */
export async function reserveAction(payload) {
  const user = await getCurrentUser();
  if (!user) return { status: "needs-sign-in" };
  if (user.role !== "customer") return { status: "not-customer" };

  const pharmacyId =
    typeof payload?.pharmacyId === "string" ? payload.pharmacyId : "";
  const items = parseItems(payload?.items);
  if (!pharmacyId || !items) {
    return {
      status: "error",
      message:
        "Your basket could not be read. Remove the items and add them again.",
    };
  }

  const result = await reserveBasket({ pharmacyId, items });
  if (!result.ok) {
    return {
      status: "error",
      message: result.error,
      medicineId: result.medicineId,
    };
  }
  return { status: "reserved", reservation: result.reservation };
}
