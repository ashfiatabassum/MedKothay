// Admin data access. Server-only. Callers must already have checked that the
// user is an admin (layout + every action).
// U4: sample data, nothing is saved. W1: Supabase queries and RPCs
// (approve_pharmacy / reject_pharmacy, medicines insert/update) under admin RLS,
// plus the approve/reject email (D6).
import "server-only";
import { cache } from "react";
import { medicines, pharmacies } from "@/lib/mock-data";
import { findArea } from "@/lib/areas";
import { LICENCE_WARN_DAYS, MEDICINE_FORMS } from "@/lib/constants";

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));
export const STATUSES = ["pending", "approved", "rejected"];
const DAY = 86_400_000;

// A licence is valid THROUGH its expiry date, judged by the date in Dhaka.
// Unreadable dates are flagged, since this badge is a safety signal.
function licenceState(expiry, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(expiry))) return "unknown";
  const today = new Date(now + 6 * 3_600_000).toISOString().slice(0, 10);
  if (expiry < today) return "expired";
  const warnUntil = new Date(now + 6 * 3_600_000 + LICENCE_WARN_DAYS * DAY)
    .toISOString()
    .slice(0, 10);
  return expiry <= warnUntil ? "expiring" : "valid";
}

function toRow(p) {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    areaName: findArea(p.area)?.name ?? p.area,
    phone: p.phone,
    licenceNumber: p.licence_number,
    licenceExpiry: p.licence_expiry,
    licenceState: licenceState(p.licence_expiry),
    latitude: p.latitude,
    longitude: p.longitude,
    status: p.status,
    rejectionReason: p.rejection_reason,
    submittedAt: p.created_at,
  };
}

/** Counts per status, for the tabs. */
export async function getPharmacyCounts() {
  return Object.fromEntries(
    STATUSES.map((s) => [s, pharmacies.filter((p) => p.status === s).length]),
  );
}

/**
 * Pharmacies with one status; optional search on name, area or licence number.
 * Pending: oldest first (first come, first reviewed). Others: newest first.
 */
export async function listPharmacies({ status, q = "" }) {
  // TODO(W1): select from pharmacies where status = $1 (admin RLS).
  await delay();
  const t = q.trim().toLowerCase();
  return pharmacies
    .filter((p) => p.status === status)
    .map(toRow)
    .filter(
      (r) =>
        !t ||
        r.name.toLowerCase().includes(t) ||
        r.areaName.toLowerCase().includes(t) ||
        r.licenceNumber.toLowerCase().includes(t),
    )
    .sort((a, b) =>
      status === "pending"
        ? a.submittedAt.localeCompare(b.submittedAt)
        : b.submittedAt.localeCompare(a.submittedAt),
    );
}

// cache(): generateMetadata and the page both ask for the same pharmacy.
export const getPharmacy = cache(async function getPharmacy(id) {
  await delay();
  const p = pharmacies.find((x) => x.id === id);
  return p ? toRow(p) : null;
});

/** Approve a pending pharmacy. */
export async function approvePharmacy(id) {
  // TODO(W1): rpc("approve_pharmacy") then send the "approved" email (D6).
  await delay(300);
  const p = pharmacies.find((x) => x.id === id);
  if (!p) return { ok: false, error: "Pharmacy not found." };
  if (p.status !== "pending")
    return { ok: false, error: "Only pending pharmacies can be approved." };
  return { ok: true };
}

/** Reject a pending pharmacy with a reason the owner will see. */
export async function rejectPharmacy(id, reason) {
  // TODO(W1): rpc("reject_pharmacy") then send the "not approved" email with the reason (D6).
  await delay(300);
  void reason;
  const p = pharmacies.find((x) => x.id === id);
  if (!p) return { ok: false, error: "Pharmacy not found." };
  if (p.status !== "pending")
    return { ok: false, error: "Only pending pharmacies can be rejected." };
  return { ok: true };
}

// ---------- Medicine catalog ----------

export const FORMS = MEDICINE_FORMS;

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

export async function listMedicines() {
  // TODO(W1): select from medicines order by brand_name.
  await delay();
  return medicines
    .map(toMedicine)
    .sort((a, b) => a.brandName.localeCompare(b.brandName));
}

const sameMedicine = (a, b) =>
  a.brandName.toLowerCase() === b.brand_name.toLowerCase() &&
  a.strength.toLowerCase().replace(/\s+/g, "") ===
    b.strength.toLowerCase().replace(/\s+/g, "") &&
  a.form === b.form;

/** Add a medicine; the same brand + strength + form may exist only once. */
export async function addMedicine(fields) {
  // TODO(W1): insert into medicines (unique brand_name, strength, form).
  await delay(300);
  if (medicines.some((m) => sameMedicine(fields, m)))
    return {
      ok: false,
      error:
        "This medicine (brand, strength and form) is already in the catalog.",
    };
  return { ok: true };
}

export async function updateMedicine(id, fields) {
  // TODO(W1): update medicines set … where id = $1.
  await delay(300);
  if (!medicines.some((m) => m.id === id))
    return { ok: false, error: "Medicine not found." };
  if (medicines.some((m) => m.id !== id && sameMedicine(fields, m)))
    return {
      ok: false,
      error: "Another catalog entry already has this brand, strength and form.",
    };
  return { ok: true };
}
