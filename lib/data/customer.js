// Customer-facing data access. Screens call these; they never touch the source.
// U1–U4: reads lib/mock-data.js. W3: each body becomes a Supabase call
// (search_medicine / reservations RPCs) returning the same shapes.
import "server-only";
import {
  medicines,
  pharmacies,
  pharmacyStock,
  reservations,
} from "@/lib/mock-data";
import { distanceKm } from "@/lib/geo";
import { HOLD_MINUTES, SEARCH_RADIUS_KM, stockBand } from "@/lib/constants";

// Simulated network delay so loading states are visible during the UI phase.
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

function toMedicine(m) {
  return {
    id: m.id,
    brandName: m.brand_name,
    genericName: m.generic_name,
    manufacturer: m.manufacturer,
    strength: m.strength,
    form: m.form,
    prescriptionOnly: m.prescription_only,
  };
}

/**
 * Search approved pharmacies for a medicine (brand or generic, case-insensitive).
 * Returns stock BANDS only, never quantities.
 *
 * A location is required: callers must get one first (browser location or an
 * area picked from lib/areas.js). Without valid coordinates nothing is searched
 * and `needsLocation` is true, so the screen can ask for a location instead of
 * wrongly saying "no shops".
 *
 * @returns {{ query: string, needsLocation: boolean,
 *             withinRadius: Result[], outsideRadius: Result[] }}
 *   Result = { pharmacyId, pharmacyName, area, address, distanceKm, verified,
 *              medicine, sellingPrice, stockBand: "in"|"low"|"out" }
 *   outsideRadius holds the nearest shops beyond SEARCH_RADIUS_KM (max 3), filled
 *   only when withinRadius has no shop with stock.
 */
