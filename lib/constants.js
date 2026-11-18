// Business constants from CLAUDE.md and docs/data-model.md. Change them here only.

export const HOLD_MINUTES = 30;
export const LOW_STOCK_MAX = 5; // 1..5 available = "Low stock"
export const MAX_UNITS_PER_ITEM = 5; // per medicine in one reservation
export const SEARCH_RADIUS_KM = 5;
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
