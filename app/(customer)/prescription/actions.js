"use server";

// Read a prescription photo (S1). Customers only: pharmacy and admin accounts
// cannot reserve, and each read is a paid API call with a daily limit.
import { getCurrentUser } from "@/lib/data/session";
import {
  checkPrescriptionPhoto,
  readPrescription,
} from "@/lib/data/prescription";

export async function readPrescriptionAction(_prev, fd) {
  const user = await getCurrentUser();
  if (!user)
    return { status: "error", message: "Sign in to read a prescription." };
  if (user.role !== "customer")
    return {
      status: "error",
      message: "Prescription reading is for customer accounts.",
    };
  const photo = fd.get("prescription");
  const check = await checkPrescriptionPhoto(photo);
  if (check.error) return { status: "error", message: check.error };
  const r = await readPrescription(photo, check.mime);
  return r.ok
    ? { status: "read", medicines: r.medicines, remaining: r.remaining }
    : { status: "error", message: r.error };
}
