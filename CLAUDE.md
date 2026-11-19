# MedKothay

A pharmacy stock finder for Bangladesh. Local pharmacies run their inventory here;
customers search across all of them to find which nearby shop actually has a
medicine, and reserve it for pickup.

**Build deadline: 3 days.** Prefer the simplest thing that works. Do not add
features, abstractions, or configuration that are not asked for.

---

## Core principle — read this before touching stock

**One inventory, two channels.** The counter sale and the online reservation
write to the same stock row. There is never a separate "online stock" or a
synced copy.

This is the whole idea of the product. If you are ever tempted to create a
second stock table for the customer side, stop — that is wrong.

---

## Stack

- Next.js (App Router) + JavaScript (`.js`/`.jsx`, no TypeScript)
- Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth, Row Level Security
- Deployed on Vercel

Versions: Next.js 16.4, React 19.3, Tailwind 4, shadcn/ui (base-nova style),
@supabase/ssr 0.12, Supabase CLI 3.2. Supabase is a hosted project (no Docker,
no local database).

**Next.js 16 is newer than your training data.** Read the relevant guide in
`node_modules/next/dist/docs/` before using an API you are unsure of (see
`AGENTS.md`). Known differences:
- Middleware is now `proxy.js` (root). It only refreshes the Supabase session; it
  is not authorization.
- Cache Components is **turned off** in `next.config.mjs` on purpose. Do not add
  `use cache` or turn it back on.

Supabase helpers: `lib/supabase/server.js` (Server Components, server actions),
`lib/supabase/client.js` (`"use client"` files), `lib/supabase/proxy.js`.

Web only. No React Native, no Expo, no mobile build. It must look correct on a
phone browser, so use Tailwind's responsive classes, but do not build a separate
mobile app.

---

## Hard rules

1. **Never put the Supabase `service_role` key in client code.** Use the `anon`
   key and let RLS enforce access. The service key may only appear in a server
   action or route handler, never in anything shipped to the browser.
   Env names: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the anon/publishable key;
   `SUPABASE_SECRET_KEY` is the service_role/secret key and must never get a
   `NEXT_PUBLIC_` prefix.
2. `.env.local` must be in `.gitignore` from the first commit.
3. **All stock changes go through a Postgres function in a transaction.** Never
   read a quantity in JavaScript, subtract, and write it back — two users will
   overwrite each other and the reservation logic will break.
4. Every pharmacy-owned table has a `pharmacy_id` column and an RLS policy.
5. Server Components by default. Add `"use client"` only where you need state or
   events.

---

## Scope

### Build these

**Accounts (decided 18 Nov 2026, D5)**
- **Email + password** (Supabase Auth). One `/sign-in` page with two tabs:
  **Sign in** (email, password; no role choice) and **Create account**.
- Create account: choose **"I'm looking for medicine"** (customer) or **"I own a
  pharmacy"**, then full name, email, password (8–72 characters), phone
  (Bangladeshi mobile, stored, not verified). Pharmacy accounts go on to the
  shop registration form (its fields are decided in U3).
- **One email = one account = one type.** The type is fixed at sign-up.
  **Pharmacy accounts cannot reserve medicines**; to buy for themselves an owner
  makes a separate customer account with another email.
- Messages never reveal what kind of account an email belongs to:
  "An account with this email already exists. Sign in instead." and
  "Email or password is incorrect."
- After sign-in: customer → search (or back to where they came from, e.g. the
  basket after Reserve), pharmacy → dashboard, admin → admin pages.
- Email confirmation is **off** for the demo. No "forgot password" for now.
- Admin is never offered; it is set once by hand with SQL

**Pharmacy**
- Register (step 2 of 2 after creating a pharmacy account; fields decided 18 Nov):
  shop name, address, area (from the list), map location (starts at the area
  centre; "use my current location" to adjust), shop phone, DGDA licence number,
  licence photo (JPEG/PNG/WebP, max 5 MB), licence expiry date
