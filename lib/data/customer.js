// Customer-facing data access. Screens call these; they never touch the source.
// U1–R1: reads lib/mock-data.js. W3: each body becomes a Supabase call
// (search_medicine / reservations RPCs) returning the same shapes.
import "server-only";
import {
  medicines,
  pharmacies,
  pharmacyStock,
  reservations,
} from "@/lib/mock-data";
import { distanceKm } from "@/lib/geo";
import {
  HOLD_MINUTES,
  MAX_ACTIVE_RESERVATIONS,
  SEARCH_RADIUS_KM,
  isPastDate,
  stockBand,
} from "@/lib/constants";

// Simulated network delay so loading states are visible during the UI phase.
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const FALLBACK_SHOPS = 3; // D16

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

/** Customers can see a shop only while approved with a licence not yet expired (D12). */
function visibleToCustomers(p) {
  return p.status === "approved" && !isPastDate(p.licence_expiry);
}

/** Sellable now: expired stock counts as 0 (D9). Never sent to the browser. */
function availableNow(s) {
  return isPastDate(s.expiry_date) ? 0 : s.quantity - s.held_quantity;
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
 *   Result = { pharmacyId, pharmacyName, area, address, phone, latitude,
 *              longitude, distanceKm, verified, medicine, sellingPrice,
 *              stockBand: "in"|"low"|"out" }
 *   outsideRadius holds the nearest FALLBACK_SHOPS distinct pharmacies beyond
 *   SEARCH_RADIUS_KM that have it in stock, with all their matching medicines
 *   (D16); filled only when no shop within the radius has stock.
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
  const visible = new Map(
    pharmacies.filter(visibleToCustomers).map((p) => [p.id, p]),
  );

  const results = pharmacyStock
    .filter(
      (s) =>
        matches.has(s.medicine_id) &&
        visible.has(s.pharmacy_id) &&
        !isPastDate(s.expiry_date),
    )
    .map((s) => {
      const p = visible.get(s.pharmacy_id);
      return {
        pharmacyId: p.id,
        pharmacyName: p.name,
        area: p.area,
        address: p.address,
        phone: p.phone,
        latitude: p.latitude,
        longitude: p.longitude,
        distanceKm: distanceKm(lat, lng, p.latitude, p.longitude),
        // Only approved shops with a valid licence reach this point. In W3 take
        // it from the row; do not keep a hard-coded true.
        verified: true,
        medicine: toMedicine(matches.get(s.medicine_id)),
        sellingPrice: s.selling_price,
        stockBand: stockBand(availableNow(s)),
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const withinRadius = results.filter((r) => r.distanceKm <= SEARCH_RADIUS_KM);
  const hasStockNearby = withinRadius.some((r) => r.stockBand !== "out");
  let outsideRadius = [];
  if (!hasStockNearby) {
    const farInStock = results.filter(
      (r) => r.distanceKm > SEARCH_RADIUS_KM && r.stockBand !== "out",
    );
    const shopIds = [...new Set(farInStock.map((r) => r.pharmacyId))].slice(
      0,
      FALLBACK_SHOPS,
    );
    outsideRadius = farInStock.filter((r) => shopIds.includes(r.pharmacyId));
  }

  return { query: text, needsLocation: false, withinRadius, outsideRadius };
}

function reservationStatus(r, now) {
  const holdEnds = now - r.created_minutes_ago * 60_000 + HOLD_MINUTES * 60_000;
  return {
    status: r.status === "active" && holdEnds <= now ? "expired" : r.status,
    holdEnds,
  };
}

/**
 * The signed-in customer's reservations: active ones first, soonest to expire
 * first; then the rest, newest first. Applies lazy expiry like the database
 * will. `expiresAt` is set only while active.
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
      const { status, holdEnds } = reservationStatus(r, now);
      const p = pharmacyById.get(r.pharmacy_id);
      return {
        id: r.id,
        pharmacyId: p.id,
        pharmacyName: p.name,
        pharmacyAddress: p.address,
        pharmacyPhone: p.phone,
        pharmacyLatitude: p.latitude,
        pharmacyLongitude: p.longitude,
        pickupCode: r.pickup_code,
        status,
        cancellationReason: r.cancellation_reason ?? null,
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
    .sort((a, b) => {
      const aActive = a.status === "active";
      const bActive = b.status === "active";
      if (aActive !== bActive) return aActive ? -1 : 1;
      return aActive
        ? a.expiresAt.localeCompare(b.expiresAt)
        : b.createdAt.localeCompare(a.createdAt);
    });
}

const RESERVE_MESSAGES = {
  shopUnavailable: "This pharmacy is not taking reservations right now.",
  notStocked: (name) =>
    `${name} is not sold at this pharmacy any more. Remove it and try again.`,
  expired: (name) =>
    `${name} at this pharmacy has passed its expiry date and can't be reserved. Remove it and try again.`,
  short: (name, qty) =>
    `There isn't enough ${name} in stock for ${qty}. Try a smaller quantity or remove it.`,
  priceChanged:
    "Some prices have changed since you added them. Check the new prices, then reserve again.",
  limit: `You already have ${MAX_ACTIVE_RESERVATIONS} reservations waiting for pickup. Collect or cancel one first.`,
};

/**
 * Reserve a basket: one pharmacy, items [{ medicineId, quantity 1–5,
 * expectedPrice }]. All or nothing (D4): if any item is short or expired,
 * nothing is held and that item is named (never with its stock count).
 * If any price differs from what the customer saw, nothing is held and the
 * current prices are returned (D13). At most MAX_ACTIVE_RESERVATIONS active per
 * customer (D15). `requestId` makes retries safe (D14).
 *
 * @returns {Promise<{ ok: true, reservation }
 *   | { ok: false, code: "price_changed", error, prices: Record<string, number> }
 *   | { ok: false, code: "limit" | "unavailable", error, medicineId? }>}
 */
export async function reserveBasket({
  customerId,
  pharmacyId,
  items,
  requestId,
}) {
  // TODO(W3): supabase.rpc("reserve", { p_pharmacy_id, p_items, p_request_id }).
  //   The database locks stock rows ordered by medicine_id, releases expired
  //   holds first (D10), checks role = 'customer', returns the existing
  //   reservation for a repeated request id (D14), stores unit_price (D8) and
  //   generates the pickup code. Nothing here is saved, so requestId is unused.
  void requestId;
  await delay(400);
  const now = Date.now();

  const active = reservations.filter(
    (r) =>
      r.customer_id === customerId &&
      reservationStatus(r, now).status === "active",
  ).length;
  if (active >= MAX_ACTIVE_RESERVATIONS)
    return { ok: false, code: "limit", error: RESERVE_MESSAGES.limit };

  const p = pharmacies.find(
    (x) => x.id === pharmacyId && visibleToCustomers(x),
  );
  if (!p)
    return {
      ok: false,
      code: "unavailable",
      error: RESERVE_MESSAGES.shopUnavailable,
    };

  const medicineById = new Map(medicines.map((m) => [m.id, m]));
  const sorted = [...items].sort((a, b) =>
    a.medicineId.localeCompare(b.medicineId),
  );

  // Price check first (D13): the customer must agree to the current prices.
  const prices = {};
  let priceChanged = false;
  for (const { medicineId, expectedPrice } of sorted) {
    const s = pharmacyStock.find(
      (x) => x.pharmacy_id === pharmacyId && x.medicine_id === medicineId,
    );
    if (s) {
      prices[medicineId] = s.selling_price;
      if (Number(expectedPrice) !== s.selling_price) priceChanged = true;
    }
  }
  if (priceChanged)
    return {
      ok: false,
      code: "price_changed",
      error: RESERVE_MESSAGES.priceChanged,
      prices,
    };

  const lines = [];
  for (const { medicineId, quantity } of sorted) {
    const m = medicineById.get(medicineId);
    const s = pharmacyStock.find(
      (x) => x.pharmacy_id === pharmacyId && x.medicine_id === medicineId,
    );
    const name = m ? `${m.brand_name} ${m.strength}` : "A medicine";
    if (!m || !s)
      return {
        ok: false,
        code: "unavailable",
        error: RESERVE_MESSAGES.notStocked(name),
        medicineId,
      };
    if (isPastDate(s.expiry_date))
      return {
        ok: false,
        code: "unavailable",
        error: RESERVE_MESSAGES.expired(name),
        medicineId,
      };
    if (availableNow(s) < quantity)
      return {
        ok: false,
        code: "unavailable",
        error: RESERVE_MESSAGES.short(name, quantity),
        medicineId,
      };
    lines.push({
      medicine: toMedicine(m),
      quantity,
      unitPrice: s.selling_price, // stored with the reservation (D8)
    });
  }

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
      pharmacyLatitude: p.latitude,
      pharmacyLongitude: p.longitude,
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
  // Same lazy-expiry rule as getMyReservations (and the database in W3).
  if (!r || reservationStatus(r, Date.now()).status !== "active")
    return { ok: false, error: "This reservation can no longer be cancelled." };
  return { ok: true };
}
