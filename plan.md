# MedKothay build plan

Deadline: 3 days from 18 November 2026. **Order (decided 18 Nov): UI first with sample data, then the backend, then wire them together.**

M0 → U1 → U2 → U3 → U4 → B1 → W1 → W2 → W3 → F

Each milestone after M0 is one branch (`feature/<id>-<name>`, for example `feature/u1-foundation`) merged by pull request. Follow the feature loop in `CLAUDE.md`. Tick a box only after it was checked in the running app and recorded in `docs/verification.md`.

## Rules for the UI-first phase (U1–U4)

- All screens read from **one sample-data module**, `lib/mock-data.js`. Its shapes match what the real Postgres functions will return (`docs/data-model.md`), so wiring later means replacing calls, not rewriting screens. No `fetch` or Supabase calls in U1–U4 except auth-free pages.
- Data access goes through small functions in `lib/data/` (for example `searchMedicine()`, `getMyReservations()`) that return mock data now and call Supabase in W1–W3. Screens never import `mock-data.js` directly.
- Forms and buttons behave fully (validation, pending state, success and error messages) but do not persist. Each mock action has a clearly marked `// TODO(W<n>)` for wiring.
- Customers see stock bands only, never numbers, even in mock data passed to the browser.
- Use the theme tokens from `CLAUDE.md` "Theme"; no hard-coded colours.
- Every step: `review-react-ui` + `vercel-react-best-practices`; Playwright MCP at 375 px and desktop; `code-reviewer` subagent; results in `docs/verification.md`.

## M0: Setup (18 Nov), done