- **Status shown in the app and by email (D6):** the pharmacy dashboard shows a
  banner for pending / rejected (with the admin's reason) / approved. Two emails
  (from W1, via a Gmail app password set by the developer): "registration
  received, under review" on registering, and the approve/reject result. Email
  is best effort; a failed email never blocks the registration or decision.
- Status is `pending` until an admin approves; pending shops are invisible to customers
- A **rejected** shop can be corrected and resubmitted: the same shop row is
  updated (and its photo replaced), the reason is cleared and it returns to
  `pending` (D7)
- Inventory: add a medicine from the catalog with quantity, selling price, expiry date
- Edit and adjust stock
- Counter sale: search by brand or generic, add items, complete sale, stock deducts
- **A held reservation is blocked at the counter** — the pharmacist cannot sell
  stock that is on hold
- See incoming reservations with a countdown; mark one collected
- Simple dashboard: today's sales, low stock count, active reservations

**Customer**
- Browse, search and build a basket with no account
- Header for signed-out visitors: logo and "Sign in" only. "Basket" appears once
  it has items; "My reservations" only for a signed-in customer. The search box
  lives in the home page's blue box (no "Search" header link).
- Search a medicine, see nearby shops that have it, sorted by distance
- Each result: stock status, price, distance, verified badge, prescription-only badge
- Sign in (or create a customer account) is asked for only at **"Reserve"**
- Location from the browser, or an area picker if the customer declines
- Per-shop basket: add several medicines from the same shop, then reserve them
  together as **one reservation** with one 30-minute hold and one pickup code
- Cancel a reservation
- See own reservations with their status

**Admin**
- List pharmacies pending approval
- View licence details and photo, approve or reject with a reason
- Minimal master medicine catalog screen

### Do NOT build these

These are deliberately out of scope. If a prompt seems to ask for one, confirm first.

- Delivery, courier or Pathao integration
- Medicine requests ("nobody has it, post a request")
- Splitting an order across two pharmacies
- Reliability badges or shop ratings
- Batch-level tracking or FEFO — one stock row per medicine, one expiry date
- An inbox or notification centre — a status column is enough
- Alternative-medicine suggestions when out of stock
- CSV import
- Receipts or printing
- Shop open/closed toggle
- Licence auto-expiry jobs
- Customer credit, day-close, accounting, supplier purchasing
- SMS or phone OTP — email + password only (no magic links, no phone verification)
- Password reset / "forgot password" (for now)
- Pharmacy accounts reserving medicines

**Stretch goal, only after everything above works and is deployed:** AI
prescription reading. Upload a prescription image, send it to Google Gemini,
return a list of medicine names, let the user edit the list, then search.

---

## Data model

Use `snake_case` in Postgres, `camelCase` in JavaScript.

```
profiles
  id                uuid PK, references auth.users
  role              text  -- 'customer' | 'pharmacist' | 'admin'
  full_name         text
  phone             text
  pharmacy_id       uuid nullable, references pharmacies  -- set for pharmacists

pharmacies
  id                uuid PK
  name              text
  address           text
  area              text
  latitude          float8
  longitude         float8
  phone             text
  licence_number    text
  licence_photo_url text
  licence_expiry    date
  status            text  -- 'pending' | 'approved' | 'rejected'
  rejection_reason  text nullable
  created_at        timestamptz

medicines                       -- master catalog, shared by all pharmacies
  id                uuid PK
  brand_name        text
  generic_name      text
  manufacturer      text
  strength          text        -- e.g. '500mg'
  form              text        -- 'tablet' | 'capsule' | 'syrup' | 'injection'
  prescription_only boolean

pharmacy_stock                  -- one row per medicine per pharmacy
  id                uuid PK
  pharmacy_id       uuid references pharmacies
  medicine_id       uuid references medicines
  quantity          integer     -- total physical units on the shelf
  held_quantity     integer     -- units currently locked by active reservations
  selling_price     numeric
  expiry_date       date
  updated_at        timestamptz
  UNIQUE (pharmacy_id, medicine_id)

reservations                    -- one per basket: one shop, one pickup code
  id                uuid PK
  pharmacy_id       uuid references pharmacies
  customer_id       uuid references profiles
  pickup_code       text        -- 6 digits
  status            text        -- 'active' | 'collected' | 'cancelled' | 'expired'
  expires_at        timestamptz -- created_at + 30 minutes
  created_at        timestamptz

reservation_items               -- the medicines in a reservation
  id                uuid PK
  reservation_id    uuid references reservations
  medicine_id       uuid references medicines
  quantity          integer     -- 1 to 5
  unit_price        numeric     -- selling price copied when reserved (D8)
  UNIQUE (reservation_id, medicine_id)

sales                           -- counter sales
  id                uuid PK
  pharmacy_id       uuid references pharmacies
  total             numeric
  created_at        timestamptz

sale_items
  id                uuid PK
  sale_id           uuid references sales
  medicine_id       uuid references medicines
  quantity          integer
  unit_price        numeric
```

**The key derived value:**

```
available_quantity = quantity - held_quantity
```

This is what customers see and what the counter may sell. Never let it go negative.

---

## Business rules

**Stock display**
- `available_quantity = 0` → "Out of stock"
- `available_quantity` between 1 and 5 → "Low stock"
- `available_quantity` 6 or more → "In stock"
- Customers never see the exact number, only the band
- Customers never see purchase price (we do not store one)
- **Expired stock is unavailable (D9):** a row whose `expiry_date` is before
  today (Asia/Dhaka) counts as available 0 everywhere: hidden from search,
  cannot be reserved or sold. The owner sees it marked "Expired" and can edit it.
- **Unit follows the form (D11):** quantity and price are per tablet / capsule
  (one piece), per bottle (syrup) or per vial (injection), and every screen says
  so ("৳12 per tablet"). No separate unit column.

**Reservation**
- One reservation = one shop, one to 20 medicines (1 to 5 units each), one
  pickup code, one status. A basket can never mix shops.
- **Price check (D13):** reserving sends the prices the customer saw; if any
  changed, nothing is held and the customer confirms the new prices first.
- **Safe retry (D14):** each Reserve press carries a request id; the same id
  twice returns the same reservation instead of a second one.
- **At most 3 active reservations per customer (D15)**, enforced in the
  database with a clear message.
- Holding for 30 minutes from creation
- A 6-digit pickup code is generated on creation
- Creating a reservation increases `held_quantity` for every item; it does not
  change `quantity`
- **All or nothing:** it is created only if every item has
  `available_quantity >= requested quantity`. Otherwise nothing is held and the
  customer is told which item is short.
- Each item stores the price at the moment of reserving (`unit_price`, D8); a
  later price change does not alter an existing reservation
- Collection applies to the whole reservation: for every item, decrease both
  `quantity` and `held_quantity`. No partial pickup.
- Cancellation or expiry applies to the whole reservation: decrease
  `held_quantity` only
- If two customers reserve the last unit at the same moment, exactly one succeeds.
  Enforce this in the Postgres function with `SELECT ... FOR UPDATE`, not in JavaScript.
  Lock all of a reservation's stock rows **in a fixed order (by `medicine_id`)**
  so two overlapping baskets cannot deadlock.
- Expiry is checked lazily: treat a reservation as expired when `expires_at` has
  passed. Do not write a cron job.
- **Every** stock function (reserve, counter sale, collect, cancel, and the
  search read) first releases this pharmacy's expired holds for the rows it
  touches, in the same transaction, so a displayed "Expired" and the sellable
  count always agree (D10)

**Counter sale**
- The pharmacist may only sell up to `available_quantity`
- A sale decreases `quantity`, never `held_quantity`
- If a pharmacist tries to sell stock that is on hold, show a clear message
  saying how many units are reserved

**Visibility**
- Only `status = 'approved'` pharmacies **whose licence has not expired**
  (`licence_expiry` on or after today, Asia/Dhaka) appear in customer search.
  Checked on every read, not by a background job (D12)
- Pending and rejected pharmacies are invisible to customers but their owners can
  still sign in and prepare their inventory

**Search**
- Match on both brand name and generic name
- Sort results by distance ascending
- Location: browser geolocation, or the centre of an area the customer picks
- Radius 5 km. If no shop within it has the medicine, say so and show the
  nearest **3 distinct pharmacies** further away (with all their matching
  medicines), clearly labelled as outside 5 km (D16)

---

## Distance

Do not enable PostGIS. Store `latitude` and `longitude` as `float8` and compute
Haversine distance inside the search function in SQL. It is accurate enough for
a city and avoids an extension.

---

## Roles and access

| Role | Can do |
|---|---|
| anonymous | Search medicines, see approved pharmacies and stock bands |
| customer | The above, plus create and cancel own reservations |
| pharmacist | Manage own pharmacy's stock, sales and reservations only |
| admin | Approve or reject pharmacies, manage the medicine catalog |

**How roles are assigned (D1, revised by D5).** Sign-up sends an account type
(`customer` or `pharmacy`) with the email and password. A database trigger on
`auth.users` creates the `profiles` row and maps that type to `role = 'customer'`
or `role = 'pharmacist'` (with `pharmacy_id` null); **any other value, including
`admin`, becomes `customer`**. This is the only time user-supplied metadata is
read, and only these two self-selectable, non-privileged values are accepted.
The pharmacy registration function then creates the `pending` pharmacy and sets
`pharmacy_id`; it accepts only a `pharmacist` without a pharmacy. Users can never
update their own `role` or `pharmacy_id` afterwards. Reservation functions accept
only `customer` callers. The admin role is set once by hand with SQL.

**Licence photos** live in a private Storage bucket. Only the shop's own
pharmacist (upload, read) and admins (read) can access them. Images only (JPEG,
PNG, WebP), max 5 MB.

RLS must enforce that a pharmacist can only read and write rows where
`pharmacy_id` matches the `pharmacy_id` on their profile. Do not rely on the UI
to hide other shops' data.

Public read on `pharmacy_stock` must expose only approved pharmacies, and the
client must never be able to select exact quantities — expose a view or compute
the band in the query.

---

## Seed data

Create a seed script. The demo depends entirely on this looking real.

- Around 100 real Bangladeshi medicines: Napa, Napa Extra, Seclo, Monas 10,
  Maxpro, Fexo 120, Ace, Sergel, Antazol, Alatrol, Amodis, Azithrocin, and so on,
  with correct manufacturers (Square, Beximco, Incepta, Renata, Opsonin, ACI)
- 6 to 8 pharmacies with real Dhaka area names (Dhanmondi, Mirpur 10, Uttara
  Sector 7, Bashundhara, Mohakhali, Banani) and plausible coordinates
- Stock spread so the demo has variety: some medicines in one shop only, some
  out of stock, some at exactly 1 to 5 units so the "Low stock" band shows
- One pharmacy left in `pending` status so the admin approval screen has
  something to approve

---

## The demo loop

This must work end to end before anything else is added:

1. A pharmacy registers and is `pending`
2. An admin approves it
3. The pharmacy adds stock
4. A customer searches a medicine and sees that shop, sorted by distance
5. The customer reserves one or more medicines from that shop in one basket and
   gets a pickup code
6. The pharmacist sees the reservation and cannot sell that unit at the counter
7. The pharmacist marks it collected and the stock drops

Test this path after every significant change.

---

## Conventions

- `app/` for routes, `components/` for shared UI, `lib/` for Supabase clients and
  helpers, `supabase/` for SQL migrations and the seed script
- Separate route groups for the three surfaces: `(customer)`, `(pharmacy)`, `(admin)`
- Keep Postgres functions in versioned SQL files, not typed into the dashboard
- Prefer server actions over API routes
- No state management library; Server Components and `useState` are enough
- Handle loading and error states on every data screen — a demo that shows a
  blank page while loading looks broken

## Theme (decided 18 Nov 2026)

White and blue, light mode only. Set the colours once as shadcn CSS variables in
`app/globals.css` (in M2) and use the tokens; never hard-code hex values in
components.

| Token / use | Colour |
|---|---|
| Primary (buttons, links, header, verified check) | deep blue `#0B5CAD` |
| Page background | blue-white `#F5F8FF`; cards white |
| Accent (pickup code, countdown only) | amber `#F59E0B` |
| In stock / Low stock / Out of stock | green / amber / grey |
| Prescription only ("Rx") | purple |
| Errors | red |

Every badge has text as well as colour (never colour alone). Text must meet
WCAG AA contrast on its background.

---

## Commands

Only commands that have been run successfully are listed.

```bash
npm install          # install dependencies
npm run dev          # local dev server on http://localhost:3000
npm run build        # must pass before every deploy and merge
npm run lint         # ESLint
npx prettier --write <paths>   # format (the hook does this on Claude's edits)
```

Supabase CLI (project linked to hosted ref `gkzqlpaknytdvbbknaxp`). **CLI v3
targets a local Docker database by default; there is none here, so always pass
`--remote`** for database commands:

```bash
npx supabase migration list --remote   # applied migrations on the hosted DB
```

Not yet run (move up once they work): `npx supabase migration new <name>`,
`npx supabase db push` (apply migrations),
`npx supabase db advisors --remote` (security/performance checks).

- Health check: `GET /api/health` → 200 with `"supabase":"ok"` when env vars are
  set and Supabase is reachable.
- Env: copy `.env.example` to `.env.local` (gitignored). Never print or commit keys.
- In Git Bash, backslashes in arguments to Windows programs get mangled; put such
  code in a script file instead of `node -e`.

Deploy to Vercel on day one with a blank page, before building features. Do not
leave deployment until the end.

---

## Docs and reading order

1. This file: product, rules, scope.
2. `plan.md`: milestones, the active milestone's tasks and "done when" checks.
3. `docs/STATUS.md`: current progress and the next task.
4. `docs/data-model.md`: the schema as built (update it with every migration).
5. `docs/verification.md`: observed results and the usage logs.

Do not invent product behaviour or claim unverified work is done. If these files
conflict, stop, describe the conflict, and fix the plan before coding.

---

## Agentic workflow: plan → implement → verify

Tools in this project:
- **Hook:** PostToolUse on `Edit|Write` runs `.claude/hooks/format-changed.cjs`
  (Prettier on `app/`, `components/`, `lib/`, `supabase/`, `proxy.js`).
- **Skills** (general + project pair; the project skill and this file win
  conflicts, raised with the developer):
  - Planning: `grill-me` (user types `/grill-me`) or `grilling`
  - Database (schema, RLS, functions, seed): `supabase-postgres-best-practices`
    and `supabase`, plus project `review-supabase-model`
  - UI (pages, components, forms, server actions): `vercel-react-best-practices`,
    plus project `review-react-ui`. Skip its Cache Components rules.
  - External skills are pinned in `skills-lock.json`; update them with
    `npx skills update`, never by editing their files.
- **Subagents** (read-only, `.claude/agents/`): `code-reviewer`,
  `security-reviewer`, `requirements-reviewer`.
- **MCP:** Playwright (`.mcp.json`) for browser checks.

For each milestone:
1. **Plan:** short plan (plan mode, or `grill-me` for big ones). Confirm acceptance
   criteria and the stock and access rules it touches. Write decisions into
   `plan.md` / `docs/data-model.md` before coding.
2. **Implement** one vertical slice. Run `npm run lint` and `npm run build`.
3. **Review with skills:** database work → `review-supabase-model` +
   `supabase-postgres-best-practices`; UI work → `review-react-ui` +
   `vercel-react-best-practices`.
4. **Verify in the browser** with Playwright MCP (signed out, customer,
   pharmacist of shop A and of shop B, admin; 375 px and desktop).
5. **Review with subagents** before merging: `code-reviewer` every milestone;
   `security-reviewer` when RLS, functions, auth, uploads or public pages changed;
   `requirements-reviewer` against Scope and the demo loop. Verify each finding
   before fixing it.
6. **Record** in `docs/verification.md` the same session: results, a row in the
   Skill usage log for every skill run, a row in the Subagent usage log for every
   subagent run, and a row in the Issues and corrections log whenever something
   goes wrong (what, who caused it — Claude, developer or tool — how detected,
   fix). Then update `docs/STATUS.md` and tick `plan.md`.

## Git workflow

- `main` always builds and runs. After M0, never commit feature code directly
  to `main`; docs-only commits may go to `main`.
- One branch per milestone from an up-to-date `main`: `feature/<id>-<short-name>`
  (ids from `plan.md`: u1–u4, b1, w1–w3, f).
- Build order is UI first on sample data, then backend, then wiring (see
  `plan.md`). Screens get data only through `lib/data/`, never from
  `lib/mock-data.js` directly.
  Small commits, one task at a time.
- Before merging: `npm run lint` and `npm run build` pass, the Playwright check
  and the reviews are done and recorded, "done when" boxes ticked.
- Merge through a pull request (`gh pr create` / `gh pr merge`). Record the PR and
  merge commit in `docs/verification.md`, then delete the branch.
- Never force-push to `main` or rewrite published history.

## Definition of done

Done means: acceptance criteria checked in the running app, lint and build pass,
and the docs state what was observed. Record failures and unfinished work
truthfully. Never fabricate a tool run, test result or screenshot.
