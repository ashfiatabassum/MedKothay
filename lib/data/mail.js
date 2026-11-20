import "server-only";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";

// Plain-text messages avoid inserting owner-controlled or reviewer-controlled
// content into HTML. Mail is best effort; the database status is authoritative.
export async function sendPharmacyMail({ to, shop, event, reason }) {
  if (!to || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.info("Pharmacy email not configured");
    return false;
  }
  const content = {
    received: [
      "Registration received",
      `We received the registration for ${shop}. An admin will review it. Check your MedKothay dashboard for the current status.`,
    ],
    approved: [
      "Pharmacy approved",
      `${shop} has been approved. It can now appear in MedKothay search while its licence is valid.`,
    ],
    rejected: [
      "Registration not approved",
      `${shop} was not approved. Reason: ${reason}\n\nCorrect the details and resubmit from your MedKothay dashboard.`,
    ],
    suspended: [
      "Pharmacy suspended",
      `${shop} has been suspended. Reason: ${reason}\n\nCheck your dashboard to correct and resubmit.`,
    ],
  }[event];
  if (!content) return false;
  try {
    // Short timeouts: the decision is already saved, so a slow mail server
    // must not keep the admin or owner waiting (code review, 20 Nov).
    const transport = nodemailer.createTransport({
      service: "gmail",
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    await transport.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject: `MedKothay: ${content[0]}`,
      text: content[1],
    });
    return true;
  } catch (error) {
    console.error("Pharmacy email failed", { code: error.code ?? "unknown" });
    return false;
  }
}

export async function ownerEmailForShop(shopId) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pharmacy_owner_email", {
    p_pharmacy_id: shopId,
  });
  if (error) {
    console.error("Owner email lookup failed", { code: error.code });
    return null;
  }
  return data;
}
