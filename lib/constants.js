// Business constants from CLAUDE.md and docs/data-model.md. Change them here only.

export const HOLD_MINUTES = 30;
export const LOW_STOCK_MAX = 5; // 1..5 available = "Low stock"
export const MAX_UNITS_PER_ITEM = 5; // per medicine in one reservation
export const MAX_BASKET_ITEMS = 20; // different medicines in one reservation
export const MAX_SALE_LINES = 20; // different medicines in one counter sale (complete_sale limit)
export const MAX_ACTIVE_RESERVATIONS = 3; // per customer at a time (D15)
export const SEARCH_RADIUS_KM = 5;
export const MEDICINE_FORMS = ["tablet", "capsule", "syrup", "injection"];
export const LICENCE_WARN_DAYS = 30; // admin warning before a licence expires
export const LICENCE_MAX_BYTES = 5 * 1024 * 1024;
export const LICENCE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// What customers see instead of a number.
export function stockBand(available) {
  if (available <= 0) return "out";
  if (available <= LOW_STOCK_MAX) return "low";
  return "in";
}

export const STOCK_BAND_LABELS = {
  in: "In stock",
  low: "Low stock",
  out: "Out of stock",
};

export const RESERVATION_STATUS_LABELS = {
  active: "Waiting for pickup",
  collected: "Collected",
  cancelled: "Cancelled",
  expired: "Expired",
};

// Taka, no decimals when whole: 12 -> "৳12", 12.5 -> "৳12.50"
export function formatTaka(amount) {
  const n = Number(amount);
  return `৳${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

// D11: quantity and price are per piece for tablets and capsules, per bottle
// for syrups and per vial for injections. No separate unit column.
const UNIT_BY_FORM = {
  tablet: "tablet",
  capsule: "capsule",
  syrup: "bottle",
  injection: "vial",
};
export function unitOf(form) {
  return UNIT_BY_FORM[form] ?? "unit";
}
/** "৳12 per tablet" */
export function perUnit(price, form) {
  return `${formatTaka(price)} per ${unitOf(form)}`;
}
/** "2 tablets", "1 bottle" */
export function countUnits(n, form) {
  const u = unitOf(form);
  return `${n} ${u}${n === 1 ? "" : "s"}`;
}

// Today's date in Dhaka (UTC+6) as YYYY-MM-DD: the day boundary for expiry of
// stock (D9) and licences (D12, D17).
export function dhakaToday(now = Date.now()) {
  return new Date(now + 6 * 3_600_000).toISOString().slice(0, 10);
}
/** Stock or licence date (YYYY-MM-DD) before today in Dhaka. */
export function isPastDate(date, now = Date.now()) {
  return typeof date === "string" && date < dhakaToday(now);
}
