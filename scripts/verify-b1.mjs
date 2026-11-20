// Live B1 integration checks. Creates temporary Auth users, shops, stock and
// reservations on the linked demo project, then removes its own fixtures.
// Run only with B1_TEST_REMOTE=gkzqlpaknytdvbbknaxp.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const expectedRef = "gkzqlpaknytdvbbknaxp";
assert.equal(
  process.env.B1_TEST_REMOTE,
  expectedRef,
  "Explicit demo project target required",
);
const vars = Object.fromEntries(
  (await fs.readFile(".env.local", "utf8"))
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^"|"$/g, "")]),
);
const url = vars.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.B1_SERVICE_KEY || vars.SUPABASE_SECRET_KEY;
assert.ok(url?.includes(expectedRef) && publicKey && secret);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, secret, opts);
const anon = createClient(url, publicKey, opts);
const runId = crypto.randomBytes(5).toString("hex");
const users = [];
const shops = [];
const catalogFixtures = [];
const checks = [];
const png = await fs.readFile("supabase/seed-assets/demo-licence.png");
const pass = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
const expectNoError = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
async function makeUser(label, type, extra = {}) {
  const email = `b1-${runId}-${label}@medkothay.test`;
  const meta = {
    account_type: type,
    full_name: `B1 ${label}`,
    phone: "01700000999",
    ...extra,
  };
  const created = expectNoError(
    await service.auth.admin.createUser({
      email,
      password: "demo-password",
      email_confirm: true,
      user_metadata: meta,
    }),
    `create ${label}`,
  );
  const id = created.user.id;
  users.push(id);
  const client = createClient(url, publicKey, opts);
  expectNoError(
    await client.auth.signInWithPassword({ email, password: "demo-password" }),
    `sign in ${label}`,
  );
  return { id, client, email };
}
async function makePublicSignup(label, metadata) {
  // Hosted Auth rejects reserved domains on the public endpoint. Email
  // confirmation is disabled for this demo project; this user is deleted in
  // finally before any application email integration exists.
  const email = `medkothay.b1.${runId}.${label}@gmail.com`;
  const response = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: publicKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "demo-password", data: metadata }),
  });
  const result = await response.json();
  const id = result.user?.id || result.id;
  if (!response.ok || !id) {
    throw new Error(
      `public signup failed: ${response.status} ${result.msg || result.message}`,
    );
  }
  users.push(id);
  return { id, email };
}
async function upload(user) {
  const path = `${user.id}/b1-${runId}.png`;
  expectNoError(
    await user.client.storage.from("licences").upload(path, png, {
      contentType: "image/png",
      upsert: false,
    }),
    `upload ${user.email}`,
  );
  return path;
}
async function register(owner, label) {
  const image = await upload(owner);
  const args = {
    p_name: `B1 Test ${label}`,
    p_address: "Road 27, Dhanmondi, Dhaka",
    p_area: "dhanmondi",
    p_latitude: 23.7461,
    p_longitude: 90.3742,
    p_phone: "01700000888",
    p_licence_number: `B1-${runId}-${label}`,
    p_licence_photo_url: image,
    p_licence_expiry: "2027-12-31",
    p_location_source: "area",
  };
  const id = expectNoError(
    await owner.client.rpc("register_pharmacy", args),
    `register ${label}`,
  );
  shops.push(id);
  return { id, image, args };
}
const stock = async (shop, med, quantity, price = 12) => {
  expectNoError(
    await service.from("pharmacy_stock").upsert(
      {
        pharmacy_id: shop,
        medicine_id: med,
        quantity,
        held_quantity: 0,
        selling_price: price,
        expiry_date: "2027-12-31",
      },
      { onConflict: "pharmacy_id,medicine_id" },
    ),
    "stock fixture",
  );
};
const item = (medicineId, quantity, price) => [
  { medicine_id: medicineId, quantity, expected_unit_price: price },
];
const reserve = (client, shop, items, id = crypto.randomUUID()) =>
  client.rpc("reserve", {
    p_pharmacy_id: shop,
    p_items: items,
    p_request_id: id,
  });
