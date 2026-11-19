// Deterministic, in-memory checks for the UI-phase data/action contracts.
// Next cookies/redirect and React request caching are stubbed; no database,
// network, browser or repository data is changed. Browser QA is still required.
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const now = Date.parse("2026-11-19T08:00:00Z");
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [now]));
  }
  static now() {
    return now;
  }
}
const cookies = new Map();
const storage = new Map();
const context = vm.createContext({
  Date: FixedDate,
  TextEncoder,
  Uint8Array,
  Uint32Array,
  crypto: webcrypto,
  process: { env: { NODE_ENV: "test" } },
  setTimeout: (fn) => {
    queueMicrotask(fn);
    return 0;
  },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
});
const modules = new Map();
function stub(id, values) {
  return new vm.SyntheticModule(
    Object.keys(values),
    function () {
      for (const [key, value] of Object.entries(values))
        this.setExport(key, value);
    },
    { context, identifier: id },
  );
}
function moduleFor(id) {
  if (modules.has(id)) return modules.get(id);
  let sourceModule;
  if (id === "server-only") sourceModule = stub(id, {});
  else if (id === "react") sourceModule = stub(id, { cache: (fn) => fn });
  else if (id === "next/headers")
    sourceModule = stub(id, {
      cookies: async () => ({
        get: (key) =>
          cookies.has(key) ? { value: cookies.get(key) } : undefined,
        set: (key, value) => cookies.set(key, value),
        delete: (key) => cookies.delete(key),
      }),
    });
  else if (id === "next/navigation")
    sourceModule = stub(id, {
      redirect: (url) => {
        throw new Error("REDIRECT:" + url);
      },
    });
  else
    sourceModule = new vm.SourceTextModule(
      fs.readFileSync(id.split("?")[0], "utf8"),
      { context, identifier: id },
    );
  modules.set(id, sourceModule);
  return sourceModule;
}
async function load(relative, fresh = false) {
  const sourceModule = moduleFor(
    path.resolve(root, relative) + (fresh ? "?reload" : ""),
  );
  if (sourceModule.status === "unlinked")
    await sourceModule.link((specifier) =>
      moduleFor(
        specifier.startsWith("@/")
          ? path.resolve(root, specifier.slice(2)) + ".js"
          : specifier,
      ),
    );
  if (sourceModule.status === "linked") await sourceModule.evaluate();
  return sourceModule.namespace;
}
const signIn = (key) =>
  key ? cookies.set("mk_demo_session", key) : cookies.clear();
const fd = (values) => ({ get: (key) => values[key] ?? null });
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log("PASS " + name);
}

const constants = await load("lib/constants.js");
const validation = await load("lib/validation.js");
const customer = await load("lib/data/customer.js");
const pharmacy = await load("lib/data/pharmacy.js");
const session = await load("lib/data/session.js");
const admin = await load("lib/data/admin.js");
const reserve = await load("app/(customer)/basket/actions.js");
const adminActions = await load("app/(admin)/admin/actions.js");
const pharmacyActions = await load("app/(pharmacy)/pharmacy/actions.js");
const mock = await load("lib/mock-data.js");
const areas = await load("lib/areas.js");
const payload = {
  pharmacyId: "p-lazz-dhanmondi",
  requestId: webcrypto.randomUUID(),
  items: [{ medicineId: "m-napa", quantity: 2, expectedPrice: 12 }],
};