- [x] Next.js 16 (JavaScript, App Router), Tailwind 4, shadcn/ui, Prettier
- [x] Supabase client helpers (`lib/supabase/`), `proxy.js` session refresh, `supabase/` folder
- [x] `.env.example`; `.env.local` gitignored
- [x] `/api/health` route
- [x] Agentic tooling: formatting hook, skills, three reviewer subagents, Playwright MCP
- [x] Hosted Supabase project created, `.env.local` filled, `npx supabase link` done
- [x] GitHub repo created and pushed
- [x] Vercel project deployed with env vars (https://med-kothay.vercel.app)

**Done when (all met 18 Nov 2026):** `npm run build` and `npm run lint` pass; `/api/health` returns `"supabase":"ok"` locally and on the Vercel URL; `/hooks` shows the PostToolUse hook and it fires on an edit; `/mcp` shows `playwright` connected; Playwright MCP has opened the local home page.

## U1: UI foundation

- [x] Blue theme tokens in `app/globals.css` (see `CLAUDE.md` "Theme")
- [x] Route groups `(customer)`, `(pharmacy)`, `(admin)` with layouts; header and navigation that work at 375 px
- [x] Shared components: stock band badge, verified badge, Rx badge, pickup code display, countdown, loading skeleton, error state, empty state
- [x] `lib/mock-data.js` (medicines, pharmacies, stock, reservations, sales) and `lib/data/` access functions
- [x] Sign-in page with the two choices ("I'm looking for medicine" / "I own a pharmacy") and the email field (no email sent yet)

**Done when:** every shared component appears on a temporary `/dev/components` page (removed in F); badges have text and pass contrast; header works at 375 px and desktop; lint and build pass.

## U2: Customer screens

- [ ] Home and search: brand or generic, location from the browser or area picker
- [ ] Results: shops sorted by distance with band, price, distance, verified and Rx badges; "none within 5 km" message with nearest shops further away; loading and error states
- [ ] Per-shop basket: add medicines (1–5 each); adding from another shop asks to start a new basket
- [ ] Reserve confirmation: pickup code and 30-minute countdown; short-item error example
- [ ] My reservations: items, status, cancel

**Done when:** a signed-out visitor can search and see results; the basket and reservation flow works end to end on mock data; 375 px has no horizontal scroll.

## U3: Pharmacy screens

- [ ] Registration form: shop details, area, location, phone, licence number, photo, expiry; field errors; "pending approval" state
- [ ] Dashboard: today's sales, low stock count, active reservations
- [ ] Inventory: list, add from catalog (quantity, price, expiry), edit and adjust
- [ ] Counter sale: search by brand or generic, add items, complete; "N units are reserved" block message
- [ ] Incoming reservations: items, countdown, enter pickup code, mark collected

**Done when:** each screen works on mock data, including the blocked-by-holds message and the wrong-pickup-code error.

## U4: Admin screens

- [ ] Pending pharmacies list
- [ ] Licence review: details and photo, approve, reject with a reason
- [ ] Minimal medicine catalog: list, add, edit

**Done when:** approve and reject flows work on mock data; the pending list empty state shows.

## B1: Backend (schema, RLS, stock functions, seed)

Decisions D1–D4 are confirmed in `docs/data-model.md` (role choice at sign-up; private licence bucket; geolocation or area picker with 5 km radius; multi-medicine reservations). Function return shapes must match `lib/mock-data.js`; if they cannot, change both and record why.

- [ ] Migrations for all tables in `CLAUDE.md` "Data model" (including `reservation_items`), with CHECK constraints and indexes
- [ ] `profiles` row created on sign-up (role `customer`); role and `pharmacy_id` not user-editable
- [ ] `register_pharmacy` function: creates the `pending` shop and makes the caller its pharmacist in one transaction (D1)
- [ ] Private `licences` Storage bucket with owner/admin policies (D2)
- [ ] RLS policies for every table; public stock band read for approved shops only; item tables scoped through their parent
- [ ] Functions: `search_medicine` (5 km + nearest-outside fallback), `reserve` (basket, all or nothing, lock order by `medicine_id`), `cancel_reservation`, `collect_reservation` (pickup code), `complete_sale`, lazy expiry
- [ ] Seed: ~100 Bangladeshi medicines, 6-8 Dhaka pharmacies (one pending), varied stock, area centre points

**Done when:** advisors clean; SQL tests per role pass, including: two customers racing for the last unit (exactly one succeeds); a basket where one item is short (nothing held, short item named); two overlapping baskets at once (no deadlock); a sale blocked by holds; a user cannot set their own role; `docs/data-model.md` matches the migrations.

## W1: Wire auth, registration and admin

- [ ] Email magic link sign-in and sign-out; auth callback with same-site redirect only; role-based redirects
- [ ] Registration form saves through `register_pharmacy` and uploads the licence photo
- [ ] Admin pending list, licence photo, approve and reject on real data; catalog on real data

**Done when:** demo loop steps 1–2 pass on the live site (register → pending → admin approves).

## W2: Wire inventory and counter sale

- [ ] Inventory add, edit and adjust on real data
- [ ] Counter sale through `complete_sale`; blocked-by-holds message from the real function
- [ ] Dashboard numbers from real data

**Done when:** demo loop step 3 passes; a sale beyond available stock is refused with the reserved count.

## W3: Wire search, reservations and collection

- [ ] Search through `search_medicine` with real distances
- [ ] Reserve, cancel and my reservations through the real functions
- [ ] Pharmacy incoming reservations and collect with the pickup code

**Done when:** demo loop steps 4–7 pass on the live site, as a customer, a pharmacist of the shop, and a pharmacist of another shop (who sees nothing).

## F: Demo loop and hand-in

- [ ] Remove `lib/mock-data.js`, the `/dev/components` page and every `TODO(W<n>)`
- [ ] The 7-step demo loop passes end to end on the deployed URL (Playwright MCP); screenshots
- [ ] `security-reviewer` and `requirements-reviewer` on the whole app; fix or record findings
- [ ] README: how to run, done/not done, agentic tools used and where
- [ ] Stretch (only if all above is done): AI prescription reading with Gemini
