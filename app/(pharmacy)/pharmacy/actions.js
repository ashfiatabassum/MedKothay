"use server";

// Pharmacy server actions. The shop is ALWAYS the signed-in pharmacist's own
// (from the session), never an id sent by the browser. All input is checked here.
import { getCurrentUser } from "@/lib/data/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addStock,
  checkLicencePhoto,
  collectReservation,
  completeSale,
  getMyPharmacy,
  registerPharmacy,
  updateStock,
} from "@/lib/data/pharmacy";
import { findArea } from "@/lib/areas";
import { MAX_SALE_LINES } from "@/lib/constants";
import { checkFullName, isUuid, normalizeBdPhone } from "@/lib/validation";

const text = (fd, name) => String(fd.get(name) ?? "").trim();

async function ownPharmacy() {
  const user = await getCurrentUser();
  if (user?.role !== "pharmacist")
    return { error: "Sign in with your pharmacy account." };
  const pharmacy = await getMyPharmacy(user);
  if (!pharmacy) return { user, error: "Register your pharmacy first." };
  return { user, pharmacy };
}

// Inventory, counter and dashboard all show the same stock rows.
function refreshStockPages() {
  revalidatePath("/pharmacy");
  revalidatePath("/pharmacy/inventory");
  revalidatePath("/pharmacy/counter");
}

