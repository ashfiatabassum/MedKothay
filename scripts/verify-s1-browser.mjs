// S1 checks: AI prescription reading. Run against `next start -p 3102` (or
// APP_URL) with S1_TEST_REMOTE=gkzqlpaknytdvbbknaxp, SUPABASE_SECRET_KEY and
// GEMINI_API_KEY in .env.local. Uses ONE real Gemini read with a fictional
// prescription generated here; the daily limit is checked by pre-filling
// today's reads in the database. Removes its own fixtures.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const ref = "gkzqlpaknytdvbbknaxp";
assert.equal(
  process.env.S1_TEST_REMOTE,
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
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, secret, opts);
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    opts,
  );

const run = crypto.randomBytes(5).toString("hex");
const password = `S1-demo-${run}!`;
// APP_URL runs the same checks against the live site.
const base = process.env.APP_URL || "http://localhost:3102";
const users = [];
let browser;
const pass = (label) => console.log(`PASS ${label}`);
const imagePath = path.join(os.tmpdir(), `s1-rx-${run}.png`);

// A made-up prescription: fictional doctor and patient, real catalog brands.
const RX_HTML = `<!doctype html><html><body style="margin:0;background:#fff">
<div style="width:700px;padding:36px;font-family:Georgia,serif;color:#1a1a1a">
  <div style="border-bottom:2px solid #333;padding-bottom:10px">
    <div style="font-size:24px;font-weight:bold">Dr. Example Rahman, MBBS</div>
    <div style="font-size:14px">Demo Clinic, Road 1, Dhanmondi, Dhaka · Reg. no. DEMO-000</div>
  </div>
  <div style="font-size:15px;margin:14px 0">Patient: Test Patient · Age 30 · Date: 24/11/2026</div>
  <div style="font-size:40px;font-weight:bold">Rx</div>
  <ol style="font-family:'Segoe Script','Brush Script MT',cursive;font-size:26px;line-height:1.9">
    <li>Tab. Napa 500 mg — 1+1+1 × 5 days</li>
    <li>Cap. Seclo 20 mg — 1+0+1 before meal × 14 days</li>
    <li>Tab. Fexo 120 mg — 0+0+1 × 7 days</li>
  </ol>
  <div style="font-size:13px;margin-top:20px">Fictional test prescription for MedKothay. Not a real patient.</div>
</div></body></html>`;

