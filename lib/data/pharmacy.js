// Pharmacy-side data access. Server-only. The pharmacy is ALWAYS taken from the
// signed-in user (user.pharmacyId), never from a form or URL. Pharmacists see
// exact quantities for their own shop only.
// W2: stock, sales and dashboard read Supabase under RLS; every stock change
// goes through a Postgres function (set_stock, complete_sale).
// W3: incoming reservations and collection (get_shop_reservations,
// collect_pickup).
import "server-only";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { sendPharmacyMail } from "@/lib/data/mail";
import {
  LICENCE_MAX_BYTES,
  dhakaToday,
  isPastDate,
  stockBand,
} from "@/lib/constants";

const EXPIRING_DAYS = 60;

function toPharmacy(p) {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    area: p.area,
    latitude: p.latitude,
    longitude: p.longitude,
    locationSource: p.location_source ?? "area",
    phone: p.phone,
    licenceNumber: p.licence_number,
    licencePhotoPath: p.licence_photo_url,
    licenceExpiry: p.licence_expiry,
    status: p.status,
    rejectionReason: p.rejection_reason,
    // An approved shop whose licence date has passed is hidden from customers
    // until the owner updates it (D12).
    licenceExpired: isPastDate(p.licence_expiry),
  };
}

/** Owner may (re)submit the registration form: no shop yet, rejected,
 * suspended (D18) or with an expired licence (D12). Pending/approved: no. */
export function canSubmitRegistration(pharmacy) {
  return (
    !pharmacy ||
    pharmacy.status === "rejected" ||
    pharmacy.status === "suspended" ||
    pharmacy.licenceExpired
  );
}

/** The signed-in pharmacist's shop, or null if they have not registered one. */
// cache(): called by the layout and by each page in the same request.
export const getMyPharmacy = cache(async function getMyPharmacy(user) {
  if (!user?.pharmacyId) return null;
  const supabase = await createClient();
  const { data: p, error } = await supabase
    .from("pharmacies")
    .select("*")
    .eq("id", user.pharmacyId)
    .single();
  if (error) throw new Error("Could not load your pharmacy.");
  return p ? toPharmacy(p) : null;
});

const unitsAre = (n) => `${n} ${n === 1 ? "unit is" : "units are"}`;

/**
 * Units still locked by active reservations whose 30 minutes have passed, per
 * medicine. The database releases them inside the next stock function (D10);
 * the owner's screens discount them now so the displayed and sellable counts
 * agree. Read-only: nothing is written here.
 */
async function lapsedHolds(supabase, pharmacyId) {
  const { data, error } = await supabase
    .from("reservations")
    .select("reservation_items(medicine_id, quantity)")
    .eq("pharmacy_id", pharmacyId)
    .eq("status", "active")
    .lte("expires_at", new Date().toISOString());
  if (error) throw new Error("Could not load your stock.");
  const held = new Map();
  for (const r of data)
    for (const i of r.reservation_items)
      held.set(i.medicine_id, (held.get(i.medicine_id) ?? 0) + i.quantity);
  return held;
}

/** Own stock with exact numbers. Sorted by brand name. */
export async function getInventory(pharmacyId) {
  const supabase = await createClient();
  const [stock, lapsed] = await Promise.all([
    supabase
      .from("pharmacy_stock")
      .select(
        "medicine_id, quantity, held_quantity, selling_price, expiry_date, medicines(brand_name, generic_name, strength, form, manufacturer, prescription_only)",
      )
      .eq("pharmacy_id", pharmacyId),
    lapsedHolds(supabase, pharmacyId),
  ]);
  if (stock.error) throw new Error("Could not load your stock.");
  const soon = Date.now() + EXPIRING_DAYS * 86_400_000;
  return stock.data
    .map((s) => {
      const m = s.medicines;
      const held = Math.max(
        0,
        s.held_quantity - (lapsed.get(s.medicine_id) ?? 0),
      );
      // Expired stock is unavailable for sale and reservations (D9).
      const expired = isPastDate(s.expiry_date);
      const available = expired ? 0 : s.quantity - held;
      return {
        medicineId: s.medicine_id,
        brandName: m.brand_name,
        genericName: m.generic_name,
        strength: m.strength,
        form: m.form,
        manufacturer: m.manufacturer,
        prescriptionOnly: m.prescription_only,
        quantity: s.quantity,
        heldQuantity: held,
        available,
        band: stockBand(available),
        sellingPrice: Number(s.selling_price),
        expiryDate: s.expiry_date,
        expired,
        expiringSoon: !expired && new Date(s.expiry_date).getTime() <= soon,
      };
    })
    .sort((a, b) => a.brandName.localeCompare(b.brandName));
}

