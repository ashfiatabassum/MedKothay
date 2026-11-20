// W2 + W3 browser checks: demo loop steps 3–7 on a local production build.
// Run against `next start -p 3102` with B1_SERVICE_KEY (or SUPABASE_SECRET_KEY
// in .env.local), DEMO_ADMIN_EMAIL/PASSWORD in .env.local and
// W23_TEST_REMOTE=gkzqlpaknytdvbbknaxp. Creates and removes only fixtures
// with this run's unique prefix.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const ref = "gkzqlpaknytdvbbknaxp";
assert.equal(
  process.env.W23_TEST_REMOTE,
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
assert.ok(
  env.DEMO_ADMIN_EMAIL && env.DEMO_ADMIN_PASSWORD,
  "Demo admin required",
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, secret, opts);
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    opts,
  );

const run = crypto.randomBytes(5).toString("hex");
const password = `W23-demo-${run}!`;
const medName = `W23Test${run}`;
const customerName = `W23 Customer ${run}`;
const base = "http://localhost:3102";
const users = [];
const shops = [];
let medicineId;
let browser;
const pass = (label) => console.log(`PASS ${label}`);
const png = await fs.readFile("supabase/seed-assets/demo-licence.png");

async function makeUser(label, type, fullName = `W23 ${label} ${run}`) {
  const email = `w23-${run}-${label}@medkothay.test`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      account_type: type,
      full_name: fullName,
      phone: "01700000997",
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
async function registerShop(owner, label) {
  const path = `${owner.id}/w23-${run}.png`;
  const up = await owner.api.storage
    .from("licences")
    .upload(path, png, { contentType: "image/png" });
  assert.equal(up.error, null);
  const { data, error } = await owner.api.rpc("register_pharmacy", {
    p_name: `W23 Pharmacy ${label} ${run}`,
    p_address: "Road 27, Dhanmondi, Dhaka",
    p_area: "dhanmondi",
    p_latitude: 23.7461,
    p_longitude: 90.3742,
    p_phone: "01700000886",
    p_licence_number: `W23-${run}-${label}`,
    p_licence_photo_url: path,
    p_licence_expiry: "2027-12-31",
    p_location_source: "area",
  });
  assert.equal(error, null);
  shops.push(data);
  return { id: data, name: `W23 Pharmacy ${label} ${run}`, path };
}
async function signIn(page, email) {
  await page.goto(`${base}/sign-in`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function stockRow(shopId) {
  const { data } = await service
    .from("pharmacy_stock")
    .select("quantity,held_quantity")
    .eq("pharmacy_id", shopId)
    .eq("medicine_id", medicineId)
    .maybeSingle();
  return data;
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
async function noOverflow(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "no horizontal scroll",
  );
}

try {
  // Fixtures: a test-only medicine, an approved shop A, a pending shop B and
  // a customer. Approval goes through approve_pharmacy as the demo admin.
  const med = await service
    .from("medicines")
    .insert({
      brand_name: medName,
      generic_name: "W23 compound",
      manufacturer: "W23 Test Labs",
      strength: "10mg",
      form: "tablet",
      prescription_only: false,
    })
    .select("id")
    .single();
  assert.equal(med.error, null);
  medicineId = med.data.id;
  const ownerA = await makeUser("ownerA", "pharmacy");
  const ownerB = await makeUser("ownerB", "pharmacy");
  const customer = await makeUser("customer", "customer", customerName);
  const shopA = await registerShop(ownerA, "A");
  await registerShop(ownerB, "B");
  const admin = client();
  assert.equal(
    (
      await admin.auth.signInWithPassword({
        email: env.DEMO_ADMIN_EMAIL,
        password: env.DEMO_ADMIN_PASSWORD,
      })
    ).error,
    null,
  );
  assert.equal(
    (await admin.rpc("approve_pharmacy", { p_pharmacy_id: shopA.id })).error,
    null,
  );

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const ownerCtx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const owner = await ownerCtx.newPage();
  const custCtx = await browser.newContext({
    viewport: { width: 375, height: 800 },
  });
  const cust = await custCtx.newPage();

  // Step 3: the pharmacy adds stock.
  await signIn(owner, ownerA.email);
  await owner.waitForURL("**/pharmacy");
  await owner.goto(`${base}/pharmacy/inventory`);
  await owner.getByRole("button", { name: "Add medicine" }).click();
  const add = owner.locator('section[aria-labelledby="add-heading"]');
  const option = add.locator('select[name="medicineId"] option', {
    hasText: medName,
  });
  await add
    .locator('select[name="medicineId"]')
    .selectOption(await option.getAttribute("value"));
  await add.locator('input[name="quantity"]').fill("3");
  await add.locator('input[name="sellingPrice"]').fill("15");
  await add.locator('input[name="expiryDate"]').fill("2027-12-31");
  await add.getByRole("button", { name: "Add to stock" }).click();
  await until(
    async () => (await stockRow(shopA.id))?.quantity === 3,
    "add stock",
    owner,
  );
  await owner.getByText(medName).first().waitFor();
  pass("step 3: pharmacist adds stock through save_stock and sees it listed");

  // Step 4: customer searches and sees the shop with a band, not a number.
  await signIn(cust, customer.email);
  await cust.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
  await cust.goto(`${base}/search?q=${medName}&area=dhanmondi`);
  await cust.getByText(shopA.name).first().waitFor();
  const resultText = await cust.locator("main").innerText();
  assert.match(resultText, /Low stock/);
  assert.ok(
    !/\b3 (left|available|in stock)\b/i.test(resultText),
    "no exact quantity",
  );
  await noOverflow(cust);
  pass("step 4: search finds the approved shop with a stock band at 375px");

  // Step 5: reserve one unit, get a pickup code.
  await cust
    .getByRole("button", {
      name: `Add ${medName} 10mg from ${shopA.name} to basket`,
    })
    .click();
  await cust.goto(`${base}/basket`);
  await cust.getByRole("button", { name: /Reserve for 30 minutes/ }).click();
  await cust
    .getByText("Reserved. Your pickup code is ready.")
    .waitFor({ timeout: 20000 });
  const codeLabel = await cust
    .locator('[aria-label^="Pickup code "]')
    .first()
    .getAttribute("aria-label");
  const code = codeLabel.replace(/\D/g, "");
  assert.match(code, /^\d{6}$/);
  assert.deepEqual(await stockRow(shopA.id), { quantity: 3, held_quantity: 1 });
  await noOverflow(cust);
  pass(
    "step 5: customer reserves, gets a 6-digit code; held 1, quantity unchanged",
  );

  // Step 6: the held unit is blocked at the counter.
  await owner.goto(`${base}/pharmacy/counter`);
  await owner.locator("#counter-q").fill(medName);
  await owner
    .getByText(/Can sell 2 · 1 reserved/)
    .first()
    .waitFor();
  await owner.getByRole("button", { name: `Add: ${medName} 10mg` }).click();
  await owner.locator(`#qty-${medicineId}`).fill("3");
  await owner.getByRole("button", { name: "Complete sale" }).click();
  await owner
    .getByText(/1 unit is reserved for pickup/)
    .first()
    .waitFor({ timeout: 20000 });
  assert.deepEqual(await stockRow(shopA.id), { quantity: 3, held_quantity: 1 });
  pass("step 6: counter refuses held stock and says 1 unit is reserved");

  // Another shop's pharmacist sees nothing of it.
  const otherCtx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const other = await otherCtx.newPage();
  await signIn(other, ownerB.email);
  await other.waitForURL("**/pharmacy");
  await other.goto(`${base}/pharmacy/reservations`);
  await other.locator("main").waitFor();
  assert.ok(!(await other.locator("main").innerText()).includes(customerName));
  await otherCtx.close();
  pass("pharmacist of another shop does not see the reservation");

  // Step 7: wrong code refused, right code collects, stock drops.
  await owner.goto(`${base}/pharmacy/reservations`);
  await owner.getByText(customerName).first().waitFor();
  const codeBox = owner.getByLabel("Pickup code from the customer").first();
  await codeBox.fill(code === "000000" ? "111111" : "000000");
  await owner.getByRole("button", { name: "Mark collected" }).first().click();
  await owner
    .getByText(/doesn't match this reservation/)
    .first()
    .waitFor();
  await owner.getByLabel("Pickup code from the customer").first().fill(code);
  await owner.getByRole("button", { name: "Mark collected" }).first().click();
  await until(
    async () => (await stockRow(shopA.id))?.held_quantity === 0,
    "collect",
    owner,
  );
  assert.deepEqual(await stockRow(shopA.id), { quantity: 2, held_quantity: 0 });
  pass(
    "step 7: wrong code refused; right code collects; quantity 3 → 2, held 0",
  );

  await cust.goto(`${base}/reservations`);
  await cust
    .getByText(/Collected/)
    .first()
    .waitFor();
  pass("customer sees the reservation as collected");

  // W2: a normal counter sale and the dashboard.
  await owner.goto(`${base}/pharmacy/counter`);
  await owner.locator("#counter-q").fill(medName);
  await owner.getByRole("button", { name: `Add: ${medName} 10mg` }).click();
  await owner.getByRole("button", { name: "Complete sale" }).click();
  await owner.getByText(/Sale complete/).waitFor({ timeout: 20000 });
  assert.deepEqual(await stockRow(shopA.id), { quantity: 1, held_quantity: 0 });
  await owner.goto(`${base}/pharmacy`);
  // Wait past the loading state for the real numbers.
  await owner
    .getByText(/৳\s?15/)
    .first()
    .waitFor({ timeout: 20000 });
  pass("counter sale deducts stock; dashboard shows today's sale");

  await ownerCtx.close();
  await custCtx.close();
} finally {
  if (browser) await browser.close();
  for (const shop of shops) {
    const sales = await service
      .from("sales")
      .select("id")
      .eq("pharmacy_id", shop);
    for (const row of sales.data || [])
      await service.from("sale_items").delete().eq("sale_id", row.id);
    await service.from("sales").delete().eq("pharmacy_id", shop);
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
  for (const shop of shops)
    await service.from("pharmacies").delete().eq("id", shop);
  for (const id of users) {
    await service.storage.from("licences").remove([`${id}/w23-${run}.png`]);
    await service.auth.admin.deleteUser(id);
  }
  if (medicineId) await service.from("medicines").delete().eq("id", medicineId);
}