// W3: collect_pickup returns a status instead of raising (lockout counter).
const collect = async (client, reservationId, code) =>
  expectNoError(
    await client.rpc("collect_pickup", {
      p_reservation_id: reservationId,
      p_pickup_code: code,
    }),
    "collect_pickup",
  ).status;
const selectStock = async (shop, med) =>
  expectNoError(
    await service
      .from("pharmacy_stock")
      .select("quantity,held_quantity,selling_price")
      .eq("pharmacy_id", shop)
      .eq("medicine_id", med)
      .single(),
    "read stock",
  );

try {
  const customer = await makeUser("customer", "customer");
  const customer2 = await makeUser("customer2", "customer");
  const ownerA = await makeUser("ownerA", "pharmacy");
  const ownerB = await makeUser("ownerB", "pharmacy");
  const admin = await makeUser("admin", "customer");
  const intruder = await makePublicSignup("intruder", {
    account_type: "admin",
    full_name: "B1 Intruder",
    phone: "01700000999",
    role: "admin",
    pharmacy_id: crypto.randomUUID(),
    status: "approved",
  });
  const intruderProfile = expectNoError(
    await service
      .from("profiles")
      .select("role,pharmacy_id")
      .eq("id", intruder.id)
      .single(),
    "intruder profile",
  );
  assert.deepEqual(intruderProfile, { role: "customer", pharmacy_id: null });
  assert.ok(
    (
      await customer.client
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", customer.id)
    ).error,
  );
  pass("signup metadata cannot grant admin or shop access");

  const fallback = expectNoError(
    await anon.rpc("search_medicine", {
      q: "seclo",
      lat: 23.8728,
      lng: 90.3984,
    }),
    "outside-radius fallback",
  );
  assert.equal(fallback.withinRadius.length, 0);
  assert.equal(
    new Set(fallback.outsideRadius.map((r) => r.pharmacyId)).size,
    3,
  );
  assert.ok(
    fallback.outsideRadius.every(
      (r) =>
        !Object.hasOwn(r, "quantity") &&
        ["in", "low", "out"].includes(r.stockBand),
    ),
  );
  const pendingHidden = expectNoError(
    await anon.rpc("search_medicine", {
      q: "napa",
      lat: 23.7322,
      lng: 90.4186,
    }),
    "pending shop search",
  );
  assert.ok(
    ![...pendingHidden.withinRadius, ...pendingHidden.outsideRadius].some((r) =>
      r.pharmacyName.includes("Pending"),
    ),
  );
  pass(
    "anonymous search shows three distinct outside shops and stock bands, hiding pending shops",
  );

  expectNoError(
    await service.from("profiles").update({ role: "admin" }).eq("id", admin.id),
    "set test admin",
  );
  const imageA = await upload(ownerA);
  const argsA = {
    p_name: "B1 Test A",
    p_address: "Road 27, Dhanmondi, Dhaka",
    p_area: "dhanmondi",
    p_latitude: 23.7461,
    p_longitude: 90.3742,
    p_phone: "01700000888",
    p_licence_number: `B1-${runId}-A`,
    p_licence_photo_url: imageA,
    p_licence_expiry: "2027-12-31",
    p_location_source: "area",
  };
  const registration = await Promise.all([
    ownerA.client.rpc("register_pharmacy", argsA),
    ownerA.client.rpc("register_pharmacy", argsA),
  ]);
  assert.equal(registration.filter((r) => !r.error).length, 1);
  const shopA = registration.find((r) => !r.error).data;
  shops.push(shopA);
  const registeredB = await register(ownerB, "B");
  const shopB = registeredB.id;
  pass(
    "concurrent registration creates one shop; second owner registers separately",
  );

  const licenceA = await ownerA.client.storage
    .from("licences")
    .download(imageA);
  assert.equal(licenceA.error, null);
  assert.ok((await licenceA.data.arrayBuffer()).byteLength > 1000);
  assert.ok(
    (await ownerB.client.storage.from("licences").download(imageA)).error,
  );
  assert.equal(
    (await admin.client.storage.from("licences").download(imageA)).error,
    null,
  );
  assert.ok((await anon.storage.from("licences").download(imageA)).error);
  pass(
    "private licence image: owner/admin can read, another owner/anon cannot",
  );

  expectNoError(
    await service
      .from("pharmacies")
      .update({ licence_expiry: "2026-10-01" })
      .eq("id", shopA),
    "expire pending licence fixture",
  );
  assert.ok(
    (await admin.client.rpc("approve_pharmacy", { p_pharmacy_id: shopA }))
      .error,
  );
  expectNoError(
    await service
      .from("pharmacies")
      .update({ licence_expiry: "2027-12-31" })
      .eq("id", shopA),
    "renew pending licence fixture",
  );
  assert.ok(
    (await ownerA.client.rpc("approve_pharmacy", { p_pharmacy_id: shopA }))
      .error,
  );
  expectNoError(
    await admin.client.rpc("approve_pharmacy", { p_pharmacy_id: shopA }),
    "approve A",
  );
  assert.ok(
    (
      await admin.client.rpc("reject_pharmacy", {
        p_pharmacy_id: shopB,
        p_reason: "short",
      })
    ).error,
  );
  expectNoError(
    await admin.client.rpc("reject_pharmacy", {
      p_pharmacy_id: shopB,
      p_reason: "Demo document needs review",
    }),
    "reject B",
  );
  assert.ok(
    (await customer.client.rpc("resubmit_pharmacy", registeredB.args)).error,
  );
  assert.equal(
    expectNoError(
      await ownerB.client.rpc("resubmit_pharmacy", registeredB.args),
      "resubmit B",
    ),
    shopB,
  );
  const corrected = expectNoError(
    await service
      .from("pharmacies")
      .select("previous_rejection_reason,status,latitude,longitude")
      .eq("id", shopB)
      .single(),
    "correction",
  );
  assert.equal(
    corrected.previous_rejection_reason,
    "Demo document needs review",
  );
  assert.equal(corrected.status, "pending");
  assert.equal(corrected.latitude, 23.7461);
  expectNoError(
    await admin.client.rpc("approve_pharmacy", { p_pharmacy_id: shopB }),
    "approve B",
  );
  const duplicate = expectNoError(
    await admin.client.rpc("duplicate_licence_pharmacies", {
      p_licence_number: argsA.p_licence_number.toLowerCase(),
    }),
    "duplicate lookup",
  );
  assert.equal(duplicate.length, 1);
  pass(
    "only admin approves, expired licence is refused, duplicate lookup normalizes",
  );

  const meds = expectNoError(
    await service
      .from("medicines")
      .select("id,brand_name,strength,form")
      .in("brand_name", ["Napa", "Seclo"]),
    "medicines",
  );
  const napa = meds.find(
    (m) => m.brand_name === "Napa" && m.form === "tablet",
  ).id;
  const seclo = meds.find(
    (m) => m.brand_name === "Seclo" && m.form === "capsule",
  ).id;
  expectNoError(
    await ownerA.client.rpc("set_stock", {
      p_medicine_id: napa,
      p_quantity: 4,
      p_selling_price: 12,
      p_expiry_date: "2027-12-31",
    }),
    "owner sets stock",
  );
  expectNoError(
    await ownerA.client.rpc("set_stock", {
      p_medicine_id: seclo,
      p_quantity: 3,
      p_selling_price: 7,
      p_expiry_date: "2027-12-31",
    }),
    "owner sets Seclo",
  );
  await stock(shopB, napa, 4);
  assert.ok(
    (
      await customer.client.rpc("set_stock", {
        p_medicine_id: napa,
        p_quantity: 100,
        p_selling_price: 1,
        p_expiry_date: "2027-12-31",
      })
    ).error,
  );
  assert.ok(
    (
      await ownerA.client
        .from("pharmacy_stock")
        .update({ quantity: 100 })
        .eq("pharmacy_id", shopA)
    ).error,
  );
  assert.ok((await anon.from("pharmacy_stock").select("quantity")).error);
  assert.equal(
    expectNoError(
      await customer.client.from("pharmacy_stock").select("quantity"),
      "customer stock",
    ).length,
    0,
  );
  assert.equal(
    expectNoError(
      await ownerA.client.from("pharmacy_stock").select("pharmacy_id"),
      "owner A stock",
    ).length,
    2,
  );
  assert.equal(
    expectNoError(
      await ownerB.client.from("pharmacy_stock").select("pharmacy_id"),
      "owner B stock",
    ).length,
    1,
  );
  assert.equal(
    expectNoError(
      await customer.client.from("pharmacies").select("id"),
      "customer shops",
    ).length,
    0,
  );
  pass(
    "RLS hides exact stock and private shop records from customers and other owners",
  );

  const useCount = expectNoError(
    await admin.client.rpc("medicine_stock_usage", { p_medicine_id: napa }),
    "catalog usage",
  );
  assert.ok(useCount >= 2);
  assert.ok(
    (await customer.client.rpc("medicine_stock_usage", { p_medicine_id: napa }))
      .error,
  );
  const added = expectNoError(
    await admin.client
      .from("medicines")
      .insert({
        brand_name: `B1 Test ${runId}`,
        generic_name: "Demo Compound",
        manufacturer: "Demo Manufacturer",
        strength: "1 mg",
        form: "tablet",
        prescription_only: true,
      })
      .select("id")
      .single(),
    "admin catalog add",
  );
  catalogFixtures.push(added.id);
  assert.ok(
    (
      await customer.client.from("medicines").insert({
        brand_name: `B1 Bad ${runId}`,
        generic_name: "Demo Compound",
        manufacturer: "Demo Manufacturer",
        strength: "1 mg",
        form: "tablet",
      })
    ).error,
  );
  const deniedEdit = await ownerA.client
    .from("medicines")
    .update({ strength: "2 mg" })
    .eq("id", added.id)
    .select("id");
  assert.equal(deniedEdit.error, null);
  assert.equal(deniedEdit.data.length, 0);
  pass("admin-only catalog changes and stock-usage count");

  const oldPrice = expectNoError(
    await reserve(customer.client, shopA, item(napa, 1, 11)),
    "price check",
  );
  assert.equal(oldPrice.status, "price_changed");
  assert.equal((await selectStock(shopA, napa)).held_quantity, 0);
  const requestId = crypto.randomUUID();
  const booked = expectNoError(
    await reserve(customer.client, shopA, item(napa, 1, 12), requestId),
    "reserve",
  );
  assert.equal(booked.status, "reserved");
  const retried = expectNoError(
    await reserve(customer.client, shopA, item(napa, 1, 12), requestId),
    "retry",
  );
  assert.equal(retried.reservationId, booked.reservationId);
  assert.equal((await selectStock(shopA, napa)).held_quantity, 1);
  expectNoError(
    await ownerA.client.rpc("set_stock", {
      p_medicine_id: napa,
      p_quantity: 4,
      p_selling_price: 13,
      p_expiry_date: "2027-12-31",
    }),
    "change price after hold",
  );
  assert.equal(
    expectNoError(
      await service
        .from("reservation_items")
        .select("unit_price")
        .eq("reservation_id", booked.reservationId)
        .single(),
      "price snapshot",
    ).unit_price,
    12,
  );
  expectNoError(
    await ownerA.client.rpc("set_stock", {
      p_medicine_id: napa,
      p_quantity: 4,
      p_selling_price: 12,
      p_expiry_date: "2027-12-31",
    }),
    "restore price",
  );
  assert.equal(
    expectNoError(
      await ownerB.client.from("reservations").select("id"),
      "other shop reservations",
    ).length,
    0,
  );
  assert.equal(
    expectNoError(
      await customer2.client.from("reservations").select("id"),
      "other customer reservations",
    ).length,
    0,
  );
  assert.ok(
    (
      await ownerA.client.rpc("set_stock", {
        p_medicine_id: napa,
        p_quantity: 0,
        p_selling_price: 12,
        p_expiry_date: "2027-12-31",
      })
    ).error,
  );
  // Another shop's reservation gets the same answer as a wrong code.
  assert.equal(
    await collect(ownerB.client, booked.reservationId, booked.pickupCode),
    "no_match",
  );
  assert.equal(
    await collect(
      ownerA.client,
      booked.reservationId,
      booked.pickupCode === "000000" ? "111111" : "000000",
    ),
    "no_match",
  );
  assert.ok(
    (
      await ownerA.client.rpc("complete_sale", {
        p_items: [{ medicine_id: napa, quantity: 4 }],
      })
    ).error?.message.includes("reserved for pickup"),
  );
  pass(
    "price snapshot survives stock edits; retry, held stock, pickup and reservation RLS hold",
  );

  const listed = expectNoError(
    await customer.client.rpc("get_my_reservations"),
    "customer reservations",
  );
  assert.equal(
    listed.find((r) => r.id === booked.reservationId).pickupCode,
    booked.pickupCode,
  );
  assert.equal(
    await collect(ownerA.client, booked.reservationId, booked.pickupCode),
    "collected",
  );
  assert.deepEqual(
    ((s) => [s.quantity, s.held_quantity])(await selectStock(shopA, napa)),
    [3, 0],
  );
  // Review fix: replaying the request id of a finished reservation does not
  // report a fresh success, and creates nothing (D14).
  const replay = expectNoError(
    await reserve(customer.client, shopA, item(napa, 1, 12), requestId),
    "replay after collection",
  );
  assert.equal(replay.status, "ended");
  assert.equal(replay.reservationId, booked.reservationId);
  assert.equal((await selectStock(shopA, napa)).held_quantity, 0);
  pass("pickup collects whole reservation and reduces physical and held stock");

  await stock(shopA, napa, 3);
  await stock(shopA, seclo, 3, 7);
  const multiple = expectNoError(
    await reserve(customer2.client, shopA, [
      { medicine_id: napa, quantity: 1, expected_unit_price: 12 },
      { medicine_id: seclo, quantity: 2, expected_unit_price: 7 },
    ]),
    "multi-item hold",
  );
  assert.equal(
    await collect(ownerA.client, multiple.reservationId, multiple.pickupCode),
    "collected",
  );
  assert.deepEqual(
    ((s) => [s.quantity, s.held_quantity])(await selectStock(shopA, napa)),
    [2, 0],
  );
  assert.deepEqual(
    ((s) => [s.quantity, s.held_quantity])(await selectStock(shopA, seclo)),
    [1, 0],
  );
  pass("one pickup code collects all medicines in a basket");

  // W3: secure 6-digit code, hidden from direct reads, shop list with
  // customer names, and a lockout after 5 wrong codes.
  await stock(shopA, napa, 2);
  const lockHold = expectNoError(
    await reserve(customer.client, shopA, item(napa, 1, 12)),
    "lockout hold",
  );
  assert.equal(lockHold.status, "reserved");
  assert.match(lockHold.pickupCode, /^\d{6}$/);
  for (const reader of [customer.client, ownerA.client])
    assert.ok(
      (
        await reader
          .from("reservations")
          .select("pickup_code")
          .eq("id", lockHold.reservationId)
      ).error,
      "pickup_code must not be readable directly",
    );
  const shopList = expectNoError(
    await ownerA.client.rpc("get_shop_reservations"),
    "shop reservations",
  );
  const listedHold = shopList.find((r) => r.id === lockHold.reservationId);
  assert.equal(listedHold.customerName, "B1 customer");
  assert.equal(listedHold.status, "active");
  assert.equal(listedHold.items.length, 1);
  assert.ok(!JSON.stringify(shopList).includes(lockHold.pickupCode));
  assert.ok(
    !expectNoError(
      await ownerB.client.rpc("get_shop_reservations"),
      "other shop list",
    ).some((r) => r.id === lockHold.reservationId),
  );
  const wrongCode = lockHold.pickupCode === "000000" ? "111111" : "000000";
  for (let n = 1; n <= 4; n++)
    assert.equal(
      await collect(ownerA.client, lockHold.reservationId, wrongCode),
      "no_match",
    );
  assert.equal(
    await collect(ownerA.client, lockHold.reservationId, wrongCode),
    "locked",
  );
  assert.equal(
    await collect(ownerA.client, lockHold.reservationId, lockHold.pickupCode),
    "locked",
  );
  assert.ok(
    expectNoError(
      await ownerA.client.rpc("get_shop_reservations"),
      "locked list",
    ).find((r) => r.id === lockHold.reservationId).locked,
  );
  assert.deepEqual(
    ((s) => [s.quantity, s.held_quantity])(await selectStock(shopA, napa)),
    [2, 1],
  );
  expectNoError(
    await customer.client.rpc("cancel_reservation", {
      p_reservation_id: lockHold.reservationId,
    }),
    "cancel locked hold",
  );
  assert.equal((await selectStock(shopA, napa)).held_quantity, 0);
  assert.equal(
    (
      await ownerA.client.rpc("collect_reservation", {
        p_reservation_id: lockHold.reservationId,
        p_pickup_code: lockHold.pickupCode,
      })
    ).error?.code,
    "42501",
    "old collect_reservation must be revoked",
  );
  pass(
    "pickup code is 6 random digits, hidden from table reads, and locks after 5 wrong tries",
  );

  // Review fixes: a stale edit form cannot undo a sale; add is insert-only;
  // quantity never below held; a referenced licence photo cannot be replaced.
  await stock(shopA, napa, 2);
  const save = async (expected, quantity) =>
    expectNoError(
      await ownerA.client.rpc("save_stock", {
        p_medicine_id: napa,
        p_expected_quantity: expected,
        p_quantity: quantity,
        p_selling_price: 12,
        p_expiry_date: "2027-12-31",
      }),
      "save_stock",
    );
  assert.equal((await save(null, 9)).status, "exists");
  assert.deepEqual(await save(7, 9), { status: "changed", quantity: 2 });
  assert.equal((await selectStock(shopA, napa)).quantity, 2);
  assert.equal((await save(2, 5)).status, "saved");
  assert.equal((await selectStock(shopA, napa)).quantity, 5);
  const heldForEdit = expectNoError(
    await reserve(customer2.client, shopA, item(napa, 2, 12)),
    "hold before edit",
  );
  assert.equal(heldForEdit.status, "reserved");
  assert.deepEqual(await save(5, 1), { status: "below_held", held: 2 });
  expectNoError(
    await customer2.client.rpc("cancel_reservation", {
      p_reservation_id: heldForEdit.reservationId,
    }),
    "release edit hold",
  );
  assert.ok(
    (
      await ownerA.client.storage
        .from("licences")
        .update(imageA, png, { contentType: "image/png", upsert: true })
    ).error,
    "referenced licence photo must not be overwritten",
  );
  assert.ok(
    (
      await ownerA.client.storage
        .from("licences")
        .move(imageA, `${ownerA.id}/b1-${runId}-moved.png`)
    ).error,
    "referenced licence photo must not be moved",
  );
  assert.equal(
    (await service.storage.from("licences").download(imageA)).error,
    null,
  );
  pass(
    "stale stock edits are refused, add is insert-only, and referenced licence photos are immutable",
  );

  await stock(shopA, napa, 1);
  const racing = await Promise.all([
    reserve(customer.client, shopA, item(napa, 1, 12)),
    reserve(customer2.client, shopA, item(napa, 1, 12)),
  ]);
  const won = (r) => !r.error && r.data.status === "reserved";
  assert.equal(racing.filter(won).length, 1);
  // W3: the loser gets a result naming the short item, not an error.
  const loser = racing.find((r) => !won(r));
  assert.equal(loser.data?.status, "unavailable");
  assert.equal(loser.data.reason, "short");
  assert.equal(loser.data.medicineId, napa);
  assert.equal((await selectStock(shopA, napa)).held_quantity, 1);
  const winner = racing.find(won).data;
  const winnerClient = won(racing[0]) ? customer.client : customer2.client;
  expectNoError(
    await winnerClient.rpc("cancel_reservation", {
      p_reservation_id: winner.reservationId,
    }),
    "cancel race winner",
  );
  assert.equal((await selectStock(shopA, napa)).held_quantity, 0);
  pass("last-unit race has one winner; cancel releases hold");

  await stock(shopA, napa, 2);
  await stock(shopA, seclo, 2, 7);
  const overlapping = await Promise.all([
    reserve(customer.client, shopA, [
      { medicine_id: napa, quantity: 1, expected_unit_price: 12 },
      { medicine_id: seclo, quantity: 1, expected_unit_price: 7 },
    ]),
    reserve(customer2.client, shopA, [
      { medicine_id: seclo, quantity: 1, expected_unit_price: 7 },
      { medicine_id: napa, quantity: 1, expected_unit_price: 12 },
    ]),
  ]);
  assert.equal(
    overlapping.filter((r) => !r.error && r.data.status === "reserved").length,
    2,
  );
  assert.equal((await selectStock(shopA, napa)).held_quantity, 2);
  pass("opposite-order overlapping baskets both complete without deadlock");

  const toExpire = overlapping[0].data.reservationId;
  expectNoError(
    await service
      .from("reservations")
      .update({
        created_at: new Date(Date.now() - 3600000).toISOString(),
        expires_at: new Date(Date.now() - 1800000).toISOString(),
      })
      .eq("id", toExpire),
    "make hold expire",
  );
  expectNoError(
    await ownerA.client.rpc("complete_sale", {
      p_items: [{ medicine_id: napa, quantity: 1 }],
    }),
    "sale after expiry",
  );
  assert.equal(
    expectNoError(
      await service
        .from("reservations")
        .select("status")
        .eq("id", toExpire)
        .single(),
      "expired status",
    ).status,
    "expired",
  );
  assert.equal((await selectStock(shopA, napa)).held_quantity, 1);
  pass("counter sale lazily expires old holds and leaves active holds intact");

  expectNoError(
    await admin.client.rpc("suspend_pharmacy", {
      p_pharmacy_id: shopA,
      p_reason: "B1 temporary safety suspension",
    }),
    "suspend A",
  );
  const other = overlapping[1].data.reservationId;
  const cancelled = expectNoError(
    await service
      .from("reservations")
      .select("status,cancellation_reason")
      .eq("id", other)
      .single(),
    "suspended reservation",
  );
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.cancellation_reason, "pharmacy_unavailable");
  assert.equal((await selectStock(shopA, seclo)).held_quantity, 0);
  const search = expectNoError(
    await anon.rpc("search_medicine", {
      q: "napa",
      lat: 23.7461,
      lng: 90.3742,
    }),
    "search after suspend",
  );
  assert.ok(
    ![...search.withinRadius, ...search.outsideRadius].some(
      (row) => row.pharmacyId === shopA,
    ),
  );
  pass("suspension cancels active holds and removes shop from search");

  expectNoError(
    await ownerB.client.rpc("set_stock", {
      p_medicine_id: seclo,
      p_quantity: 3,
      p_selling_price: 7,
      p_expiry_date: "2026-10-01",
    }),
    "expired stock fixture",
  );
  const expiredHold = expectNoError(
    await reserve(customer.client, shopB, item(seclo, 1, 7)),
    "reserve expired stock",
  );
  assert.equal(expiredHold.status, "unavailable");
  assert.equal(expiredHold.reason, "expired");
  assert.ok(
    (
      await ownerB.client.rpc("complete_sale", {
        p_items: [{ medicine_id: seclo, quantity: 1 }],
      })
    ).error,
  );
  const expiredSearch = expectNoError(
    await anon.rpc("search_medicine", {
      q: "seclo",
      lat: 23.7461,
      lng: 90.3742,
    }),
    "expired stock search",
  );
  assert.ok(!expiredSearch.withinRadius.some((r) => r.pharmacyId === shopB));
  expectNoError(
    await ownerB.client.rpc("set_stock", {
      p_medicine_id: seclo,
      p_quantity: 3,
      p_selling_price: 7,
      p_expiry_date: "2027-12-31",
    }),
    "unexpire for pickup test",
  );
  const heldThenExpired = expectNoError(
    await reserve(customer2.client, shopB, item(seclo, 1, 7)),
    "hold before stock expiry",
  );
  expectNoError(
    await ownerB.client.rpc("set_stock", {
      p_medicine_id: seclo,
      p_quantity: 3,
      p_selling_price: 7,
      p_expiry_date: "2026-10-01",
    }),
    "expire held stock",
  );
  assert.equal(
    await collect(
      ownerB.client,
      heldThenExpired.reservationId,
      heldThenExpired.pickupCode,
    ),
    "expired_item",
  );
  expectNoError(
    await customer2.client.rpc("cancel_reservation", {
      p_reservation_id: heldThenExpired.reservationId,
    }),
    "release expired stock hold",
  );
  expectNoError(
    await ownerB.client.rpc("set_stock", {
      p_medicine_id: seclo,
      p_quantity: 0,
      p_selling_price: 7,
      p_expiry_date: "2027-12-31",
    }),
    "short stock fixture",
  );
  const beforeShort = (await selectStock(shopB, napa)).held_quantity;
  const shortBasket = expectNoError(
    await reserve(customer.client, shopB, [
      { medicine_id: napa, quantity: 1, expected_unit_price: 12 },
      { medicine_id: seclo, quantity: 1, expected_unit_price: 7 },
    ]),
    "short basket",
  );
  assert.equal(shortBasket.status, "unavailable");
  assert.equal(shortBasket.reason, "short");
  assert.equal(shortBasket.medicineId, seclo);
  assert.equal((await selectStock(shopB, napa)).held_quantity, beforeShort);
  pass(
    "expired stock cannot be found, held or sold; a short basket holds nothing",
  );

  const active = [];
  for (let n = 0; n < 3; n++)
    active.push(
      expectNoError(
        await reserve(customer.client, shopB, item(napa, 1, 12)),
        `active hold ${n}`,
      ),
    );
  assert.equal(
    expectNoError(
      await reserve(customer.client, shopB, item(napa, 1, 12)),
      "fourth hold",
    ).status,
    "limit",
  );
  for (const hold of active)
    expectNoError(
      await customer.client.rpc("cancel_reservation", {
        p_reservation_id: hold.reservationId,
      }),
      "cancel active hold",
    );
  pass("fourth active reservation is refused and cancelled holds are released");

  expectNoError(
    await service
      .from("pharmacies")
      .update({ licence_expiry: "2026-10-01" })
      .eq("id", shopB),
    "expire approved licence fixture",
  );
  const hidden = expectNoError(
    await anon.rpc("search_medicine", {
      q: "napa",
      lat: 23.7461,
      lng: 90.3742,
    }),
    "expired licence search",
  );
  assert.ok(!hidden.withinRadius.some((r) => r.pharmacyId === shopB));
  assert.equal(
    expectNoError(
      await ownerB.client.rpc("resubmit_pharmacy", registeredB.args),
      "renew expired licence",
    ),
    shopB,
  );
  expectNoError(
    await admin.client.rpc("approve_pharmacy", { p_pharmacy_id: shopB }),
    "approve renewed shop",
  );
  pass("expired approved licence leaves search and owner can renew it");

  const bad = await reserve(ownerB.client, shopB, item(napa, 1, 12));
  assert.ok(bad.error?.message.includes("Customer account required"));
  pass("pharmacy account cannot reserve");
  console.log(`B1: ${checks.length} integration groups passed`);
} finally {
  // Delete only rows created under this unique run's users and shops.
  for (const shop of shops) {
    const sales = await service
      .from("sales")
      .select("id")
      .eq("pharmacy_id", shop);
    for (const row of sales.data || [])
      await service.from("sale_items").delete().eq("sale_id", row.id);
    await service.from("sales").delete().eq("pharmacy_id", shop);
    const reservations = await service
      .from("reservations")
      .select("id")
      .eq("pharmacy_id", shop);
    for (const row of reservations.data || [])
      await service
        .from("reservation_items")
        .delete()
        .eq("reservation_id", row.id);
    await service.from("reservations").delete().eq("pharmacy_id", shop);
    await service.from("pharmacy_stock").delete().eq("pharmacy_id", shop);
  }
  for (const id of users) {
    await service.from("profiles").update({ pharmacy_id: null }).eq("id", id);
  }
  for (const shop of shops)
    await service.from("pharmacies").delete().eq("id", shop);
  for (const id of users) {
    await service.storage.from("licences").remove([`${id}/b1-${runId}.png`]);
    await service.auth.admin.deleteUser(id);
  }
  for (const id of catalogFixtures)
    await service.from("medicines").delete().eq("id", id);
}