await check("Dhaka expiry boundary and form-based units", () => {
  assert.equal(
    constants.dhakaToday(Date.parse("2026-11-18T18:00:00Z")),
    "2026-11-19",
  );
  assert.equal(constants.isPastDate("2026-11-18", now), true);
  assert.equal(constants.isPastDate("2026-11-19", now), false);
  assert.equal(constants.perUnit(12, "tablet"), "৳12 per tablet");
  assert.equal(constants.countUnits(2, "syrup"), "2 bottles");
  assert.equal(constants.countUnits(1, "injection"), "1 vial");
});
await check("Bangla mobile digits and canonical request UUIDs", () => {
  assert.equal(
    validation.normalizeBdPhone("০১৭১২-৩৪৫৬৭৮").value,
    "+8801712345678",
  );
  assert.equal(validation.isUuid(payload.requestId), true);
  assert.equal(validation.isUuid("-".repeat(36)), false);
  assert.equal(validation.isUuid("a".repeat(36)), false);
});
await check(
  "six requested searches: bands, distance, visibility and no results",
  async () => {
    for (const id of ["dhanmondi", "uttara-7"]) {
      const area = areas.findArea(id);
      for (const query of ["napa", "seclo", "zzz"]) {
        const result = await customer.searchMedicine({
          query,
          lat: area.lat,
          lng: area.lng,
        });
        const rows = [...result.withinRadius, ...result.outsideRadius];
        if (query === "zzz") assert.equal(rows.length, 0);
        for (const row of rows) {
          assert.equal(
            mock.pharmacies.find((p) => p.id === row.pharmacyId).status,
            "approved",
          );
          assert.equal(row.pharmacyId === "p-banani-care", false);
          for (const field of [
            "quantity",
            "heldQuantity",
            "available",
            "licenceNumber",
            "rejectionReason",
          ])
            assert.equal(field in row, false);
        }
        assert.equal(
          result.withinRadius.every(
            (r, i, all) => i === 0 || all[i - 1].distanceKm <= r.distanceKm,
          ),
          true,
        );
      }
    }
  },
);
await check(
  "fallback keeps three distinct shops and all their matching medicines",
  async () => {
    const result = await customer.searchMedicine({
      query: "napa",
      lat: 24,
      lng: 90.37,
    });
    assert.equal(
      new Set(result.outsideRadius.map((r) => r.pharmacyId)).size,
      3,
    );
    assert.equal(
      result.outsideRadius.filter((r) => r.pharmacyId === "p-tamanna-mirpur")
        .length,
      2,
    );
  },
);
await check(
  "expired stock hidden; inventory/dashboard and sale agree",
  async () => {
    const area = areas.findArea("dhanmondi");
    const result = await customer.searchMedicine({
      query: "ace",
      lat: area.lat,
      lng: area.lng,
    });
    assert.equal(
      [...result.withinRadius, ...result.outsideRadius].some(
        (r) => r.pharmacyId === "p-lazz-dhanmondi" && r.medicine.id === "m-ace",
      ),
      false,
    );
    const inventory = await pharmacy.getInventory("p-lazz-dhanmondi");
    const dashboard = await pharmacy.getDashboard("p-lazz-dhanmondi");
    assert.equal(
      dashboard.outOfStock,
      inventory.filter((r) => r.available === 0).length,
    );
    assert.equal(
      dashboard.lowStock,
      inventory.filter((r) => r.band === "low").length,
    );
    assert.equal(
      (
        await pharmacy.completeSale({
          pharmacyId: "p-lazz-dhanmondi",
          items: [{ medicineId: "m-ace", quantity: 1 }],
        })
      ).ok,
      false,
    );
  },
);
await check(
  "reservation action role, quantity, duplicate and UUID checks",
  async () => {
    signIn(null);
    assert.equal(
      (await reserve.reserveAction(payload)).status,
      "needs-sign-in",
    );
    signIn("pharmacist");
    assert.equal((await reserve.reserveAction(payload)).status, "not-customer");
    signIn("customer");
    assert.equal(
      (await reserve.reserveAction({ ...payload, requestId: "-".repeat(36) }))
        .status,
      "error",
    );
    for (const quantity of [0, 6, 1.5])
      assert.equal(
        (
          await reserve.reserveAction({
            ...payload,
            items: [{ ...payload.items[0], quantity }],
          })
        ).status,
        "error",
      );
    assert.equal(
      (
        await reserve.reserveAction({
          ...payload,
          items: [...payload.items, ...payload.items],
        })
      ).status,
      "error",
    );
  },
);
await check(
  "changed prices hold nothing; accepted reservation has a 30-minute price snapshot",
  async () => {
    const held = mock.pharmacyStock.map((s) => s.held_quantity).join();
    const changed = await reserve.reserveAction({
      ...payload,
      items: [{ ...payload.items[0], expectedPrice: 1 }],
    });
    assert.equal(changed.status, "price_changed");
    assert.equal(changed.prices["m-napa"], 12);
    assert.equal(mock.pharmacyStock.map((s) => s.held_quantity).join(), held);
    const result = await reserve.reserveAction(payload);
    assert.equal(result.status, "reserved");
    assert.match(result.reservation.pickupCode, /^\d{6}$/);
    assert.equal(
      Date.parse(result.reservation.expiresAt) -
        Date.parse(result.reservation.createdAt),
      30 * 60000,
    );
    const stock = mock.pharmacyStock.find(
      (s) => s.pharmacy_id === payload.pharmacyId && s.medicine_id === "m-napa",
    );
    stock.selling_price = 15;
    assert.equal(result.reservation.items[0].unitPrice, 12);
    stock.selling_price = 12;
  },
);
await check(
  "short-item failure and max-three active reservation message",
  async () => {
    const short = await reserve.reserveAction({
      ...payload,
      items: [{ medicineId: "m-seclo", quantity: 5, expectedPrice: 7 }],
    });
    assert.equal(short.status, "error");
    assert.equal(short.medicineId, "m-seclo");
    const base = mock.reservations.find((r) => r.id === "r-1001");
    mock.reservations.push(
      { ...base, id: "fixture-1" },
      { ...base, id: "fixture-2" },
    );
    assert.match(
      (await reserve.reserveAction(payload)).message,
      /3 reservations/,
    );
    mock.reservations.splice(-2);
  },
);
await check(
  "suspension cancellation explanation and owner correction scenarios",
  async () => {
    const rows = await customer.getMyReservations("u-demo-customer");
    const cancelled = rows.find((r) => r.id === "r-suspended");
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.cancellationReason, "pharmacy_unavailable");
    assert.equal(cancelled.expiresAt, null);
    assert.equal("rejectionReason" in cancelled, false);
    for (const key of [
      "pharmacist_suspended",
      "pharmacist_expired",
      "pharmacist_rejected",
    ]) {
      signIn(key);
      const own = await pharmacy.getMyPharmacy(await session.getCurrentUser());
      assert.equal(pharmacy.canSubmitRegistration(own), true);
      assert.equal(Number.isFinite(own.latitude), true);
      assert.equal(Number.isFinite(own.longitude), true);
    }
    signIn("pharmacist_suspended");
    const registered = await pharmacyActions.registerPharmacyAction(
      {},
      fd({
        name: "Gulshan Community Pharmacy",
        address: "Shop 6, Road 3, Gulshan 1",
        area: "gulshan-1",
        lat: "23.7812",
        lng: "90.4161",
        locationSource: "device",
        phone: "01711000010",
        licenceNumber: "DGDA-DH-10021",
        licenceExpiry: "2027-08-31",
        licencePhoto: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]),
      }),
    );
    assert.equal(registered.status, "submitted");
  },
);
await check(
  "incoming pickup items retain their unit and held stock is blocked",
  async () => {
    const rows = await pharmacy.getIncomingReservations("p-lazz-dhanmondi");
    assert.equal(rows.find((r) => r.id === "r-1001").items[0].form, "tablet");
    const blocked = await pharmacy.completeSale({
      pharmacyId: "p-lazz-dhanmondi",
      items: [{ medicineId: "m-seclo", quantity: 4 }],
    });
    assert.match(blocked.error, /1 unit is reserved/);
    assert.equal(
      (
        await pharmacy.collectReservation({
          pharmacyId: "p-lazz-dhanmondi",
          reservationId: "r-1001",
          code: "482915",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await pharmacy.collectReservation({
          pharmacyId: "p-green-motijheel",
          reservationId: "r-1001",
          code: "482915",
        })
      ).ok,
      false,
    );
  },
);
await check(
  "admin authorization, duplicates, resubmission dates and reviewer",
  async () => {
    signIn("customer");
    await assert.rejects(admin.getPharmacy("p-rahman-banani"), /REDIRECT/);
    signIn("admin");
    const p = await admin.getPharmacy("p-rahman-banani");
    assert.equal(
      p.duplicates.some((d) => d.id === "p-lazz-dhanmondi"),
      true,
    );
    assert.equal(p.submittedAt, "2026-11-19T04:30:00Z");
    assert.equal(p.reviewedBy, "Demo Admin");
    assert.equal(p.locationSource, "device");
    assert.ok(p.previousRejectionReason);
    const pending = mock.pharmacies.find((p) => p.id === "p-green-motijheel");
    const expiry = pending.licence_expiry;
    pending.licence_expiry = "2026-11-18";
    assert.equal(
      (await adminActions.approveAction({}, fd({ pharmacyId: pending.id })))
        .status,
      "error",
    );
    pending.licence_expiry = "2026-11-19";
    assert.equal(
      (await adminActions.approveAction({}, fd({ pharmacyId: pending.id })))
        .status,
      "approved",
    );
    pending.licence_expiry = expiry;
  },
);
await check("suspend reason and shared-catalog edit confirmation", async () => {
  assert.equal(
    (
      await adminActions.suspendAction(
        {},
        fd({ pharmacyId: "p-lazz-dhanmondi", reason: "short" }),
      )
    ).status,
    "error",
  );
  assert.equal(
    (
      await adminActions.suspendAction(
        {},
        fd({
          pharmacyId: "p-lazz-dhanmondi",
          reason: "Please correct the shop licence details.",
        }),
      )
    ).status,
    "suspended",
  );
  const fields = {
    medicineId: "m-napa",
    brandName: "Napa",
    genericName: "Paracetamol",
    manufacturer: "Beximco",
    strength: "500mg",
    form: "tablet",
  };
  assert.ok(
    (await adminActions.updateMedicineAction({}, fd(fields))).fieldErrors
      .confirmShared,
  );
  assert.equal(
    (
      await adminActions.updateMedicineAction(
        {},
        fd({ ...fields, confirmShared: "on" }),
      )
    ).status,
    "saved",
  );
});
await check(
  "unresolved request survives reload; newer basket attempts survive old responses",
  async () => {
    const store = await load("components/basket/basket-store.js");
    const basket = {
      pharmacyId: "p-lazz-dhanmondi",
      pharmacyName: "Lazz",
      address: "Dhanmondi",
      items: [
        {
          medicineId: "m-napa",
          brandName: "Napa",
          strength: "500mg",
          form: "tablet",
          prescriptionOnly: false,
          quantity: 2,
          unitPrice: 12,
        },
      ],
    };
    store.setBasket(basket);
    const id = store.reservationRequestId(basket);
    const reloaded = await load("components/basket/basket-store.js", true);
    assert.equal(reloaded.reservationRequestId(reloaded.getBasket()), id);
    const replacement = { ...basket, pharmacyId: "p-tamanna-mirpur" };
    const newerId = reloaded.reservationRequestId(replacement);
    assert.notEqual(newerId, id);
    store.finishReservationRequest(basket, id);
    assert.equal(reloaded.reservationRequestId(replacement), newerId);
    reloaded.finishReservationRequest(replacement, newerId);
    assert.notEqual(reloaded.reservationRequestId(replacement), newerId);
    assert.notEqual(
      store.basketFingerprint(basket),
      store.basketFingerprint(replacement),
    );
    const currentId = reloaded.reservationRequestId(replacement);
    assert.equal(
      reloaded.finishReservationRequest(replacement, newerId),
      false,
    );
    assert.equal(reloaded.reservationRequestId(replacement), currentId);
    reloaded.finishReservationRequest(replacement, currentId);
    const write = context.localStorage.setItem;
    context.localStorage.setItem = () => {
      throw new Error("Storage quota exceeded");
    };
    const memoryId = reloaded.reservationRequestId(basket);
    assert.equal(reloaded.reservationRequestId(basket), memoryId);
    context.localStorage.setItem = write;
    reloaded.finishReservationRequest(basket, memoryId);
  },
);
console.log(
  "R1: " +
    checks +
    " contract checks passed. Browser and database verification remain separate.",
);
