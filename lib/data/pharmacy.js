// Pharmacy-side data access. Server-only. The pharmacy is ALWAYS taken from the
// signed-in user (user.pharmacyId), never from a form or URL. Pharmacists see
// exact quantities for their own shop only.
// U3: sample data, nothing is saved. W2/W3: Supabase queries and RPCs
// (complete_sale, collect_reservation) with RLS by pharmacy_id.
import "server-only";
import { cache } from "react";
import {
  customers,
  medicines,
  pharmacies,
  pharmacyStock,
  reservations,
  sales,
} from "@/lib/mock-data";
import { HOLD_MINUTES, LICENCE_MAX_BYTES, stockBand } from "@/lib/constants";

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const medicineById = new Map(medicines.map((m) => [m.id, m]));
const EXPIRING_DAYS = 60;

const medicineName = (m) => `${m.brand_name} ${m.strength}`;

function toPharmacy(p) {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    area: p.area,
    phone: p.phone,
    licenceNumber: p.licence_number,
    licenceExpiry: p.licence_expiry,
    status: p.status,
    rejectionReason: p.rejection_reason,
  };
}

/** The signed-in pharmacist's shop, or null if they have not registered one. */
// cache(): called by the layout and by each page in the same request.
export const getMyPharmacy = cache(async function getMyPharmacy(user) {
  // TODO(W1): select from pharmacies where id = profile.pharmacy_id (RLS).
  if (!user?.pharmacyId) return null;
  const p = pharmacies.find((x) => x.id === user.pharmacyId);
  return p ? toPharmacy(p) : null;
});

/** Own stock with exact numbers. Sorted by brand name. */
export async function getInventory(pharmacyId) {
  // TODO(W2): select pharmacy_stock join medicines where pharmacy_id = own (RLS).
  await delay();
  const soon = Date.now() + EXPIRING_DAYS * 86_400_000;
  return pharmacyStock
    .filter((s) => s.pharmacy_id === pharmacyId)
    .map((s) => {
      const m = medicineById.get(s.medicine_id);
      const available = s.quantity - s.held_quantity;
      return {
        medicineId: m.id,
        brandName: m.brand_name,
        genericName: m.generic_name,
        strength: m.strength,
        form: m.form,
        manufacturer: m.manufacturer,
        prescriptionOnly: m.prescription_only,
        quantity: s.quantity,
        heldQuantity: s.held_quantity,
        available,
        band: stockBand(available),
        sellingPrice: s.selling_price,
        expiryDate: s.expiry_date,
        expiringSoon: new Date(s.expiry_date).getTime() <= soon,
      };
    })
    .sort((a, b) => a.brandName.localeCompare(b.brandName));
}

