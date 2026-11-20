// W1 browser checks not covered by verify-w1-browser: neutral auth messages,
// reject → correct and resubmit (D7), suspend with an active reservation
// (D18), 375 px layouts of pharmacy and admin pages, and sign out.
// Run against `next start -p 3102` with W1D_TEST_REMOTE=gkzqlpaknytdvbbknaxp,
// SUPABASE_SECRET_KEY and DEMO_ADMIN_EMAIL/PASSWORD in .env.local.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const ref = "gkzqlpaknytdvbbknaxp";
assert.equal(
  process.env.W1D_TEST_REMOTE,
  ref,
  "Explicit demo project target required",
);
const env = Object.fromEntries(
  (await fs.readFile(".env.local", "utf8"))
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^"|"$/g, "")]),
);
const secret = process.env.B1_SERVICE_KEY || env.SUPABASE_SECRET_KEY;
assert.ok(env.NEXT_PUBLIC_SUPABASE_URL.includes(ref) && secret);
assert.ok(env.DEMO_ADMIN_EMAIL && env.DEMO_ADMIN_PASSWORD);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, secret, opts);
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    opts,
  );

const run = crypto.randomBytes(5).toString("hex");
const password = `W1D-demo-${run}!`;
// APP_URL runs the same checks against the live site.
const base = process.env.APP_URL || "http://localhost:3102";
const reason = `W1D check ${run}: the licence photo is blurry, upload a clearer one.`;
const users = [];
const shops = [];
let medicineId;
let browser;
const pass = (label) => console.log(`PASS ${label}`);
const png = await fs.readFile("supabase/seed-assets/demo-licence.png");

async function makeUser(label, type) {
  const email = `w1d-${run}-${label}@medkothay.test`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      account_type: type,
      full_name: `W1D ${label} ${run}`,
      phone: "01700000996",
    },
  });
  if (created.error) throw created.error;
  users.push(created.data.user.id);
  const api = client();
  assert.equal(
    (await api.auth.signInWithPassword({ email, password })).error,
    null,
  );
  return { id: created.data.user.id, email, api };
}
const shopRow = async (id) =>
  (
    await service
      .from("pharmacies")
      .select(
        "name,status,rejection_reason,previous_rejection_reason,licence_photo_url",
      )
      .eq("id", id)
      .single()
  ).data;