// Whole numbers only: "" , "1e2" and "0x10" are rejected (Number() would accept them).
function intIn(value, min, max) {
  const s = String(value ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

// Taka with at most 2 decimals, checked as text (8.20 and 1.15 are valid).
function priceOk(value) {
  const s = String(value ?? "").trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n <= 100_000 ? n : null;
}

// Today's date in Dhaka (UTC+6), as YYYY-MM-DD, so "today" matches the shop.
function dhakaToday() {
  return new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
}

/** A real calendar date (YYYY-MM-DD), past or future, or null. */
function realDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  // Round trip rejects overflow like 2027-02-31 (which Date turns into March 3).
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    return null;
  return value;
}

/**
 * For editing existing stock: a real date, past or future, within sensible
 * bounds (from 2000 to 10 years ahead), so typos like 0001 or 9999 are refused.
 */
function plausibleDate(value) {
  if (!realDate(value)) return null;
  const today = dhakaToday();
  const max = `${Number(today.slice(0, 4)) + 10}${today.slice(4)}`;
  return value >= "2000-01-01" && value <= max ? value : null;
}

/** A real calendar date after today (Dhaka), at most `maxYears` ahead. */
function futureDate(value, maxYears = 10) {
  if (!realDate(value)) return null;
  const today = dhakaToday();
  const max = `${Number(today.slice(0, 4)) + maxYears}${today.slice(4)}`;
  return value > today && value <= max ? value : null;
}

// ---------- Registration (step 2 of 2) ----------

export async function registerPharmacyAction(_prev, fd) {
  const user = await getCurrentUser();
  if (user?.role !== "pharmacist")
    return {
      status: "error",
      formError: "Sign in with your pharmacy account.",
    };

  const v = {
    name: text(fd, "name"),
    address: text(fd, "address"),
    area: text(fd, "area"),
    lat: text(fd, "lat"),
    lng: text(fd, "lng"),
    locationSource: text(fd, "locationSource"),
    phone: text(fd, "phone"),
    licenceNumber: text(fd, "licenceNumber"),
    licenceExpiry: text(fd, "licenceExpiry"),
  };
  const e = {};
  const nameErr = checkFullName(v.name);
  if (nameErr) e.name = nameErr.replace("your full name", "the shop name");
  if (v.address.length < 5 || v.address.length > 200)
    e.address = "Enter the shop's street address (5 to 200 characters).";
  const area = findArea(v.area);
  if (!area) e.area = "Choose the area your shop is in.";
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  if (area && !(lat > 20 && lat < 27 && lng > 88 && lng < 93))
    e.location = "Set the shop's location.";
  if (!["area", "device"].includes(v.locationSource))
    e.location = "Choose the shop's area or use your current location.";
  const phone = normalizeBdPhone(v.phone);
  if (phone.error)
    e.phone = phone.error.replace(
      "your mobile number",
      "the shop's mobile number",
    );
  if (!/^[A-Za-z0-9][A-Za-z0-9/-]{3,39}$/.test(v.licenceNumber))
    e.licenceNumber =
      "Enter the DGDA licence number as printed (letters, numbers, - or /).";
  if (!futureDate(v.licenceExpiry))
    e.licenceExpiry =
      "Enter a real expiry date after today (at most 10 years ahead).";
  const photoErr = await checkLicencePhoto(fd.get("licencePhoto"));
  if (photoErr) e.licencePhoto = photoErr;

  if (Object.keys(e).length)
    return { status: "error", fieldErrors: e, values: v };

  const result = await registerPharmacy({
    user,
    photo: fd.get("licencePhoto"),
    ...v,
    lat,
    lng,
    phone: phone.value.slice(3),
  });
  if (!result.ok)
    return { status: "error", formError: result.error, values: v };
  revalidatePath("/pharmacy");
  revalidatePath("/admin");
  redirect("/pharmacy");
}

// ---------- Inventory ----------

export async function addStockAction(_prev, fd) {
  const own = await ownPharmacy();
  if (own.error) return { status: "error", formError: own.error };
  const medicineId = text(fd, "medicineId");
  const quantity = intIn(fd.get("quantity"), 0, 100_000);
  const sellingPrice = priceOk(fd.get("sellingPrice"));
  const expiryDate = futureDate(text(fd, "expiryDate"));
  const values = {
    medicineId,
    quantity: text(fd, "quantity"),
    sellingPrice: text(fd, "sellingPrice"),
    expiryDate: text(fd, "expiryDate"),
  };
  const e = {};
  if (!isUuid(medicineId)) e.medicineId = "Choose a medicine.";
  if (quantity === null) e.quantity = "Enter a whole number from 0 to 100000.";
  if (sellingPrice === null)
    e.sellingPrice = "Enter a price in taka, like 12 or 12.50.";
  if (!expiryDate) e.expiryDate = "Enter a future expiry date.";
  if (Object.keys(e).length) return { status: "error", fieldErrors: e, values };
  const r = await addStock({
    pharmacyId: own.pharmacy.id,
    medicineId,
    quantity,
    sellingPrice,
    expiryDate,
  });
  if (r.ok) refreshStockPages();
  return r.ok
    ? { status: "saved" }
    : { status: "error", formError: r.error, values };
}

export async function updateStockAction(_prev, fd) {
  const own = await ownPharmacy();
  if (own.error) return { status: "error", formError: own.error };
  const medicineId = text(fd, "medicineId");
  if (!isUuid(medicineId))
    return {
      status: "error",
      formError: "This medicine is not in your stock.",
    };
  const quantity = intIn(fd.get("quantity"), 0, 100_000);
  const sellingPrice = priceOk(fd.get("sellingPrice"));
  // Editing existing stock accepts a past expiry, so expired stock can still be
  // corrected or set to 0 (only NEW stock must expire in the future).
  const expiryDate = plausibleDate(text(fd, "expiryDate"));
  const values = {
    quantity: text(fd, "quantity"),
    sellingPrice: text(fd, "sellingPrice"),
    expiryDate: text(fd, "expiryDate"),
  };
  const e = {};
  if (quantity === null) e.quantity = "Enter a whole number from 0 to 100000.";
  if (sellingPrice === null)
    e.sellingPrice = "Enter a price in taka, like 12 or 12.50.";
  if (!expiryDate)
    e.expiryDate = "Enter a real expiry date (from 2000 up to 10 years ahead).";
  if (Object.keys(e).length) return { status: "error", fieldErrors: e, values };
  // The quantity the form showed; a changed shelf refuses the save.
  const expectedQuantity = intIn(fd.get("expectedQuantity"), 0, 100_000);
  if (expectedQuantity === null)
    return {
      status: "error",
      formError: "Refresh the page and edit again.",
      values,
    };
  const r = await updateStock({
    medicineId,
    expectedQuantity,
    quantity,
    sellingPrice,
    expiryDate,
  });
  // A stale form: refresh so the row shows the current quantity.
  if (r.stale) refreshStockPages();
  if (!r.ok)
    return r.field
      ? { status: "error", fieldErrors: { [r.field]: r.error }, values }
      : { status: "error", formError: r.error, values };
  refreshStockPages();
  return { status: "saved" };
}

// ---------- Counter sale ----------

export async function completeSaleAction(payload) {
  const own = await ownPharmacy();
  if (own.error) return { status: "error", message: own.error };
  const raw = Array.isArray(payload?.items) ? payload.items : [];
  const seen = new Set();
  const items = [];
  if (raw.length > MAX_SALE_LINES)
    return {
      status: "error",
      message: `A sale can have at most ${MAX_SALE_LINES} different medicines. Split it into two sales.`,
    };
  for (const i of raw) {
    const medicineId =
      typeof i?.medicineId === "string" ? i.medicineId.slice(0, 64) : "";
    const quantity = intIn(i?.quantity, 1, 1000);
    if (!isUuid(medicineId) || quantity === null || seen.has(medicineId))
      return {
        status: "error",
        message: "Check the quantities and try again.",
      };
    seen.add(medicineId);
    items.push({ medicineId, quantity });
  }
  if (items.length === 0)
    return { status: "error", message: "Add at least one medicine." };
  const r = await completeSale({ pharmacyId: own.pharmacy.id, items });
  if (r.ok) refreshStockPages();
  return r.ok
    ? { status: "sold", total: r.total }
    : { status: "error", message: r.error, medicineId: r.medicineId };
}

// ---------- Reservations ----------

export async function collectAction(_prev, fd) {
  const own = await ownPharmacy();
  if (own.error) return { status: "error", message: own.error };
  const reservationId = text(fd, "reservationId");
  const code = text(fd, "code").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code))
    return {
      status: "error",
      message: "Enter the 6-digit pickup code from the customer.",
    };
  if (!isUuid(reservationId))
    return {
      status: "error",
      message: "That pickup code doesn't match this reservation.",
      code,
    };
  const r = await collectReservation({ reservationId, code });
  if (r.ok) refreshStockPages();
  // Collected or just locked: the list must show the new state.
  if (r.ok || r.locked) revalidatePath("/pharmacy/reservations");
  return r.ok
    ? { status: "collected" }
    : { status: "error", message: r.error, code };
}