/** Catalog medicines this shop does not stock yet (for "Add medicine"). */
export async function getCatalogNotStocked(pharmacyId) {
  const stocked = new Set(
    pharmacyStock
      .filter((s) => s.pharmacy_id === pharmacyId)
      .map((s) => s.medicine_id),
  );
  return medicines
    .filter((m) => !stocked.has(m.id))
    .map((m) => ({
      id: m.id,
      label: `${m.brand_name} ${m.strength} (${m.form}) · ${m.generic_name} · ${m.manufacturer}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function findStock(pharmacyId, medicineId) {
  return pharmacyStock.find(
    (s) => s.pharmacy_id === pharmacyId && s.medicine_id === medicineId,
  );
}

/** Add a catalog medicine to this shop's stock. */
export async function addStock({ pharmacyId, medicineId }) {
  // TODO(W2): insert into pharmacy_stock (unique pharmacy_id, medicine_id).
  await delay();
  if (!medicineById.has(medicineId))
    return { ok: false, error: "Choose a medicine from the catalog." };
  if (findStock(pharmacyId, medicineId))
    return {
      ok: false,
      error: "This medicine is already in your stock. Edit it instead.",
    };
  return { ok: true };
}

/**
 * Change quantity, price or expiry. Quantity can never go below what is held
 * for reservations (held_quantity <= quantity, CLAUDE.md).
 */
export async function updateStock({ pharmacyId, medicineId, quantity }) {
  // TODO(W2): an RPC that locks the row and checks quantity >= held_quantity.
  await delay();
  const s = findStock(pharmacyId, medicineId);
  if (!s) return { ok: false, error: "This medicine is not in your stock." };
  if (quantity < s.held_quantity) {
    return {
      ok: false,
      field: "quantity",
      error: `${s.held_quantity} ${s.held_quantity === 1 ? "unit is" : "units are"} reserved for pickup, so the quantity can't be lower than ${s.held_quantity}.`,
    };
  }
  return { ok: true };
}

/**
 * Counter sale: items [{ medicineId, quantity }]. All or nothing. A sale may use
 * only available stock (quantity - held); stock on hold is blocked with a
 * message saying how many units are reserved (CLAUDE.md "Counter sale").
 */
export async function completeSale({ pharmacyId, items }) {
  // TODO(W2): supabase.rpc("complete_sale", ...) locking rows by medicine_id.
  await delay(300);
  let total = 0;
  for (const { medicineId, quantity } of items) {
    const s = findStock(pharmacyId, medicineId);
    const m = medicineById.get(medicineId);
    if (!s || !m)
      return {
        ok: false,
        error: "One of these medicines is not in your stock.",
        medicineId,
      };
    const available = s.quantity - s.held_quantity;
    if (quantity > available) {
      const reserved =
        s.held_quantity > 0
          ? ` ${s.held_quantity} ${s.held_quantity === 1 ? "unit is" : "units are"} reserved for pickup.`
          : "";
      const error =
        available <= 0
          ? `${medicineName(m)} can't be sold: none available.${reserved}`
          : `Only ${available} ${medicineName(m)} can be sold.${reserved}`;
      return { ok: false, error, medicineId };
    }
    total += quantity * s.selling_price;
  }
  return { ok: true, saleId: `s-demo-${Date.now()}`, total };
}

function reservationStatus(r, now) {
  const holdEnds = now - r.created_minutes_ago * 60_000 + HOLD_MINUTES * 60_000;
  return {
    status: r.status === "active" && holdEnds <= now ? "expired" : r.status,
    holdEnds,
  };
}

/** Reservations for this shop: newest first, lazy expiry applied. */
export async function getIncomingReservations(pharmacyId) {
  // TODO(W3): select reservations + items where pharmacy_id = own (RLS).
  await delay();
  const now = Date.now();
  const nameById = new Map(customers.map((c) => [c.id, c.full_name]));
  return reservations
    .filter((r) => r.pharmacy_id === pharmacyId)
    .map((r) => {
      const { status, holdEnds } = reservationStatus(r, now);
      return {
        id: r.id,
        customerName: nameById.get(r.customer_id) ?? "Customer",
        status,
        createdAt: new Date(now - r.created_minutes_ago * 60_000).toISOString(),
        expiresAt:
          status === "active" ? new Date(holdEnds).toISOString() : null,
        items: r.items.map((i) => {
          const m = medicineById.get(i.medicine_id);
          return {
            medicineId: m.id,
            name: medicineName(m),
            prescriptionOnly: m.prescription_only,
            quantity: i.quantity,
            unitPrice: i.unit_price,
          };
        }),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Mark collected: the shop's own active reservation and the right code. */
export async function collectReservation({ pharmacyId, reservationId, code }) {
  // TODO(W3): supabase.rpc("collect_reservation", ...) — decreases quantity and
  //   held_quantity for every item in one transaction.
  await delay(300);
  const r = reservations.find(
    (x) => x.id === reservationId && x.pharmacy_id === pharmacyId,
  );
  if (!r) return { ok: false, error: "Reservation not found." };
  if (reservationStatus(r, Date.now()).status !== "active")
    return {
      ok: false,
      error: "This reservation is no longer waiting for pickup.",
    };
  if (code !== r.pickup_code)
    return {
      ok: false,
      error: "That pickup code doesn't match this reservation.",
    };
  return { ok: true };
}

/** Dashboard numbers for today (Asia/Dhaka). */
export async function getDashboard(pharmacyId) {
  // TODO(W2/W3): aggregate queries.
  await delay();
  const now = Date.now();
  const dhakaOffset = 6 * 3_600_000;
  const dhakaMidnight =
    Math.floor((now + dhakaOffset) / 86_400_000) * 86_400_000 - dhakaOffset;
  const todays = sales.filter(
    (s) =>
      s.pharmacy_id === pharmacyId &&
      now - s.created_minutes_ago * 60_000 >= dhakaMidnight,
  );
  const stock = pharmacyStock.filter((s) => s.pharmacy_id === pharmacyId);
  const active = reservations.filter(
    (r) =>
      r.pharmacy_id === pharmacyId &&
      reservationStatus(r, now).status === "active",
  );
  return {
    salesToday: todays.length,
    salesTotalToday: todays.reduce((sum, s) => sum + s.total, 0),
    lowStock: stock.filter(
      (s) => stockBand(s.quantity - s.held_quantity) === "low",
    ).length,
    outOfStock: stock.filter((s) => s.quantity - s.held_quantity <= 0).length,
    activeReservations: active.length,
  };
}

/**
 * Licence photo checks, shared by the registration action. The type is taken
 * from the file's first bytes, not from the name or the browser's claim.
 */
export async function checkLicencePhoto(file) {
  if (!file || typeof file === "string" || file.size === 0)
    return "Add a photo of your DGDA licence.";
  if (file.size > LICENCE_MAX_BYTES)
    return "The photo must be 5 MB or smaller.";
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng =
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  const isWebp = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) return "Use a JPG, PNG or WebP photo.";
  return null;
}

/** Create the pending pharmacy for a pharmacist without one (D1/D5/D6). */
export async function registerPharmacy({ user }) {
  // TODO(W1): upload the photo to the private licences bucket, then
  //   supabase.rpc("register_pharmacy", …); then send the "received" email (D6).
  await delay(500);
  // A rejected shop may be corrected and resubmitted; otherwise one shop each.
  const current = await getMyPharmacy(user);
  if (current && current.status !== "rejected")
    return { ok: false, error: "You have already registered a pharmacy." };
  return { ok: true };
}
