"use server";

// Admin server actions. Each re-checks the admin role: layouts do not run again
// when a form posts to an action. All input is validated here.
import { getCurrentUser } from "@/lib/data/session";
import {
  FORMS,
  addMedicine,
  approvePharmacy,
  medicineUsage,
  rejectPharmacy,
  suspendPharmacy,
  updateMedicine,
} from "@/lib/data/admin";

// Trimmed, with runs of spaces collapsed to one.
const text = (fd, name) =>
  String(fd.get(name) ?? "")
    .trim()
    .replace(/\s+/g, " ");
const NOT_ADMIN = "Only an admin can do this.";

async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

// ---------- Pharmacy review ----------

export async function approveAction(_prev, fd) {
  if (!(await isAdmin())) return { status: "error", message: NOT_ADMIN };
  const id = text(fd, "pharmacyId").slice(0, 64);
  const r = await approvePharmacy(id);
  return r.ok ? { status: "approved" } : { status: "error", message: r.error };
}

export async function rejectAction(_prev, fd) {
  if (!(await isAdmin())) return { status: "error", message: NOT_ADMIN };
  const id = text(fd, "pharmacyId").slice(0, 64);
  const reason = text(fd, "reason");
  if (reason.length < 10 || reason.length > 300) {
    return {
      status: "error",
      fieldErrors: {
        reason:
          "Write a reason the owner can act on (10 to 300 characters), e.g. which detail is wrong.",
      },
      values: { reason },
    };
  }
  const r = await rejectPharmacy(id, reason);
  return r.ok
    ? { status: "rejected" }
    : { status: "error", message: r.error, values: { reason } };
}

/** D18: suspend an approved shop with a reason the owner will see. */
export async function suspendAction(_prev, fd) {
  if (!(await isAdmin())) return { status: "error", message: NOT_ADMIN };
  const id = text(fd, "pharmacyId").slice(0, 64);
  const reason = text(fd, "reason");
  if (reason.length < 10 || reason.length > 300) {
    return {
      status: "error",
      fieldErrors: {
        reason:
          "Write the reason for the owner (10 to 300 characters), e.g. what was found.",
      },
      values: { reason },
    };
  }
  const r = await suspendPharmacy(id, reason);
  return r.ok
    ? { status: "suspended" }
    : { status: "error", message: r.error, values: { reason } };
}

// ---------- Medicine catalog ----------

function readMedicine(fd) {
  const v = {
    brandName: text(fd, "brandName"),
    genericName: text(fd, "genericName"),
    manufacturer: text(fd, "manufacturer"),
    strength: text(fd, "strength"),
    form: text(fd, "form"),
    prescriptionOnly: fd.get("prescriptionOnly") === "on",
  };
  const e = {};
  const len = (s, min, max) => s.length >= min && s.length <= max;
  if (!len(v.brandName, 2, 60))
    e.brandName = "Enter the brand name (2 to 60 characters).";
  if (!len(v.genericName, 2, 120))
    e.genericName = "Enter the generic name (2 to 120 characters).";
  if (!len(v.manufacturer, 2, 60))
    e.manufacturer = "Enter the manufacturer (2 to 60 characters).";
  if (!len(v.strength, 1, 40))
    e.strength = "Enter the strength, e.g. 500mg or 120mg/5ml.";
  if (!FORMS.includes(v.form)) e.form = "Choose the form.";
  return { v, e };
}

export async function addMedicineAction(_prev, fd) {
  if (!(await isAdmin())) return { status: "error", formError: NOT_ADMIN };
  const { v, e } = readMedicine(fd);
  if (Object.keys(e).length)
    return { status: "error", fieldErrors: e, values: v };
  const r = await addMedicine(v);
  return r.ok
    ? { status: "saved", name: `${v.brandName} ${v.strength}` }
    : { status: "error", formError: r.error, values: v };
}

export async function updateMedicineAction(_prev, fd) {
  if (!(await isAdmin())) return { status: "error", formError: NOT_ADMIN };
  const id = text(fd, "medicineId").slice(0, 64);
  const { v, e } = readMedicine(fd);
  if (Object.keys(e).length)
    return { status: "error", fieldErrors: e, values: v };
  // D20: a medicine stocked by pharmacies changes for all of them; the admin
  // must confirm that explicitly.
  const usedBy = await medicineUsage(id);
  if (usedBy > 0 && fd.get("confirmShared") !== "on") {
    return {
      status: "error",
      fieldErrors: {
        confirmShared: `Tick the box to confirm: this changes the medicine for all ${usedBy} pharmacies that stock it.`,
      },
      values: v,
    };
  }
  const r = await updateMedicine(id, v);
  return r.ok
    ? { status: "saved", values: v }
    : { status: "error", formError: r.error, values: v };
}
