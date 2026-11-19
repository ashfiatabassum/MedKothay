// Customer-facing data access. Screens call these; they never touch the source.
// W3: Postgres functions do the work (search_medicine, reserve,
// cancel_reservation, get_my_reservations); each releases lapsed holds first.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MAX_ACTIVE_RESERVATIONS } from "@/lib/constants";

/**
 * Search approved pharmacies for a medicine (brand or generic, case-insensitive).
 * Returns stock BANDS only, never quantities; distance and sorting are done in
 * SQL (Haversine, 5 km, D16 fallback of 3 distinct shops).
 *
 * A location is required. Without valid coordinates nothing is searched and
 * `needsLocation` is true, so the screen can ask for a location.
 *
 * @returns {{ query: string, needsLocation: boolean,
 *             withinRadius: Result[], outsideRadius: Result[] }}
 *   Result = { pharmacyId, pharmacyName, area, address, phone, latitude,
 *              longitude, distanceKm, verified, medicine, sellingPrice,
 *              stockBand: "in"|"low"|"out" }
 */
export async function searchMedicine({ query, lat, lng }) {
  const text = String(query ?? "");
  const empty = {
    query: text,
    needsLocation: false,
    withinRadius: [],
    outsideRadius: [],
  };
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return { ...empty, needsLocation: true };
  if (!text.trim()) return empty;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_medicine", {
    q: text.trim().slice(0, 100),
    lat,
    lng,
  });
  if (error) {
    console.error("search_medicine failed", { code: error.code });
    throw new Error("Could not search right now. Please try again.");
  }
  const toResult = (r) => ({
    ...r,
    distanceKm: Number(r.distanceKm),
    sellingPrice: Number(r.sellingPrice),
  });
  return {
    query: text,
    needsLocation: false,
    withinRadius: data.withinRadius.map(toResult),
    outsideRadius: data.outsideRadius.map(toResult),
  };
}

const toReservation = (r) => ({
  ...r,
  items: r.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
});

/**
 * The signed-in customer's reservations: active ones first, soonest to expire
 * first; then the rest, newest first. Lazy expiry is applied in the database.
 * `expiresAt` and `pickupCode` are set only while active.
 */
export async function getMyReservations() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_reservations");
  if (error) {
    console.error("get_my_reservations failed", { code: error.code });
    throw new Error("Could not load your reservations.");
  }
  return data.map(toReservation);
}

const RESERVE_MESSAGES = {
  shopUnavailable: "This pharmacy is not taking reservations right now.",
  not_stocked: (name) =>
    `${name} is not sold at this pharmacy any more. Remove it and try again.`,
  expired: (name) =>
    `${name} at this pharmacy has passed its expiry date and can't be reserved. Remove it and try again.`,
  short: (name, qty) =>
    `There isn't enough ${name} in stock for ${qty}. Try a smaller quantity or remove it.`,
  priceChanged:
    "Some prices have changed since you added them. Check the new prices, then reserve again.",
  limit: `You already have ${MAX_ACTIVE_RESERVATIONS} reservations waiting for pickup. Collect or cancel one first.`,
  failed:
    "Could not reserve right now. Nothing was reserved. Please try again.",
};

async function medicineName(supabase, id) {
  const { data } = await supabase
    .from("medicines")
    .select("brand_name, strength")
    .eq("id", id)
    .maybeSingle();
  return data ? `${data.brand_name} ${data.strength}` : "A medicine";
}

/**
 * Reserve a basket: one pharmacy, items [{ medicineId, quantity 1–5,
 * expectedPrice }]. All or nothing inside `reserve` (D4): if any item is short
 * or expired, nothing is held and that item is named (never with its stock
 * count). Changed prices hold nothing and are returned (D13). At most
 * MAX_ACTIVE_RESERVATIONS active (D15). `requestId` makes retries safe (D14).
 *
 * @returns {Promise<{ ok: true, reservation }
 *   | { ok: false, code: "price_changed", error, prices: Record<string, number> }
 *   | { ok: false, code: "limit" | "unavailable", error, medicineId? }>}
 */
export async function reserveBasket({ pharmacyId, items, requestId }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reserve", {
    p_pharmacy_id: pharmacyId,
    p_items: items.map((i) => ({
      medicine_id: i.medicineId,
      quantity: i.quantity,
      expected_unit_price: i.expectedPrice,
    })),
    p_request_id: requestId,
  });
  if (error) {
    // Invalid input or a non-customer; the action has already checked both.
    console.error("reserve failed", { code: error.code });
    return { ok: false, code: "unavailable", error: RESERVE_MESSAGES.failed };
  }
  if (data.status === "limit")
    return { ok: false, code: "limit", error: RESERVE_MESSAGES.limit };
  if (data.status === "shop_unavailable")
    return {
      ok: false,
      code: "unavailable",
      error: RESERVE_MESSAGES.shopUnavailable,
    };
  if (data.status === "price_changed")
    return {
      ok: false,
      code: "price_changed",
      error: RESERVE_MESSAGES.priceChanged,
      prices: Object.fromEntries(
        data.prices.map((p) => [p.medicineId, Number(p.unitPrice)]),
      ),
    };
  if (data.status === "unavailable") {
    const name = await medicineName(supabase, data.medicineId);
    const qty = items.find((i) => i.medicineId === data.medicineId)?.quantity;
    const message = RESERVE_MESSAGES[data.reason];
    return {
      ok: false,
      code: "unavailable",
      error: message ? message(name, qty) : RESERVE_MESSAGES.failed,
      medicineId: data.medicineId,
    };
  }
  // Reserved (or the same request id again): show it as My reservations does.
  const reservation = (await getMyReservations()).find(
    (r) => r.id === data.reservationId,
  );
  if (!reservation) {
    console.error("Reserved but not readable", { id: data.reservationId });
    return { ok: false, code: "unavailable", error: RESERVE_MESSAGES.failed };
  }
  return { ok: true, reservation };
}

/** Cancel one of the customer's own active reservations. */
export async function cancelReservation({ reservationId }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: reservationId,
  });
  if (!error) return { ok: true };
  console.error("cancel_reservation refused", { code: error.code });
  return { ok: false, error: "This reservation can no longer be cancelled." };
}