export async function searchMedicine({ query, lat, lng }) {
  // TODO(W3): replace with supabase.rpc("search_medicine", { q, lat, lng })
  const text = String(query ?? "");
  const q = text.trim().toLowerCase();
  const empty = {
    query: text,
    needsLocation: false,
    withinRadius: [],
    outsideRadius: [],
  };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ...empty, needsLocation: true };
  }
  if (!q) return empty;
  await delay();

  const matches = new Map(
    medicines
      .filter(
        (m) =>
          m.brand_name.toLowerCase().includes(q) ||
          m.generic_name.toLowerCase().includes(q),
      )
      .map((m) => [m.id, m]),
  );
  const approved = new Map(
    pharmacies.filter((p) => p.status === "approved").map((p) => [p.id, p]),
  );

  const results = pharmacyStock
    .filter((s) => matches.has(s.medicine_id) && approved.has(s.pharmacy_id))
    .map((s) => {
      const p = approved.get(s.pharmacy_id);
      return {
        pharmacyId: p.id,
        pharmacyName: p.name,
        area: p.area,
        address: p.address,
        distanceKm: distanceKm(lat, lng, p.latitude, p.longitude),
        // Only approved shops reach this point. In W3 take it from the row
        // (status = 'approved'); do not keep a hard-coded true.
        verified: true,
        medicine: toMedicine(matches.get(s.medicine_id)),
        sellingPrice: s.selling_price,
        stockBand: stockBand(s.quantity - s.held_quantity),
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const withinRadius = results.filter((r) => r.distanceKm <= SEARCH_RADIUS_KM);
  const hasStockNearby = withinRadius.some((r) => r.stockBand !== "out");
  const outsideRadius = hasStockNearby
    ? []
    : results
        .filter((r) => r.distanceKm > SEARCH_RADIUS_KM && r.stockBand !== "out")
        .slice(0, 3);

  return { query: text, needsLocation: false, withinRadius, outsideRadius };
}

/**
 * The signed-in customer's reservations, newest first, with items.
 * Applies lazy expiry like the database will: an `active` reservation whose hold
 * has passed is returned as `expired`. `expiresAt` is set only while the
 * reservation is still `active` (null otherwise), so a countdown is never shown
 * for a collected, cancelled or expired one.
 */
export async function getMyReservations(customerId) {
  // TODO(W3): replace with a select on reservations + reservation_items (RLS limits to own rows)
  await delay();
  const now = Date.now();
  const pharmacyById = new Map(pharmacies.map((p) => [p.id, p]));
  const medicineById = new Map(medicines.map((m) => [m.id, m]));

  return reservations
    .filter(
      (r) => r.customer_id === customerId && pharmacyById.has(r.pharmacy_id),
    )
    .map((r) => {
      const createdAt = new Date(now - r.created_minutes_ago * 60_000);
      const holdEnds = createdAt.getTime() + HOLD_MINUTES * 60_000;
      const status =
        r.status === "active" && holdEnds <= now ? "expired" : r.status;
      const p = pharmacyById.get(r.pharmacy_id);
      return {
        id: r.id,
        pharmacyId: p.id,
        pharmacyName: p.name,
        pharmacyAddress: p.address,
        pharmacyPhone: p.phone,
        pickupCode: r.pickup_code,
        status,
        createdAt: createdAt.toISOString(),
        expiresAt:
          status === "active" ? new Date(holdEnds).toISOString() : null,
        items: r.items.map((i) => ({
          medicine: toMedicine(medicineById.get(i.medicine_id)),
          quantity: i.quantity,
          unitPrice: i.unit_price,
        })),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const RESERVE_MESSAGES = {
  shopUnavailable: "This pharmacy is not taking reservations right now.",
  notStocked: (name) =>
    `${name} is not sold at this pharmacy any more. Remove it and try again.`,
  short: (name, qty) =>
    `There isn't enough ${name} in stock for ${qty}. Try a smaller quantity or remove it.`,
};

/**
 * Reserve a basket: one pharmacy, items [{ medicineId, quantity 1–5 }].
 * All or nothing (D4): if any item is short, nothing is held and the short item
 * is named (never with its exact stock count).
 * Prices come from the stock rows here, never from the browser.
 *
 * @returns {Promise<{ ok: true, reservation } | { ok: false, error: string, medicineId?: string }>}
 *   reservation has the same shape as getMyReservations() items.
 */
export async function reserveBasket({ pharmacyId, items }) {
  // TODO(W3): supabase.rpc("reserve", { p_pharmacy_id, p_items }) — the database
  //   locks stock rows ordered by medicine_id, checks role = 'customer', applies
  //   lazy expiry and generates the pickup code. Nothing here is saved.
  await delay(400);
  const p = pharmacies.find(
    (x) => x.id === pharmacyId && x.status === "approved",
  );
  if (!p) return { ok: false, error: RESERVE_MESSAGES.shopUnavailable };

  const medicineById = new Map(medicines.map((m) => [m.id, m]));
  const lines = [];
  for (const { medicineId, quantity } of [...items].sort((a, b) =>
    a.medicineId.localeCompare(b.medicineId),
  )) {
    const m = medicineById.get(medicineId);
    const s = pharmacyStock.find(
      (x) => x.pharmacy_id === pharmacyId && x.medicine_id === medicineId,
    );
    const name = m ? `${m.brand_name} ${m.strength}` : "A medicine";
    if (!m || !s)
      return {
        ok: false,
        error: RESERVE_MESSAGES.notStocked(name),
        medicineId,
      };
    if (s.quantity - s.held_quantity < quantity)
      return {
        ok: false,
        error: RESERVE_MESSAGES.short(name, quantity),
        medicineId,
      };
    lines.push({
      medicine: toMedicine(m),
      quantity,
      unitPrice: s.selling_price,
    });
  }

  const now = Date.now();
  // crypto.getRandomValues: a pickup code must not be guessable.
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return {
    ok: true,
    reservation: {
      id: `r-demo-${now}`,
      pharmacyId: p.id,
      pharmacyName: p.name,
      pharmacyAddress: p.address,
      pharmacyPhone: p.phone,
      pickupCode: String(n).padStart(6, "0"),
      status: "active",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + HOLD_MINUTES * 60_000).toISOString(),
      items: lines,
    },
  };
}

/** Cancel one of the customer's own active reservations. */
export async function cancelReservation({ customerId, reservationId }) {
  // TODO(W3): supabase.rpc("cancel_reservation", { p_reservation_id }). Nothing saved here.
  await delay();
  const r = reservations.find(
    (x) => x.id === reservationId && x.customer_id === customerId,
  );
  // Same lazy-expiry rule as getMyReservations (and the database in W3): an
  // "active" reservation past its hold is expired and cannot be cancelled.
  const holdEnds =
    Date.now() - r?.created_minutes_ago * 60_000 + HOLD_MINUTES * 60_000;
  if (!r || r.status !== "active" || holdEnds <= Date.now())
    return { ok: false, error: "This reservation can no longer be cancelled." };
  return { ok: true };
}