/** Catalog medicines this shop does not stock yet (for "Add medicine"). */
export async function getCatalogNotStocked(pharmacyId) {
  const supabase = await createClient();
  const [catalog, stocked] = await Promise.all([
    supabase
      .from("medicines")
      .select("id, brand_name, generic_name, strength, form, manufacturer"),
    supabase
      .from("pharmacy_stock")
      .select("medicine_id")
      .eq("pharmacy_id", pharmacyId),
  ]);
  if (catalog.error || stocked.error)
    throw new Error("Could not load the medicine catalog.");
  const have = new Set(stocked.data.map((s) => s.medicine_id));
  return catalog.data
    .filter((m) => !have.has(m.id))
    .map((m) => ({
      id: m.id,
      label: `${m.brand_name} ${m.strength} (${m.form}) · ${m.generic_name} · ${m.manufacturer}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * save_stock locks the shop and row in the database. `expectedQuantity` is the
 * shelf quantity the owner saw: null adds a new row (refused if it exists);
 * otherwise a changed quantity (sale, pickup, other edit) refuses the save so
 * a stale form cannot undo it. Quantity never goes below held units.
 */
async function saveStock({
  medicineId,
  expectedQuantity,
  quantity,
  sellingPrice,
  expiryDate,
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_stock", {
    p_medicine_id: medicineId,
    p_expected_quantity: expectedQuantity,
    p_quantity: quantity,
    p_selling_price: sellingPrice,
    p_expiry_date: expiryDate,
  });
  if (error) {
    if (error.code === "23503")
      return { ok: false, error: "Choose a medicine from the catalog." };
    console.error("save_stock failed", { code: error.code });
    return { ok: false, error: "Could not save the stock. Please try again." };
  }
  switch (data.status) {
    case "saved":
      return { ok: true };
    case "exists":
      return {
        ok: false,
        error: "This medicine is already in your stock. Edit it instead.",
      };
    case "not_stocked":
      return { ok: false, error: "This medicine is not in your stock." };
    case "changed":
      return {
        ok: false,
        stale: true,
        error: `The stock changed since you opened this form (a sale, pickup or another edit). It now has ${data.quantity}. Nothing was saved; check the numbers and save again.`,
      };
    case "below_held":
      return {
        ok: false,
        field: "quantity",
        error: `${unitsAre(data.held)} reserved for pickup, so the quantity can't be lower than ${data.held}.`,
      };
    default:
      return {
        ok: false,
        error: "Could not save the stock. Please try again.",
      };
  }
}

/** Add a catalog medicine to this shop's stock (insert only). */
export async function addStock(fields) {
  return saveStock({ ...fields, expectedQuantity: null });
}

/** Change quantity, price or expiry of a row whose quantity the owner saw. */
export async function updateStock(fields) {
  return saveStock(fields);
}

/** Why this line can't be sold from this stock row, or null if it can. */
function saleProblem(s, quantity) {
  const name = `${s.brandName} ${s.strength}`;
  if (s.expired)
    return `${name} has passed its expiry date (${s.expiryDate}) and can't be sold.`;
  if (quantity <= s.available) return null;
  const reserved =
    s.heldQuantity > 0
      ? ` ${unitsAre(s.heldQuantity)} reserved for pickup.`
      : "";
  return s.available <= 0
    ? `${name} can't be sold: none available.${reserved}`
    : `Only ${s.available} ${name} can be sold.${reserved}`;
}

/**
 * Counter sale: items [{ medicineId, quantity }]. All or nothing, in
 * complete_sale: it releases lapsed holds, locks rows in medicine order and
 * sells only available stock (quantity - held). When it refuses, the stock is
 * read again to name the item and say how many units are reserved.
 */
export async function completeSale({ pharmacyId, items }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_sale", {
    p_items: items.map((i) => ({
      medicine_id: i.medicineId,
      quantity: i.quantity,
    })),
  });
  if (!error)
    return { ok: true, saleId: data.saleId, total: Number(data.total) };
  console.error("complete_sale refused", { code: error.code });
  const stock = new Map(
    (await getInventory(pharmacyId)).map((s) => [s.medicineId, s]),
  );
  // Same order as the database checks them.
  for (const { medicineId, quantity } of [...items].sort((a, b) =>
    a.medicineId.localeCompare(b.medicineId),
  )) {
    const s = stock.get(medicineId);
    if (!s)
      return {
        ok: false,
        error: "One of these medicines is not in your stock.",
        medicineId,
      };
    const problem = saleProblem(s, quantity);
    if (problem) return { ok: false, error: problem, medicineId };
  }
  return {
    ok: false,
    error: "Could not complete the sale. Nothing was sold. Please try again.",
  };
}

/**
 * Reservations for this shop, newest first, with customer names (never pickup
 * codes). get_shop_reservations releases lapsed holds first (D10).
 */