async function signIn(page, email, pw = password) {
  await page.goto(`${base}/sign-in`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function until(check, label, page) {
  for (let i = 0; i < 40; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (page)
    console.error(
      `${label} screen:`,
      (await page.locator("main").innerText()).slice(-1500),
    );
  throw new Error(`Timed out: ${label}`);
}
async function fits(page, path) {
  await page.goto(`${base}${path}`);
  await page.locator("main h1").first().waitFor({ timeout: 20000 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${path} scrolls sideways at 375px`,
  );
}

try {
  const owner = await makeUser("owner", "pharmacy");
  const customer = await makeUser("customer", "customer");
  const firstPhoto = `${owner.id}/w1d-${run}.png`;
  assert.equal(
    (
      await owner.api.storage
        .from("licences")
        .upload(firstPhoto, png, { contentType: "image/png" })
    ).error,
    null,
  );
  const reg = await owner.api.rpc("register_pharmacy", {
    p_name: `W1D Pharmacy ${run}`,
    p_address: "Road 27, Dhanmondi, Dhaka",
    p_area: "dhanmondi",
    p_latitude: 23.7461,
    p_longitude: 90.3742,
    p_phone: "01700000885",
    p_licence_number: `W1D-${run}`,
    p_licence_photo_url: firstPhoto,
    p_licence_expiry: "2027-12-31",
    p_location_source: "area",
  });
  assert.equal(reg.error, null);
  const shopId = reg.data;
  shops.push(shopId);

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const phone = { viewport: { width: 375, height: 800 } };

  // Neutral auth messages (D5): never reveal account type or Supabase text.
  const anonCtx = await browser.newContext(phone);
  const anon = await anonCtx.newPage();
  await signIn(anon, owner.email, "wrong-password-123");
  await anon.getByText("Email or password is incorrect.").waitFor();
  await anon.goto(`${base}/sign-in?mode=signup&as=customer`);
  await anon.getByLabel("Full name").fill("W1D Duplicate");
  await anon.getByLabel("Email address").fill(owner.email);
  await anon.getByLabel("Password", { exact: true }).fill(password);
  await anon.getByLabel("Mobile number").fill("01700000995");
  await anon.getByRole("button", { name: "Create account" }).click();
  await anon
    .getByText("An account with this email already exists.", { exact: false })
    .waitFor();
  await anonCtx.close();
  pass("wrong password and taken email show only the neutral messages");

  // Admin rejects at 375 px.
  const adminCtx = await browser.newContext(phone);
  const admin = await adminCtx.newPage();
  await signIn(admin, env.DEMO_ADMIN_EMAIL, env.DEMO_ADMIN_PASSWORD);
  await admin.waitForURL("**/admin");
  await admin.getByText(`W1D Pharmacy ${run}`).first().waitFor();
  await fits(admin, `/admin/pharmacies/${shopId}`);
  await admin.getByRole("button", { name: /^Reject/ }).click();
  await admin.getByLabel("Reason for the owner").fill(reason);
  await admin.getByRole("button", { name: "Reject with this reason" }).click();
  await until(
    async () => (await shopRow(shopId)).status === "rejected",
    "reject",
    admin,
  );
  assert.equal((await shopRow(shopId)).rejection_reason, reason);
  pass("admin rejects with a reason at 375px");

  // Owner sees the reason, corrects and resubmits the same shop (D7).
  const ownerCtx = await browser.newContext(phone);
  const own = await ownerCtx.newPage();
  await signIn(own, owner.email);
  await own.waitForURL("**/pharmacy");
  await own.getByText("Registration not approved").waitFor();
  await own.getByText(reason).waitFor();
  await own.getByRole("link", { name: /Correct and resubmit/ }).click();
  await own.waitForURL("**/pharmacy/register");
  assert.equal(
    await own.getByLabel("Shop name").inputValue(),
    `W1D Pharmacy ${run}`,
  );
  await own.getByLabel("Shop name").fill(`W1D Pharmacy Fixed ${run}`);
  await own
    .getByLabel("Licence photo")
    .setInputFiles("supabase/seed-assets/demo-licence.png");
  await own.getByRole("button", { name: "Submit again for review" }).click();
  await own.waitForURL("**/pharmacy", { timeout: 30000 });
  await own.getByText("Waiting for approval", { exact: false }).waitFor();
  const resubmitted = await shopRow(shopId);
  assert.equal(resubmitted.status, "pending");
  assert.equal(resubmitted.name, `W1D Pharmacy Fixed ${run}`);
  assert.equal(resubmitted.rejection_reason, null);
  assert.equal(resubmitted.previous_rejection_reason, reason);
  assert.notEqual(resubmitted.licence_photo_url, firstPhoto);
  assert.ok(
    (await service.storage.from("licences").download(firstPhoto)).error,
    "replaced photo is removed",
  );
  pass(
    "owner sees the reason, resubmits the same shop; reason kept, old photo removed",
  );

  // Approve (browser-tested in verify-w1-browser), stock, and a customer hold.
  const adminApi = client();
  await adminApi.auth.signInWithPassword({
    email: env.DEMO_ADMIN_EMAIL,
    password: env.DEMO_ADMIN_PASSWORD,
  });
  assert.equal(
    (await adminApi.rpc("approve_pharmacy", { p_pharmacy_id: shopId })).error,
    null,
  );
  const med = await service
    .from("medicines")
    .insert({
      brand_name: `W1DTest${run}`,
      generic_name: "W1D compound",
      manufacturer: "W1D Test Labs",
      strength: "5mg",
      form: "tablet",
      prescription_only: false,
    })
    .select("id")
    .single();
  medicineId = med.data.id;
  assert.equal(
    (
      await owner.api.rpc("set_stock", {
        p_medicine_id: medicineId,
        p_quantity: 4,
        p_selling_price: 9,
        p_expiry_date: "2027-12-31",
      })
    ).error,
    null,
  );
  const hold = await customer.api.rpc("reserve", {
    p_pharmacy_id: shopId,
    p_items: [
      { medicine_id: medicineId, quantity: 2, expected_unit_price: 9 },
    ],
    p_request_id: crypto.randomUUID(),
  });
  assert.equal(hold.data?.status, "reserved");

  // Pharmacy pages fit at 375 px while the shop is live.
  for (const path of [
    "/pharmacy",
    "/pharmacy/inventory",
    "/pharmacy/counter",
    "/pharmacy/reservations",
  ])
    await fits(own, path);
  pass("pharmacy dashboard, inventory, counter and reservations fit at 375px");

  // Admin suspends: hold released, reservation cancelled, shop leaves search.
  await admin.goto(`${base}/admin/pharmacies/${shopId}`);
  await admin.getByRole("button", { name: "Suspend…" }).click();
  await admin
    .getByLabel("Reason for the owner")
    .fill(`W1D check ${run}: licence number belongs to another shop.`);
  await admin.getByRole("button", { name: "Suspend pharmacy" }).click();
  await until(
    async () => (await shopRow(shopId)).status === "suspended",
    "suspend",
    admin,
  );
  const cancelled = await service
    .from("reservations")
    .select("status,cancellation_reason")
    .eq("id", hold.data.reservationId)
    .single();
  assert.deepEqual(cancelled.data, {
    status: "cancelled",
    cancellation_reason: "pharmacy_unavailable",
  });
  const stock = await service
    .from("pharmacy_stock")
    .select("quantity,held_quantity")
    .eq("pharmacy_id", shopId)
    .eq("medicine_id", medicineId)
    .single();
  assert.deepEqual(stock.data, { quantity: 4, held_quantity: 0 });
  const found = await client().rpc("search_medicine", {
    q: `W1DTest${run}`,
    lat: 23.7461,
    lng: 90.3742,
  });
  assert.equal(found.data.withinRadius.length, 0);
  await own.goto(`${base}/pharmacy`);
  await own.getByText("Your pharmacy is suspended").waitFor();
  pass(
    "suspend cancels the reservation, releases the hold, leaves search; owner sees the banner",
  );

  for (const path of ["/admin", "/admin/catalog"]) await fits(admin, path);
  pass("admin list, review and catalog fit at 375px");

  // Sign out ends the session: protected pages send you to sign in.
  await own.getByRole("button", { name: "Sign out" }).click();
  await own.waitForURL((u) => !u.pathname.startsWith("/pharmacy"));
  await own.goto(`${base}/pharmacy`);
  await own.waitForURL("**/sign-in");
  pass("sign out ends the session");
} finally {
  if (browser) await browser.close();
  for (const shop of shops) {
    const res = await service
      .from("reservations")
      .select("id")
      .eq("pharmacy_id", shop);
    for (const row of res.data || [])
      await service
        .from("reservation_items")
        .delete()
        .eq("reservation_id", row.id);
    await service.from("reservations").delete().eq("pharmacy_id", shop);
    await service.from("pharmacy_stock").delete().eq("pharmacy_id", shop);
  }
  for (const id of users)
    await service.from("profiles").update({ pharmacy_id: null }).eq("id", id);
  for (const shop of shops) {
    const row = await shopRow(shop);
    await service.from("pharmacies").delete().eq("id", shop);
    if (row?.licence_photo_url)
      await service.storage.from("licences").remove([row.licence_photo_url]);
  }
  for (const id of users) {
    await service.storage.from("licences").remove([`${id}/w1d-${run}.png`]);
    await service.auth.admin.deleteUser(id);
  }
  if (medicineId) await service.from("medicines").delete().eq("id", medicineId);
}
