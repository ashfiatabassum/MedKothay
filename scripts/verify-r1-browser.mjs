// Run against a production build with a separate, disposable Chrome profile.
// Uses playwright installed locally, or a package directory supplied through
// R1_PLAYWRIGHT_MODULE. All mutations use MedKothay's sample-data actions.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const packagePath = process.env.R1_PLAYWRIGHT_MODULE || "playwright";
const { chromium } = require(packagePath);
const { expect } = require(
  process.env.R1_PLAYWRIGHT_MODULE
    ? path.join(packagePath, "test")
    : "playwright/test",
);
const baseURL = process.env.R1_BASE_URL || "http://localhost:3100";
const output = "docs/screenshots";
const report = {
  baseURL,
  browser: "Chrome (headless, isolated profiles)",
  checks: [],
  errors: [],
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
let clockServer;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZ8AAAAASUVORK5CYII=",
  "base64",
);
await fs.mkdir(output, { recursive: true });

async function run(name, width, callback) {
  await callback();
  report.checks.push({ name, width, result: "pass" });
  console.log(`PASS ${width}: ${name}`);
}
function bounded(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label}: timed out after 15 seconds`)),
      15000,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
async function open(width, session) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  if (session)
    await context.addCookies([
      {
        name: "mk_demo_session",
        value: session,
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  context.on("page", (p) => {
    p.on("pageerror", (error) =>
      report.errors.push({
        type: "pageerror",
        message: error.message,
        url: p.url(),
      }),
    );
    p.on("console", (message) => {
      if (message.type() !== "error") return;
      if (
        new URL(p.url()).pathname === "/missing-r1-page" &&
        /status of 404/.test(message.text())
      ) {
        report.expectedNotFoundResponses =
          (report.expectedNotFoundResponses || 0) + 1;
      } else
        report.errors.push({
          type: "console",
          message: message.text(),
          url: p.url(),
        });
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  return { context, page };
}
async function layout(page, name, width, screenshot = false) {
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const bounds = await page.evaluate(() => ({
    inner: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.equal(bounds.inner, width);
  assert.ok(
    bounds.scroll <= bounds.inner,
    `${name} has horizontal overflow: ${JSON.stringify(bounds)}`,
  );
  assert.equal(await page.locator("main").count(), 1, `${name}: main landmark`);
  const area = page.getByLabel("Near", { exact: true });
  if (await area.count())
    assert.ok(
      (await area.boundingBox()).height >= 44,
      `${name}: area picker tap height`,
    );
  if (screenshot)
    await page.screenshot({
      path: `${output}/r1-final-${width}-${name}.png`,
      fullPage: true,
    });
}
async function signIn(page, email, target) {
  await page.goto(`${baseURL}/sign-in`);
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`${email}@medkothay.test`);
  await page.getByLabel("Password", { exact: true }).fill("demo-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`${baseURL}${target}`);
  await page.getByRole("heading", { level: 1 }).waitFor();
}
async function search(page, query, area = "dhanmondi") {
  await page.goto(`${baseURL}/`);
  await page.getByLabel("Medicine name", { exact: true }).fill(query);
  await page.getByLabel("Near", { exact: true }).selectOption(area);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForURL(/\/search\?/);
  await page
    .getByRole("heading", { name: "Search results", exact: true })
    .waitFor();
}
function result(page, medicine, shop) {
  return page
    .locator("li")
    .filter({ has: page.getByRole("heading", { name: medicine }) })
    .filter({ hasText: shop });
}
async function add(page, medicine, shop) {
  await result(page, medicine, shop)
    .getByRole("button", { name: /^Add / })
    .click();
}
async function basket(page, shop = "p-lazz-dhanmondi", price = 12) {
  await page.goto(`${baseURL}/basket`);
  await page.evaluate(
    ({ shop, price }) => {
      localStorage.setItem(
        "mk-basket-v1",
        JSON.stringify({
          pharmacyId: shop,
          pharmacyName:
            shop === "p-lazz-dhanmondi"
              ? "Lazz Pharma Dhanmondi"
              : "Tamanna Pharmacy",
          address: "Sample address",
          items: [
            {
              medicineId: "m-napa",
              brandName: "Napa",
              strength: "500mg",
              form: "tablet",
              prescriptionOnly: false,
              quantity: 1,
              unitPrice: price,
            },
          ],
        }),
      );
    },
    { shop, price },
  );
  await page.reload();
  await page.getByRole("button", { name: "Reserve for 30 minutes" }).waitFor();
}

try {
  for (const width of [375, 1280]) {
    const { context, page } = await open(width);
    await run(
      "anonymous home, keyboard skip and form errors",
      width,
      async () => {
        await page.goto(baseURL);
        assert.equal(
          await page
            .getByRole("link", { name: /Basket|My reservations/ })
            .count(),
          0,
        );
        await page.keyboard.press("Tab");
        await expect(
          page.getByRole("link", { name: "Skip to content" }),
        ).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page.locator("main")).toBeFocused();
        await page.getByRole("button", { name: "Search", exact: true }).click();
        await expect(
          page.getByLabel("Medicine name", { exact: true }),
        ).toBeFocused();
        await page.getByLabel("Medicine name", { exact: true }).fill("napa");
        await page.getByRole("button", { name: "Search", exact: true }).click();
        await expect(page.getByLabel("Near", { exact: true })).toBeFocused();
        await layout(page, "home", width, true);
      },
    );
    await run(
      "location refusal keeps area search available",
      width,
      async () => {
        await context.clearPermissions();
        await page
          .getByRole("button", { name: "Use my location", exact: true })
          .click();
        await expect(page.locator("main").getByRole("alert")).toContainText(
          "Pick your area instead",
        );
        await expect(page.getByLabel("Near", { exact: true })).toBeEnabled();
      },
    );
    await run(
      "search, units, shop contacts and basket conflict",
      width,
      async () => {
        await search(page, "napa");
        const napa = result(page, /^Napa 500mg/, "Lazz Pharma Dhanmondi");
        await expect(napa).toContainText("per tablet");
        await expect(
          napa.getByRole("link", { name: "Call Lazz Pharma Dhanmondi" }),
        ).toHaveAttribute("href", /^tel:/);
        await expect(
          napa.getByRole("link", { name: /Directions to Lazz/ }),
        ).toHaveAttribute("href", /google.com\/maps\/dir/);
        await expect(page.locator("main")).toContainText(
          "from the centre of Dhanmondi",
        );
        await layout(page, "search", width, true);
        await add(page, /^Napa 500mg/, "Lazz Pharma Dhanmondi");
        await search(page, "seclo", "mirpur-10");
        await add(page, /^Seclo 20mg/, "Tamanna Pharmacy");
        await expect(page.locator("main").getByRole("alert")).toContainText(
          "one pharmacy",
        );
        await page
          .getByRole("button", { name: "Keep my basket", exact: true })
          .click();
        await expect(
          result(page, /^Seclo 20mg/, "Tamanna Pharmacy").getByRole("button", {
            name: /^Add /,
          }),
        ).toBeFocused();
        await search(page, "seclo");
        await add(page, /^Seclo 20mg/, "Lazz Pharma Dhanmondi");
      },
    );
    await run(
      "outside-radius fallback and truthful empty state",
      width,
      async () => {
        await search(page, "seclo", "uttara-7");
        await expect(
          page.getByRole("heading", { name: "Outside 5 km", exact: true }),
        ).toBeVisible();
        assert.equal(await page.locator("main li").count(), 3);
        await layout(page, "outside-radius", width);
        await search(page, "zzz");
        await expect(page.locator("main")).toContainText(
          "participating pharmacies",
        );
        await layout(page, "no-results", width);
        await page.goto(`${baseURL}/search?q=napa&lat=24&lng=90.37`);
        await page
          .getByRole("heading", { name: "Outside 5 km", exact: true })
          .waitFor();
        const shops = await page
          .locator('section[aria-labelledby="far-heading"] li p.font-medium')
          .allTextContents();
        assert.equal(new Set(shops).size, 3);
        await search(page, "ace");
        assert.equal(
          await result(page, /^Ace 500mg/, "Lazz Pharma Dhanmondi").count(),
          0,
        );
      },
    );
    await run(
      "reserve asks for sign-in, keeps basket and return path",
      width,
      async () => {
        await page.goto(`${baseURL}/basket`);
        for (let n = 0; n < 4; n++)
          await page
            .getByRole("button", { name: "One more Seclo", exact: true })
            .click();
        await page
          .getByRole("button", { name: "Reserve for 30 minutes" })
          .click();
        await page.waitForURL(/\/sign-in\?next=%2Fbasket/);
        await layout(page, "signin", width);
        await page
          .getByLabel("Email address", { exact: true })
          .fill("customer@medkothay.test");
        await page
          .getByLabel("Password", { exact: true })
          .fill("wrong-password");
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await expect(page.locator("main").getByRole("alert")).toContainText(
          "Email or password is incorrect",
        );
        await expect(
          page.getByLabel("Email address", { exact: true }),
        ).toBeFocused();
        await page
          .getByLabel("Password", { exact: true })
          .fill("demo-password");
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await page.waitForURL(`${baseURL}/basket`);
        await expect(page.locator("main")).toContainText(
          "Lazz Pharma Dhanmondi",
        );
        await page
          .getByRole("button", { name: "Reserve for 30 minutes" })
          .click();
        await expect(page.locator("main").getByRole("alert")).toContainText(
          "Nothing has been reserved",
        );
        await expect(page.locator("main").getByRole("alert")).toContainText(
          "Seclo",
        );
        await expect(page.locator("main").getByRole("alert")).toContainText(
          "for 5",
        );
        for (let n = 0; n < 2; n++)
          await page
            .getByRole("button", { name: "One less Seclo", exact: true })
            .click();
        await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
      },
    );
    await run(
      "price change confirmation, pickup deadline and expiration",
      width,
      async () => {
        await basket(page, "p-lazz-dhanmondi", 1);
        await page
          .getByRole("button", { name: "Reserve for 30 minutes" })
          .click();
        await expect(page.locator("main").getByRole("alert")).toContainText(
          "Some prices have changed",
        );
        await expect(page.locator("main")).toContainText("৳12 per tablet");
        await layout(page, "basket-price", width, true);
        await page.clock.install();
        await page
          .getByRole("button", { name: "Reserve at these prices", exact: true })
          .click();
        await expect(
          page.getByRole("heading", {
            name: "Reserved. Your pickup code is ready.",
          }),
        ).toBeVisible();
        await expect(page.locator('[aria-label^="Pickup code "]')).toHaveText(
          /^\d{6}$/,
        );
        await expect(page.locator("main")).toContainText("Pick up by");
        await expect(page.locator("main")).toContainText(
          "Anyone with this code can collect",
        );
        assert.equal(
          await page.evaluate(() => localStorage.getItem("mk-basket-v1")),
          null,
        );
        await layout(page, "reserved", width, true);
        await page.clock.fastForward(31 * 60000);
        await expect(
          page.getByRole("heading", { name: "This reservation has expired." }),
        ).toBeVisible();
        await expect(page.locator('[aria-label^="Pickup code "]')).toHaveCount(
          0,
        );
        await page.clock.setSystemTime(new Date());
      },
    );
    await run(
      "My reservations suspension explanation and confirmed cancel",
      width,
      async () => {
        await page.goto(`${baseURL}/reservations`);
        await expect(page.locator("main")).toContainText(
          "Cancelled: pharmacy unavailable",
        );
        await layout(page, "reservations", width, true);
        await page
          .getByRole("button", { name: "Cancel reservation", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: "Keep it", exact: true }),
        ).toBeFocused();
        await page
          .getByRole("button", { name: "Yes, cancel it", exact: true })
          .click();
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: "Reservation cancelled." }),
        ).toBeFocused();
        await expect(page.locator('[aria-label^="Pickup code "]')).toHaveCount(
          0,
        );
      },
    );
    await context.close();

    const owner = await open(width);
    await run("owner sign-in, expired inventory and units", width, async () => {
      await signIn(owner.page, "pharmacy", "/pharmacy");
      await layout(owner.page, "dashboard", width, true);
      await owner.page
        .getByRole("link", { name: "Inventory", exact: true })
        .click();
      const expired = owner.page
        .locator("li")
        .filter({
          has: owner.page.getByRole("heading", { name: /^Ace 500mg/ }),
        });
      await expect(expired).toContainText("Expired: can't be sold or reserved");
      await expired
        .getByRole("button", { name: "Edit stock", exact: true })
        .click();
      await expect(
        expired.getByLabel("Quantity on shelf", { exact: true }),
      ).toBeFocused();
      await expired.getByLabel("Quantity on shelf", { exact: true }).fill("0");
      await expired.getByRole("button", { name: "Save", exact: true }).click();
      await expect(expired).toContainText("Changes accepted");
      await expired.getByRole("button", { name: "Close", exact: true }).click();
      await expect(
        expired.getByRole("button", { name: "Edit stock", exact: true }),
      ).toBeFocused();
      await layout(owner.page, "inventory", width, true);
    });
    await run(
      "counter held-stock block and successful sale",
      width,
      async () => {
        await owner.page
          .getByRole("link", { name: "Counter", exact: true })
          .click();
        await owner.page.getByLabel("Search brand or generic").fill("seclo");
        await owner.page.getByRole("button", { name: /^Add: Seclo/ }).click();
        await owner.page
          .getByLabel("Quantity of Seclo", { exact: true })
          .fill("4");
        await owner.page
          .getByRole("button", { name: "Complete sale", exact: true })
          .click();
        await expect(
          owner.page.locator("main").getByRole("alert"),
        ).toContainText("1 unit is reserved for pickup");
        await owner.page
          .getByLabel("Quantity of Seclo", { exact: true })
          .fill("1");
        await layout(owner.page, "counter", width, true);
        await owner.page
          .getByRole("button", { name: "Complete sale", exact: true })
          .click();
        await expect(
          owner.page.getByRole("heading", { name: /Sale complete/ }),
        ).toBeVisible();
      },
    );
    await run(
      "pickup code rejects errors, collects whole basket and shows units",
      width,
      async () => {
        await owner.page
          .getByRole("link", { name: "Reservations", exact: true })
          .click();
        const card = owner.page
          .locator("article")
          .filter({
            has: owner.page.getByRole("heading", {
              name: "Demo Customer",
              exact: true,
            }),
          });
        await expect(card).toContainText("2 tablets");
        await card.getByLabel("Pickup code from the customer").fill("000000");
        await card
          .getByRole("button", { name: "Mark collected", exact: true })
          .click();
        await expect(card.getByRole("alert")).toContainText("doesn't match");
        await expect(
          card.getByLabel("Pickup code from the customer"),
        ).toBeFocused();
        await card.getByLabel("Pickup code from the customer").fill("482915");
        await card
          .getByRole("button", { name: "Mark collected", exact: true })
          .click();
        await expect(card).toContainText(
          "Collected. Stock is reduced for every item.",
        );
        await expect(
          card.getByRole("button", { name: "Mark collected", exact: true }),
        ).toHaveCount(0);
        await layout(owner.page, "incoming", width, true);
      },
    );
    await owner.context.close();

    for (const [key, expected] of [
      ["pharmacist_rejected", "Registration not approved"],
      ["pharmacist_suspended", "Your pharmacy is suspended"],
      ["pharmacist_expired", "Your DGDA licence has expired"],
    ]) {
      const special = await open(width, key);
      await run(
        `${key} banner and saved-location correction`,
        width,
        async () => {
          await special.page.goto(`${baseURL}/pharmacy`);
          await expect(special.page.locator("main")).toContainText(expected);
          await layout(special.page, key, width);
          await special.page
            .getByRole("link", { name: /Correct and resubmit|Update licence/ })
            .click();
          const coords = await special.page
            .locator('input[name="lat"]')
            .inputValue();
          if (key === "pharmacist_suspended")
            assert.equal(Number(coords), 23.7812);
          await special.page
            .getByRole("button", { name: "Submit again for review" })
            .click();
          await expect(
            special.page
              .locator("main")
              .getByRole("alert")
              .filter({ hasText: "Add a photo" }),
          ).toBeVisible();
          assert.equal(
            await special.page.locator('input[name="lat"]').inputValue(),
            coords,
          );
          await special.page
            .getByLabel("Licence expiry date")
            .fill("2027-08-31");
          await special.page
            .getByLabel("Licence photo")
            .setInputFiles({
              name: "sample-licence.png",
              mimeType: "image/png",
              buffer: png,
            });
          await special.page
            .getByRole("button", { name: "Submit again for review" })
            .click();
          await expect(
            special.page.getByRole("heading", {
              name: "Thank you. Your pharmacy is under review.",
            }),
          ).toBeVisible();
          await layout(special.page, `${key}-submitted`, width);
        },
      );
      await special.context.close();
    }
    const pending = await open(width, "pharmacist_pending");
    await run(
      "second pharmacy sees only its own reservations",
      width,
      async () => {
        await pending.page.goto(`${baseURL}/pharmacy/reservations`);
        await expect(pending.page.locator("main")).toContainText(
          "No reservations waiting",
        );
        assert.equal(
          await pending.page
            .getByRole("heading", { name: "Demo Customer", exact: true })
            .count(),
          0,
        );
        await layout(pending.page, "second-pharmacy", width);
      },
    );
    await pending.context.close();

    const administrator = await open(width);
    const ap = administrator.page;
    await run(
      "admin sign-in, duplicate licence and review history",
      width,
      async () => {
        await signIn(ap, "admin", "/admin");
        await layout(ap, "admin", width, true);
        await ap
          .getByRole("link")
          .filter({ hasText: "Rahman Drug House" })
          .click();
        await expect(ap.locator("main").getByRole("alert")).toContainText(
          "Same licence number as another shop",
        );
        await expect(ap.locator("main")).toContainText("Resubmitted");
        await expect(ap.locator("main")).toContainText("Demo Admin");
        await expect(ap.locator("main")).toContainText(
          "owner's phone location",
        );
        await layout(ap, "admin-review", width, true);
        await ap.getByRole("button", { name: "Reject…", exact: true }).click();
        await ap.getByLabel("Reason for the owner").fill("short");
        await ap
          .getByRole("button", { name: "Reject with this reason", exact: true })
          .click();
        await expect(ap.getByLabel("Reason for the owner")).toBeFocused();
        await ap
          .getByLabel("Reason for the owner")
          .fill("The licence photo needs a clearer expiry date.");
        await ap
          .getByRole("button", { name: "Reject with this reason", exact: true })
          .click();
        await expect(
          ap
            .getByRole("status")
            .filter({ hasText: "Rahman Drug House not approved" }),
        ).toBeVisible();
      },
    );
    await run(
      "admin approve confirmation and suspension reason",
      width,
      async () => {
        await ap.goto(`${baseURL}/admin/pharmacies/p-green-motijheel`);
        await ap.getByRole("button", { name: "Approve…", exact: true }).click();
        await expect(ap.locator("main")).toContainText("DGDA-DH-70990");
        await expect(
          ap.getByRole("button", { name: "Yes, approve", exact: true }),
        ).toBeFocused();
        await ap
          .getByRole("button", { name: "Yes, approve", exact: true })
          .click();
        await expect(
          ap
            .getByRole("status")
            .filter({ hasText: "Green Life Pharmacy approved" }),
        ).toBeVisible();
        await ap.goto(`${baseURL}/admin/pharmacies/p-lazz-dhanmondi`);
        await ap.getByRole("button", { name: "Suspend…", exact: true }).click();
        await ap.getByLabel("Reason for the owner").fill("short");
        await ap
          .getByRole("button", { name: "Suspend pharmacy", exact: true })
          .click();
        await expect(ap.getByLabel("Reason for the owner")).toBeFocused();
        await ap
          .getByLabel("Reason for the owner")
          .fill("The licence details need another review before reopening.");
        await ap
          .getByRole("button", { name: "Suspend pharmacy", exact: true })
          .click();
        await expect(
          ap
            .getByRole("status")
            .filter({ hasText: "Lazz Pharma Dhanmondi suspended" }),
        ).toBeVisible();
        await ap.goto(`${baseURL}/admin?status=suspended`);
        await expect(ap.locator("main")).toContainText(
          "Gulshan Community Pharmacy",
        );
      },
    );
    await run(
      "admin catalog requires shared-edit confirmation and preserves fields",
      width,
      async () => {
        await ap
          .getByRole("link", { name: "Medicine catalog", exact: true })
          .click();
        await ap.getByLabel("Search the catalog").fill("napa");
        await ap
          .getByRole("button", { name: "Edit Napa 500mg", exact: true })
          .click();
        const editor = ap
          .locator("form")
          .filter({
            has: ap.locator('input[name="medicineId"][value="m-napa"]'),
          });
        await expect(
          editor.getByLabel("Brand name", { exact: true }),
        ).toBeFocused();
        await expect(editor).toContainText("Used by");
        await editor.getByRole("button", { name: "Save", exact: true }).click();
        await expect(
          editor.getByRole("checkbox", { name: /I understand this changes/ }),
        ).toBeFocused();
        await editor
          .getByRole("checkbox", { name: /I understand this changes/ })
          .check();
        await editor.getByRole("button", { name: "Save", exact: true }).click();
        await expect(editor).toContainText("Changes accepted");
        await editor
          .getByRole("button", { name: "Close", exact: true })
          .click();
        await expect(
          ap.getByRole("button", { name: "Edit Napa 500mg", exact: true }),
        ).toBeFocused();
        await layout(ap, "catalog", width, true);
        await ap
          .getByRole("button", { name: "Add medicine", exact: true })
          .click();
        await ap
          .getByLabel("Brand name", { exact: true })
          .fill("Test medicine");
        await ap.getByLabel("Form", { exact: true }).selectOption("capsule");
        await ap.getByLabel("Prescription only (Rx)", { exact: true }).check();
        await ap
          .getByRole("button", { name: "Add to catalog", exact: true })
          .click();
        await expect(ap.getByLabel("Form", { exact: true })).toHaveValue(
          "capsule",
        );
        await expect(
          ap.getByLabel("Prescription only (Rx)", { exact: true }),
        ).toBeChecked();
        await layout(ap, "catalog-errors", width);
      },
    );
    await administrator.context.close();
  }

  for (const width of [375, 1280]) {
    const signup = await open(width);
    await run(
      "customer account creation accepts Bangla mobile and returns to basket",
      width,
      async () => {
        await basket(signup.page);
        await signup.page
          .getByRole("button", { name: "Reserve for 30 minutes" })
          .click();
        await signup.page.waitForURL(/\/sign-in\?next=%2Fbasket/);
        await signup.page
          .getByRole("link", { name: "Create account", exact: true })
          .click();
        await signup.page
          .getByLabel("Full name", { exact: true })
          .fill("Workflow Test Customer");
        await signup.page
          .getByLabel("Email address", { exact: true })
          .fill(`workflow-${width}@example.test`);
        await signup.page
          .getByLabel("Password", { exact: true })
          .fill("workflow-test-password");
        await signup.page
          .getByLabel("Mobile number", { exact: true })
          .fill("০১৭১২৩৪৫৬৭৮");
        await layout(signup.page, "signup", width);
        await signup.page
          .getByRole("button", { name: "Create account", exact: true })
          .click();
        await signup.page.waitForURL(`${baseURL}/basket`);
        await expect(
          signup.page.getByRole("button", { name: "Reserve for 30 minutes" }),
        ).toBeVisible();
      },
    );
    await signup.context.close();
    const registration = await open(width);
    await run(
      "pharmacy account creation continues to step two and registers",
      width,
      async () => {
        const p = registration.page;
        await p.goto(baseURL);
        await p
          .getByRole("link", { name: "Register your pharmacy", exact: true })
          .click();
        await expect(p.locator('input[value="pharmacy"]')).toBeChecked();
        await p
          .getByLabel("Owner's full name", { exact: true })
          .fill("Workflow Test Owner");
        await p
          .getByLabel("Email address", { exact: true })
          .fill(`workflow-owner-${width}@example.test`);
        await p
          .getByLabel("Password", { exact: true })
          .fill("workflow-test-password");
        await p
          .getByLabel("Your mobile number", { exact: true })
          .fill("01712345678");
        await p
          .getByRole("button", { name: "Create account", exact: true })
          .click();
        await p.waitForURL(`${baseURL}/pharmacy/register`);
        await p
          .getByLabel("Shop name", { exact: true })
          .fill("Workflow Demo Pharmacy");
        await p
          .getByLabel("Address", { exact: true })
          .fill("House 1, Road 2, Dhanmondi");
        await p.getByLabel("Area", { exact: true }).selectOption("dhanmondi");
        await p
          .getByLabel("Shop mobile number", { exact: true })
          .fill("01712345678");
        await p
          .getByLabel("Licence number", { exact: true })
          .fill("DGDA-TEST-101");
        await p
          .getByLabel("Licence expiry date", { exact: true })
          .fill("2027-08-31");
        await p
          .getByLabel("Licence photo", { exact: true })
          .setInputFiles({
            name: "sample-licence.png",
            mimeType: "image/png",
            buffer: png,
          });
        await layout(p, "register", width, true);
        await p
          .getByRole("button", { name: "Submit for review", exact: true })
          .click();
        await expect(
          p.getByRole("heading", {
            name: "Thank you. Your pharmacy is under review.",
          }),
        ).toBeVisible();
      },
    );
    await registration.context.close();
    const rx = await open(width, "customer");
    await run("Rx requirements appear before Reserve", width, async () => {
      await search(rx.page, "monas");
      await add(rx.page, /^Monas 10 10mg/, "Lazz Pharma Dhanmondi");
      await rx.page.getByRole("link", { name: /Basket, 1 medicine/ }).click();
      await expect(rx.page.locator("main")).toContainText(
        "Prescription needed for Monas 10",
      );
      await expect(rx.page.locator("main")).toContainText(
        "whole basket is collected together",
      );
      await layout(rx.page, "rx-basket", width);
    });
    await rx.context.close();
    const wrongRole = await open(width, "pharmacist");
    await run(
      "pharmacy account cannot reserve; protected role routes refuse access",
      width,
      async () => {
        await basket(wrongRole.page);
        await wrongRole.page
          .getByRole("button", { name: "Reserve for 30 minutes" })
          .click();
        await expect(
          wrongRole.page.locator("main").getByRole("alert"),
        ).toContainText("can't reserve medicines");
        const adminResponse = await wrongRole.context.request.get(
          `${baseURL}/admin`,
          { maxRedirects: 0 },
        );
        assert.equal(adminResponse.status(), 307);
        const anon = await open(width);
        try {
          for (const route of [
            "/admin",
            "/admin/catalog",
            "/pharmacy",
            "/pharmacy/inventory",
          ]) {
            assert.equal(
              (
                await anon.context.request.get(`${baseURL}${route}`, {
                  maxRedirects: 0,
                })
              ).status(),
              307,
            );
          }
          await anon.page.goto(`${baseURL}/dev/components`);
          await layout(anon.page, "components", width);
          await anon.page.goto(`${baseURL}/missing-r1-page`);
          await layout(anon.page, "not-found", width);
        } finally {
          await anon.context.close();
        }
      },
    );
    await wrongRole.context.close();
    const recovery = await open(width, "customer");
    await run(
      "failed request retains basket and retry identity through reload",
      width,
      async () => {
        const p = recovery.page;
        await basket(p);
        let failedId;
        await p.route("**/*", async (route) => {
          const request = route.request();
          if (request.method() === "POST" && request.headers()["next-action"]) {
            failedId = await p.evaluate(
              () =>
                JSON.parse(localStorage.getItem("mk-reservation-request-v1"))
                  .id,
            );
            await route.abort("failed");
          } else await route.continue();
        });
        const expectedErrorsFrom = report.errors.length;
        await p.getByRole("button", { name: "Reserve for 30 minutes" }).click();
        await expect(p.locator("main").getByRole("alert")).toContainText(
          "Check your connection",
        );
        const expectedErrors = report.errors.splice(expectedErrorsFrom);
        assert.equal(
          expectedErrors.every(
            (e) =>
              e.type === "console" &&
              /net::ERR_FAILED|Failed to fetch|Failed to load resource/.test(
                e.message,
              ),
          ),
          true,
          JSON.stringify(expectedErrors),
        );
        report.expectedNetworkFailures =
          (report.expectedNetworkFailures || 0) + 1;
        await p.unroute("**/*");
        await p.reload();
        assert.equal(
          await p.evaluate(
            () =>
              JSON.parse(localStorage.getItem("mk-reservation-request-v1")).id,
          ),
          failedId,
        );
        let retriedId;
        p.on("request", (request) => {
          if (request.method() === "POST" && request.headers()["next-action"]) {
            assert.ok(request.postData().includes(failedId));
            retriedId = failedId;
          }
        });
        await p.getByRole("button", { name: "Reserve for 30 minutes" }).click();
        await expect(
          p.getByRole("heading", {
            name: "Reserved. Your pickup code is ready.",
          }),
        ).toBeVisible();
        assert.equal(retriedId, failedId);
      },
    );
    await recovery.context.close();
    const concurrent = await open(width, "customer");
    await run(
      "delayed successful reservation preserves a replacement basket in another tab",
      width,
      async () => {
        const p = concurrent.page;
        await basket(p);
        let release;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        let fetched;
        const captured = new Promise((resolve) => {
          fetched = resolve;
        });
        await p.route("**/*", async (route) => {
          if (
            route.request().method() === "POST" &&
            route.request().headers()["next-action"]
          ) {
            const response = await route.fetch();
            fetched();
            await bounded(gate, "Release delayed response");
            await route.fulfill({ response });
          } else await route.continue();
        });
        await p.getByRole("button", { name: "Reserve for 30 minutes" }).click();
        await bounded(captured, "Capture reservation response");
        const other = await concurrent.context.newPage();
        await other.goto(`${baseURL}/search?q=seclo&area=mirpur-10`);
        await add(other, /^Seclo 20mg/, "Tamanna Pharmacy");
        await other
          .getByRole("button", { name: "Start a new basket here", exact: true })
          .click();
        await expect
          .poll(() =>
            p.evaluate(
              () => JSON.parse(localStorage.getItem("mk-basket-v1")).pharmacyId,
            ),
          )
          .toBe("p-tamanna-mirpur");
        release();
        await expect(
          p.getByRole("heading", {
            name: "Reserved. Your pickup code is ready.",
          }),
        ).toBeVisible();
        assert.equal(
          await p.evaluate(
            () => JSON.parse(localStorage.getItem("mk-basket-v1")).pharmacyId,
          ),
          "p-tamanna-mirpur",
        );
        await p
          .getByRole("button", { name: "View current basket", exact: true })
          .click();
        await expect(p.locator("main")).toContainText("Tamanna Pharmacy");
        await layout(p, "preserved-basket", width);
      },
    );
    await concurrent.context.close();
  }

  // Advance only a separate server process to the day after the sample pending
  // licence expires. Normal app code and the main test server are unchanged.
  await fs.mkdir(".playwright-mcp", { recursive: true });
  const clockFile = path.resolve(".playwright-mcp/r1-fixed-clock.mjs");
  await fs.writeFile(
    clockFile,
    "Date.now=()=>Date.parse('2026-12-11T08:00:00Z');\n",
  );
  const clockURL = "http://localhost:3101";
  clockServer = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(clockFile).href,
      "node_modules/next/dist/bin/next",
      "start",
      "--port",
      "3101",
    ],
    { windowsHide: true, stdio: "pipe" },
  );
  let ready = false;
  for (let n = 0; n < 25; n++) {
    try {
      ready = (await fetch(clockURL, { signal: AbortSignal.timeout(2000) })).ok;
      if (ready) break;
    } catch {}
    await delay(200);
  }
  assert.equal(ready, true, "Fixed-date test server starts");
  for (const width of [375, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    try {
      await context.addCookies([
        {
          name: "mk_demo_session",
          value: "admin",
          url: clockURL,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      await run(
        "expired pending licence displays warning and disables approval",
        width,
        async () => {
          await page.goto(`${clockURL}/admin/pharmacies/p-rahman-banani`);
          await expect(page.locator("main")).toContainText(
            "The licence expired on 2026-12-10",
          );
          await expect(
            page.getByRole("button", { name: "Approve…", exact: true }),
          ).toBeDisabled();
          await expect(
            page.getByRole("button", { name: "Reject…", exact: true }),
          ).toBeEnabled();
          await layout(page, "expired-approval", width, true);
        },
      );
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(report.errors, [], "Browser console/page errors");
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  if (clockServer) clockServer.kill();
  await browser.close();
  await fs.writeFile(
    "docs/r1-browser-results.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `${report.checks.length} browser groups passed; ${report.errors.length} console/page errors`,
  );
}
