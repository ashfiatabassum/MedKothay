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
