import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { findArea } from "@/lib/areas";
import { requireRole } from "@/lib/data/session";
import { ownerEmailForShop, sendPharmacyMail } from "@/lib/data/mail";
import { LICENCE_WARN_DAYS, MEDICINE_FORMS } from "@/lib/constants";

export const STATUSES = ["pending", "approved", "rejected", "suspended"];
export const FORMS = MEDICINE_FORMS;
export const validId = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const DATA_ERROR = "Could not load the data. Please try again.";
const DECISION_ERROR = "Could not save the decision. Refresh and try again.";

function licenceState(expiry) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(expiry))) return "unknown";
  const now = Date.now() + 6 * 3_600_000;
  const today = new Date(now).toISOString().slice(0, 10);
  if (expiry < today) return "expired";
  const warning = new Date(now + LICENCE_WARN_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return expiry <= warning ? "expiring" : "valid";
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
    previousRejectionReason: p.previous_rejection_reason ?? null,
    locationSource: p.location_source ?? "area",
    submittedAt: p.submitted_at ?? p.created_at,
    reviewedAt: p.reviewed_at ?? null,
    reviewedBy: p.reviewer?.full_name ?? null,
  };
}

export function normalizeLicence(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

export async function getPharmacyCounts() {
  await requireRole("admin");
  const supabase = await createClient();
  const results = await Promise.all(
    STATUSES.map((status) =>
      supabase
        .from("pharmacies")
        .select("id", { count: "exact", head: true })
        .eq("status", status),
    ),
  );
  if (results.some((result) => result.error)) throw new Error(DATA_ERROR);
  return Object.fromEntries(
    STATUSES.map((status, index) => [status, results[index].count ?? 0]),
  );
}

export async function listPharmacies({ status, q = "" }) {
  await requireRole("admin");
  if (!STATUSES.includes(status)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pharmacies")
    .select(
      "id,name,address,area,phone,licence_number,licence_expiry,latitude,longitude,status,rejection_reason,previous_rejection_reason,location_source,submitted_at,reviewed_at,reviewed_by,created_at",
    )
    .eq("status", status)
    .order("submitted_at", { ascending: status === "pending" });
  if (error) throw new Error(DATA_ERROR);
  const term = q.trim().toLowerCase();
  return data
    .map(toRow)
    .filter(
      (row) =>
        !term ||
        [row.name, row.areaName, row.licenceNumber].some((value) =>
          value.toLowerCase().includes(term),
        ),
    );
}

export const getPharmacy = cache(async function getPharmacy(id) {
  await requireRole("admin");
  if (!validId(id)) return null;
  const supabase = await createClient();
  const { data: p, error } = await supabase
    .from("pharmacies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(DATA_ERROR);
  if (!p) return null;
  const { data: duplicates, error: duplicateError } = await supabase.rpc(
    "duplicate_licence_pharmacies",
    { p_licence_number: p.licence_number },
  );
  if (duplicateError) throw new Error(DATA_ERROR);
  let reviewer = null;
  if (p.reviewed_by) {
    const result = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", p.reviewed_by)
      .maybeSingle();
    if (result.error) throw new Error(DATA_ERROR);
    reviewer = result.data?.full_name ?? null;
  }
  const { data: signed, error: photoError } = await supabase.storage
    .from("licences")
    .createSignedUrl(p.licence_photo_url, 300);
  if (photoError) throw new Error(DATA_ERROR);
  return {
    ...toRow({ ...p, reviewer: { full_name: reviewer } }),
    duplicates: (duplicates ?? []).filter((other) => other.id !== id),
    licencePhotoUrl: signed.signedUrl,
  };
});

async function decide(id, functionName, reason) {
  await requireRole("admin");
  if (!validId(id)) return { ok: false, error: "Pharmacy not found." };
  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("pharmacies")
    .select("name,status")
    .eq("id", id)
    .maybeSingle();
  const args = { p_pharmacy_id: id };
  if (reason !== undefined) args.p_reason = reason;
  const { error } = await supabase.rpc(functionName, args);
  if (error) {
    console.error("Admin pharmacy decision failed", {
      functionName,
      code: error.code,
    });
    return { ok: false, error: DECISION_ERROR };
  }
  const event = {
    approve_pharmacy: "approved",
    reject_pharmacy: "rejected",
    suspend_pharmacy: "suspended",
  }[functionName];
  const to = await ownerEmailForShop(id);
  await sendPharmacyMail({
    to,
    shop: shop?.name ?? "Your pharmacy",
    event,
    reason,
  });
  return { ok: true };
}
export const approvePharmacy = (id) => decide(id, "approve_pharmacy");
export const rejectPharmacy = (id, reason) =>
  decide(id, "reject_pharmacy", reason);
export const suspendPharmacy = (id, reason) =>
  decide(id, "suspend_pharmacy", reason);

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
  await requireRole("admin");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medicines")
    .select(
      "id,brand_name,generic_name,manufacturer,strength,form,prescription_only,pharmacy_stock(pharmacy_id)",
    )
    .order("brand_name");
  if (error) throw new Error(DATA_ERROR);
  return data.map((m) => ({
    ...toMedicine(m),
    stockCount: m.pharmacy_stock?.length ?? 0,
  }));
}

function medicineValues(fields) {
  return {
    brand_name: fields.brandName,
    generic_name: fields.genericName,
    manufacturer: fields.manufacturer,
    strength: fields.strength,
    form: fields.form,
    prescription_only: fields.prescriptionOnly,
  };
}
export async function addMedicine(fields) {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase
    .from("medicines")
    .insert(medicineValues(fields));
  if (error?.code === "23505")
    return {
      ok: false,
      error:
        "This medicine (brand, strength and form) is already in the catalog.",
    };
  if (error)
    return {
      ok: false,
      error: "Could not add the medicine. Please try again.",
    };
  return { ok: true };
}
export async function updateMedicine(id, fields) {
  await requireRole("admin");
  if (!validId(id)) return { ok: false, error: "Medicine not found." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medicines")
    .update(medicineValues(fields))
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error?.code === "23505")
    return {
      ok: false,
      error: "Another catalog entry already has this brand, strength and form.",
    };
  if (error)
    return {
      ok: false,
      error: "Could not update the medicine. Please try again.",
    };
  if (!data) return { ok: false, error: "Medicine not found." };
  return { ok: true };
}
export async function medicineUsage(id) {
  await requireRole("admin");
  if (!validId(id)) return 0;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("medicine_stock_usage", {
    p_medicine_id: id,
  });
  if (error) throw new Error(DATA_ERROR);
  return data;
}
