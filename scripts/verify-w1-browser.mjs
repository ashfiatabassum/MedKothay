// Run against a local production build on port 3102 with B1_SERVICE_KEY and
// W1_TEST_REMOTE set. Creates and removes only uniquely prefixed fixtures.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const ref = "gkzqlpaknytdvbbknaxp";
assert.equal(
  process.env.W1_TEST_REMOTE,
  ref,
  "Explicit demo project target required",
);
assert.ok(
  process.env.B1_SERVICE_KEY,
  "Service key required for fixture cleanup",
);
const env = Object.fromEntries(
  (await fs.readFile(".env.local", "utf8"))
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^"|"$/g, "")]),
);
assert.ok(env.NEXT_PUBLIC_SUPABASE_URL.includes(ref));
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.B1_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const run = crypto.randomBytes(5).toString("hex");
const adminEmail = `w1-${run}-admin@medkothay.test`;
const ownerEmail = `medkothay.w1.${run}@gmail.com`;
const password = `W1-demo-${run}!`;
const medName = `W1 Test ${run}`;
const licence = `W1-${run}`;
let adminId, ownerId, shopId, medicineId;
let browser;
// APP_URL runs the same checks against the live site.
const base = process.env.APP_URL || "http://localhost:3102";
const pass = (label) => console.log(`PASS ${label}`);
async function context(width) {
  const c = await browser.newContext({ viewport: { width, height: 900 } });
  return { c, page: await c.newPage() };
}
async function noOverflow(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
}
try {
  const created = await service.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: {
      account_type: "customer",
      full_name: "W1 Test Admin",
      phone: "01700000999",
    },
  });
  if (created.error) throw created.error;
  adminId = created.data.user.id;
  const elevated = await service
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", adminId);
  if (elevated.error) throw elevated.error;

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const owner = await context(375);
  await owner.page.goto(`${base}/sign-in?mode=signup&as=pharmacy`);
  await owner.page.getByLabel("Owner's full name").fill("W1 Test Owner");
  await owner.page.getByLabel("Email address").fill(ownerEmail);
  await owner.page.getByLabel("Password", { exact: true }).fill(password);
  await owner.page.getByLabel("Your mobile number").fill("01700000998");
  await owner.page.getByRole("button", { name: "Create account" }).click();
  await owner.page.waitForURL("**/pharmacy/register", { timeout: 20000 });
  const ownerAuth = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  ownerId = ownerAuth.data.users.find((u) => u.email === ownerEmail)?.id;
  assert.ok(ownerId);
  pass("owner signup starts a real session and continues to step 2");

  await owner.page.getByLabel("Shop name").fill(`W1 Test Pharmacy ${run}`);
  await owner.page.getByLabel("Address").fill("Road 27, Dhanmondi, Dhaka");
  await owner.page
    .getByLabel("Area", { exact: true })
    .selectOption("dhanmondi");
  await owner.page.getByLabel("Shop mobile number").fill("01700000888");
  await owner.page.getByLabel("Licence number").fill(licence);
  await owner.page.getByLabel("Licence expiry date").fill("2027-12-31");
  await owner.page
    .getByLabel("Licence photo")
    .setInputFiles("supabase/seed-assets/demo-licence.png");
  await owner.page.getByRole("button", { name: "Submit for review" }).click();
  await owner.page.waitForURL("**/pharmacy", { timeout: 30000 });
  await owner.page
    .getByText("Waiting for approval", { exact: false })
    .waitFor();
  const profile = await service
    .from("profiles")
    .select("pharmacy_id")
    .eq("id", ownerId)
    .single();
  shopId = profile.data?.pharmacy_id;
  assert.ok(shopId);
  const shop = await service
    .from("pharmacies")
    .select("status,licence_photo_url")
    .eq("id", shopId)
    .single();
  assert.equal(shop.data.status, "pending");
  const ownerClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const ownerLogin = await ownerClient.auth.signInWithPassword({
    email: ownerEmail,
    password,
  });
  assert.equal(ownerLogin.error, null);
  const unusedPath = `${ownerId}/w1-unused-${run}.png`;
  const photoBytes = await fs.readFile("supabase/seed-assets/demo-licence.png");
  const unusedUpload = await ownerClient.storage
    .from("licences")
    .upload(unusedPath, photoBytes, { contentType: "image/png" });
  assert.equal(unusedUpload.error, null);
  const unusedRemoval = await ownerClient.storage
    .from("licences")
    .remove([unusedPath]);
  assert.equal(unusedRemoval.error, null);
  const removed = await service.storage.from("licences").download(unusedPath);
  assert.ok(removed.error);
  const referencedRemoval = await ownerClient.storage
    .from("licences")
    .remove([shop.data.licence_photo_url]);
  const stillThere = await service.storage
    .from("licences")
    .download(shop.data.licence_photo_url);
  assert.equal(stillThere.error, null);
  assert.ok(referencedRemoval.error || referencedRemoval.data?.length === 0);
  pass("owner can clean unused upload but not the referenced licence");
  await noOverflow(owner.page);
  pass("owner registration persists pending shop and private image at 375px");

  await owner.page.goto(`${base}/admin`);
  await owner.page.waitForURL("**/sign-in");
  pass("pharmacist cannot open admin");

  const admin = await context(1280);
  await admin.page.goto(`${base}/sign-in`);
  await admin.page.getByLabel("Email address").fill(adminEmail);
  await admin.page.getByLabel("Password", { exact: true }).fill(password);
  await admin.page
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await admin.page.waitForURL("**/admin");
  await admin.page.goto(`${base}/admin/pharmacies/${shopId}`);
  await admin.page
    .getByAltText(`Licence submitted by W1 Test Pharmacy ${run}`)
    .waitFor();
  const adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  assert.equal(
    (await adminClient.auth.signInWithPassword({ email: adminEmail, password }))
      .error,
    null,
  );
  const emailLookup = await adminClient.rpc("pharmacy_owner_email", {
    p_pharmacy_id: shopId,
  });
  assert.equal(emailLookup.data, ownerEmail);
  assert.ok(
    (await ownerClient.rpc("pharmacy_owner_email", { p_pharmacy_id: shopId }))
      .error,
  );
  await noOverflow(admin.page);
  pass("admin reads real shop and signed private image at 1280px");

  await admin.page.getByRole("button", { name: /Approve…/ }).click();
  await admin.page.getByRole("button", { name: "Yes, approve" }).click();
  let status;
  for (let attempt = 0; attempt < 30; attempt++) {
    const approved = await service
      .from("pharmacies")
      .select("status")
      .eq("id", shopId)
      .single();
    status = approved.data?.status;
    if (status === "approved") break;
    await admin.page.waitForTimeout(500);
  }
  if (status !== "approved")
    console.error(
      "Admin decision screen:",
      (await admin.page.locator("main").innerText()).slice(-1500),
    );
  assert.equal(status, "approved");
  pass("admin approval persists");

  await admin.page.goto(`${base}/admin/catalog`);
  await admin.page.getByRole("button", { name: "Add medicine" }).click();
  await admin.page.locator('input[name="brandName"]').last().fill(medName);
  await admin.page
    .locator('input[name="genericName"]')
    .last()
    .fill("Test compound");
  await admin.page
    .locator('input[name="manufacturer"]')
    .last()
    .fill("W1 Test Labs");
  await admin.page.locator('input[name="strength"]').last().fill("10mg");
  await admin.page.locator('select[name="form"]').last().selectOption("tablet");
  await admin.page.getByRole("button", { name: "Add to catalog" }).click();
  for (let attempt = 0; attempt < 30; attempt++) {
    const added = await service
      .from("medicines")
      .select("id")
      .eq("brand_name", medName)
      .maybeSingle();
    medicineId = added.data?.id;
    if (medicineId) break;
    await admin.page.waitForTimeout(500);
  }
  if (!medicineId)
    console.error(
      "Catalog screen:",
      (await admin.page.locator("main").innerText()).slice(-1500),
    );
  assert.ok(medicineId);
  pass("catalogue add persists");
  await admin.c.close();
  await owner.c.close();
} finally {
  if (browser) await browser.close();
  if (!medicineId) {
    const created = await service
      .from("medicines")
      .select("id")
      .eq("brand_name", medName)
      .maybeSingle();
    medicineId = created.data?.id ?? null;
  }
  if (!shopId && ownerId) {
    const linked = await service
      .from("profiles")
      .select("pharmacy_id")
      .eq("id", ownerId)
      .maybeSingle();
    shopId = linked.data?.pharmacy_id ?? null;
  }
  if (medicineId) await service.from("medicines").delete().eq("id", medicineId);
  if (shopId) {
    const shop = await service
      .from("pharmacies")
      .select("licence_photo_url")
      .eq("id", shopId)
      .single();
    if (ownerId)
      await service
        .from("profiles")
        .update({ pharmacy_id: null })
        .eq("id", ownerId);
    await service.from("pharmacies").delete().eq("id", shopId);
    if (shop.data?.licence_photo_url)
      await service.storage
        .from("licences")
        .remove([shop.data.licence_photo_url]);
  }
  if (ownerId) await service.auth.admin.deleteUser(ownerId);
  if (adminId) await service.auth.admin.deleteUser(adminId);
}