export async function getIncomingReservations() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shop_reservations");
  if (error) {
    console.error("get_shop_reservations failed", { code: error.code });
    throw new Error("Could not load reservations.");
  }
  return data.map((r) => ({
    ...r,
    items: r.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  }));
}

const COLLECT_MESSAGES = {
  // Same answer for a wrong code and another shop's reservation (security U3).
  no_match: "That pickup code doesn't match this reservation.",
  not_active: "This reservation is no longer waiting for pickup.",
  locked:
    "Too many wrong codes. This reservation can't be collected; the customer can cancel it and reserve again.",
};

/**
 * Mark collected: the whole reservation, in collect_pickup (quantity and held
 * both drop for every item). Five wrong codes lock the reservation.
 */
export async function collectReservation({ reservationId, code }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("collect_pickup", {
    p_reservation_id: reservationId,
    p_pickup_code: code,
  });
  if (error) {
    console.error("collect_pickup failed", { code: error.code });
    return {
      ok: false,
      error: "Could not mark it collected. Please try again.",
    };
  }
  if (data.status === "collected") return { ok: true };
  if (data.status === "expired_item")
    return {
      ok: false,
      error: `${data.name} has passed its expiry date, so this reservation can't be handed over.`,
    };
  return {
    ok: false,
    locked: data.status === "locked",
    error: COLLECT_MESSAGES[data.status] ?? COLLECT_MESSAGES.no_match,
  };
}

/** Dashboard numbers for today (Asia/Dhaka). */
export async function getDashboard(pharmacyId) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  // Midnight in Dhaka (UTC+6) for today's date there.
  const dhakaMidnight = `${dhakaToday()}T00:00:00+06:00`;
  const [todays, active, stock] = await Promise.all([
    supabase
      .from("sales")
      .select("total")
      .eq("pharmacy_id", pharmacyId)
      .gte("created_at", dhakaMidnight),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("pharmacy_id", pharmacyId)
      .eq("status", "active")
      .gt("expires_at", now),
    getInventory(pharmacyId),
  ]);
  if (todays.error || active.error)
    throw new Error("Could not load the dashboard.");
  return {
    salesToday: todays.data.length,
    salesTotalToday: todays.data.reduce((sum, s) => sum + Number(s.total), 0),
    lowStock: stock.filter((s) => s.band === "low").length,
    outOfStock: stock.filter((s) => s.available <= 0).length,
    activeReservations: active.count ?? 0,
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
export async function registerPharmacy({ user, photo, ...fields }) {
  if (user?.role !== "pharmacist")
    return { ok: false, error: "Sign in with your pharmacy account." };
  const current = await getMyPharmacy(user);
  if (!canSubmitRegistration(current))
    return { ok: false, error: "You have already registered a pharmacy." };
  const photoError = await checkLicencePhoto(photo);
  if (photoError) return { ok: false, error: photoError };
  const bytes = new Uint8Array(await photo.slice(0, 12).arrayBuffer());
  const mime =
    bytes[0] === 0xff
      ? "image/jpeg"
      : bytes[0] === 0x89
        ? "image/png"
        : "image/webp";
  const extension =
    mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const path = `${user.id}/${randomUUID()}.${extension}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("licences")
    .upload(path, photo, { contentType: mime, upsert: false });
  if (uploadError)
    return {
      ok: false,
      error: "Could not upload the licence photo. Please try again.",
    };
  const args = {
    p_name: fields.name,
    p_address: fields.address,
    p_area: fields.area,
    p_latitude: fields.lat,
    p_longitude: fields.lng,
    p_phone: fields.phone,
    p_licence_number: fields.licenceNumber,
    p_licence_photo_url: path,
    p_licence_expiry: fields.licenceExpiry,
    p_location_source: fields.locationSource,
  };
  const { error } = await supabase.rpc(
    current ? "resubmit_pharmacy" : "register_pharmacy",
    args,
  );
  if (error) {
    const cleanup = await supabase.storage.from("licences").remove([path]);
    if (cleanup.error)
      console.error("Unused licence cleanup failed", {
        code: cleanup.error.statusCode,
      });
    console.error("Pharmacy registration RPC failed", { code: error.code });
    return {
      ok: false,
      error: "Could not save the pharmacy. Please try again.",
    };
  }
  if (current?.licencePhotoPath && current.licencePhotoPath !== path) {
    const cleanup = await supabase.storage
      .from("licences")
      .remove([current.licencePhotoPath]);
    if (cleanup.error)
      console.error("Replaced licence cleanup failed", {
        code: cleanup.error.statusCode,
      });
  }
  const { data: auth } = await supabase.auth.getUser();
  await sendPharmacyMail({
    to: auth.user?.email,
    shop: fields.name,
    event: "received",
  });
  return { ok: true };
}