async function makeUser(label, type) {
  const email = `s1-${run}-${label}@medkothay.test`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      account_type: type,
      full_name: `S1 ${label} ${run}`,
      phone: "01700000994",
    },
  });
  if (created.error) throw created.error;
  users.push(created.data.user.id);
  return { id: created.data.user.id, email };
}
async function signIn(page, email) {
  await page.goto(`${base}/sign-in`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
}

try {
  const customer = await makeUser("customer", "customer");
  const owner = await makeUser("owner", "pharmacy");
  browser = await chromium.launch({ channel: "chrome", headless: true });

  // The fictional prescription image.
  const shot = await browser.newPage({ viewport: { width: 700, height: 520 } });
  await shot.setContent(RX_HTML);
  await shot.screenshot({ path: imagePath, fullPage: true });
  await shot.close();

  // Signed out: asked to sign in; the home page links to the reader.
  const anonCtx = await browser.newContext({
    viewport: { width: 375, height: 800 },
  });
  const anon = await anonCtx.newPage();
  await anon.goto(base);
  await anon.getByRole("link", { name: /Search from a photo/ }).click();
  await anon.waitForURL("**/prescription");
  await anon.getByText("Sign in to read a prescription").waitFor();
  await anonCtx.close();
  pass("home links to the reader; a signed-out visitor is asked to sign in");

  // Pharmacist: refused, and the database refuses a direct claim too.
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await signIn(ownerPage, owner.email);
  await ownerPage.goto(`${base}/prescription`);
  await ownerPage
    .getByText("Prescription reading is for customer accounts")
    .waitFor();
  await ownerCtx.close();
  const ownerApi = client();
  await ownerApi.auth.signInWithPassword({ email: owner.email, password });
  assert.ok((await ownerApi.rpc("claim_prescription_read")).error);
  assert.ok((await client().rpc("claim_prescription_read")).error);
  pass("pharmacist and anonymous callers cannot use the reader");

  // Customer reads the fictional prescription at 375 px (one real Gemini call).
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 800 },
  });
  const page = await ctx.newPage();
  await signIn(page, customer.email);
  await page.goto(`${base}/prescription`);
  await page.getByLabel("Prescription photo").setInputFiles(imagePath);
  const started = Date.now();
  await page.getByRole("button", { name: "Read prescription" }).click();
  await page
    .getByRole("heading", { name: "Medicines found" })
    .or(page.locator("#rx-photo-error"))
    .first()
    .waitFor({ timeout: 90_000 });
  const seconds = Math.round((Date.now() - started) / 1000);
  if (!(await page.getByRole("heading", { name: "Medicines found" }).count()))
    throw new Error(
      `Read failed: ${await page.locator("#rx-photo-error").innerText()}`,
    );
  const names = await page
    .locator('input[id^="rx-name-"]')
    .evaluateAll((els) => els.map((e) => e.value));
  console.log(`  read in ${seconds} s: ${JSON.stringify(names)}`);
  for (const want of ["napa", "seclo", "fexo"])
    assert.ok(
      names.some((n) => n.toLowerCase().includes(want)),
      `expected ${want} in ${names}`,
    );
  assert.ok((await page.getByText("In our catalog").count()) >= 3);
  await page.getByText("9 reads left today").waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "no horizontal scroll at 375px",
  );
  pass(
    "customer reads a fictional prescription: Napa, Seclo, Fexo found and in the catalog",
  );

  // Edit the list: remove one, add one, and search a name.
  const before = await page.locator('input[id^="rx-name-"]').count();
  await page.getByRole("button", { name: "Remove medicine 3" }).click();
  await page.getByRole("button", { name: "Add a medicine" }).click();
  const added = page.locator('input[id^="rx-name-"]').last();
  await added.fill("Monas");
  assert.equal(await page.locator('input[id^="rx-name-"]').count(), before);
  await page.getByRole("link", { name: "Search for Monas" }).waitFor();
  const first = names.find((n) => n.toLowerCase().includes("napa"));
  await page.getByRole("link", { name: `Search for ${first}` }).click();
  await page.waitForURL((u) => u.pathname === "/search");
  assert.equal(new URL(page.url()).searchParams.get("q"), first);
  pass("the list can be edited and each name opens the normal search");

  // Privacy: only who and when is stored.
  const reads = await service
    .from("prescription_reads")
    .select("*")
    .eq("customer_id", customer.id);
  assert.equal(reads.data.length, 1);
  assert.deepEqual(Object.keys(reads.data[0]).sort(), [
    "created_at",
    "customer_id",
    "id",
  ]);
  const custApi = client();
  await custApi.auth.signInWithPassword({ email: customer.email, password });
  assert.ok(
    (await custApi.from("prescription_reads").select("id")).error,
    "customers cannot read the table directly",
  );
  pass("only the read time is stored; the table has no client access");

  // Daily limit: fill today's other 9 reads, then the 11th is refused.
  const fill = await service
    .from("prescription_reads")
    .insert(Array.from({ length: 9 }, () => ({ customer_id: customer.id })));
  assert.equal(fill.error, null);
  await page.goto(`${base}/prescription`);
  await page.getByLabel("Prescription photo").setInputFiles(imagePath);
  await page.getByRole("button", { name: "Read prescription" }).click();
  await page
    .getByText("You have used today's 10 prescription reads", { exact: false })
    .waitFor({ timeout: 30_000 });
  const after = await service
    .from("prescription_reads")
    .select("id")
    .eq("customer_id", customer.id);
  assert.equal(after.data.length, 10, "a refused read is not counted");
  pass("the 11th read of the day is refused with a clear message");
  await ctx.close();
} finally {
  if (browser) await browser.close();
  await fs.rm(imagePath, { force: true });
  // Deleting the user cascades to profiles and prescription_reads.
  for (const id of users) await service.auth.admin.deleteUser(id);
}
