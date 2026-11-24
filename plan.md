# MedKothay build plan

Deadline: 3 days from 18 November 2026. **Order (decided 18 Nov): UI first with sample data, then the backend, then wire them together.**

M0 → U1 → U1b → U2 → U3 → U4 → R1 → B1 → W1 → W2 → W3 → F

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
- [x] Sign-in page with the two choices ("I'm looking for medicine" / "I own a pharmacy") and the email field (no email sent yet). Replaced in U1b by email + password (D5)

**Done when:** every shared component appears on a temporary `/dev/components` page (removed in F); badges have text and pass contrast; header works at 375 px and desktop; lint and build pass.

## U1b: Header and accounts UI (developer feedback, 18 Nov)

- [x] Header: signed out shows logo + "Sign in" only; no "Search" link; "My reservations" only for a signed-in customer; "Basket" left for U2 (appears once it has items)
- [x] `/sign-in` with tabs **Sign in** (email, password) and **Create account** (type choice, full name, email, password, phone)
- [x] Server-side validation and neutral messages ("An account with this email already exists. Sign in instead." / "Email or password is incorrect."); pharmacy sign-up continues to `/pharmacy/register`
- [x] `lib/data/session.js` (current user, signed out until W1) and `lib/data/auth.js` (mock sign-in/sign-up against sample accounts)
- [x] Home: pharmacy call-to-action opens "Create account" with "I own a pharmacy" chosen

**Done when:** a signed-out visitor sees no Basket/My reservations/Search links; both tabs validate on the server; a known sample email on sign-up shows the neutral "already exists" message; wrong password shows the neutral message; 375 px and 1280 px pass; lint and build pass.

## U2: Customer screens

- [x] Home and search: brand or generic, location from the browser or area picker
- [x] Results: shops sorted by distance with band, price, distance, verified and Rx badges; "none within 5 km" message with nearest shops further away; loading and error states
- [x] Per-shop basket: add medicines (1–5 each); adding from another shop asks to start a new basket
- [x] Reserve confirmation: pickup code and 30-minute countdown; short-item error example
- [x] My reservations: items, status, cancel

**Done when:** a signed-out visitor can search and see results; the basket and reservation flow works end to end on mock data; 375 px has no horizontal scroll. **Met 18 Nov** (Playwright U2 runs 1–2). New reservations and cancellations are not saved until W3; a demo session cookie stands in for sign-in until W1.

## U3: Pharmacy screens

Fields and status decided 18 Nov (D6). A second demo pharmacy account without a shop (`newpharmacy@medkothay.test`) shows the registration flow.

- [x] Registration form (step 2 of 2): shop name, address, area, map location, shop phone, DGDA licence number, licence photo, licence expiry; field errors; "received, under review, we will email you" confirmation
- [x] Dashboard status banner: pending / rejected with reason / approved (D6)
- [x] Dashboard: today's sales, low stock count, active reservations
- [x] Inventory: list, add from catalog (quantity, price, expiry), edit and adjust
- [x] Counter sale: search by brand or generic, add items, complete; "N units are reserved" block message
- [x] Incoming reservations: items, countdown, enter pickup code, mark collected

**Done when:** each screen works on mock data, including the blocked-by-holds message and the wrong-pickup-code error. **Met 18 Nov** (Playwright U3 runs 1–6). Not saved until W1–W3: registration, stock edits, sales, collection; since 19 Nov, Create account continues straight to step 2 (demo session until W1).

## U4: Admin screens

- [x] Pending pharmacies list
- [x] Licence review: details and photo, approve, reject with a reason
- [x] Minimal medicine catalog: list, add, edit

**Done when:** approve and reject flows work on mock data; the pending list empty state shows. **Met 19 Nov** (Playwright U4 runs 1–4; the empty state is reached by searching the pending tab, because decisions are not saved until W1).

## R1: Workflow review changes (UI, before B1)

From the external workflow reviews of the pharmacy, customer and admin sides (all accepted 19 Nov; decisions D7–D21).

**19 Nov continuation:** all items below are implemented and verified on sample data. Following the user's authorization to use Playwright directly after browser-host failures, 48 real Chrome journey groups passed at 375/1280, with 13 deterministic data/action groups and lint/build also passing. Final browser QA caught and fixed a shrinking phone area picker. Reviews and evidence are in `docs/verification.md`; database guarantees remain B1/W1–W3 work.

- [x] "Expired" badge in owner inventory; expired rows shown as unavailable (D9)
- [x] Unit wording everywhere: "per tablet / capsule / bottle / vial" (D11)
- [x] Resubmit flow wording for rejected and expired-licence shops (D7, D12)
- [x] Wording fixes from the review (photo hint, "Shop location", Rx check, missing medicine, Verified tooltip)
- [x] Customer review: Rx list + whole-basket note before Reserve; "Nothing has been reserved"; "Pick up by HH:MM"; Expired on the confirmation screen; Call and Directions; coverage and area-centre distance wording; new-basket, add-another and search-again links; soonest-to-expire first; Bangla digits in phone numbers; trusted-person pickup note
- [x] Price-changed confirmation in the basket (D13) and request id on Reserve (D14), on sample data; 3-active limit message (D15); fallback = 3 distinct shops (D16)
- [x] Admin review: Approve confirmation with shop + licence number; checklist above the decision; expired licence refused (D17); Suspend with reason on approved shops, owner banner and resubmit, customer reservations shown cancelled "pharmacy unavailable" (D18); duplicate-licence warning (D19); "used by N pharmacies" confirm on catalog edits (D20); location source and previous rejection reason on the review page (D21); best-effort email wording

## B1: Backend (schema, RLS, stock functions, seed)

Decisions D1–D4 are confirmed in `docs/data-model.md` (role choice at sign-up; private licence bucket; geolocation or area picker with 5 km radius; multi-medicine reservations). Function return shapes must match `lib/mock-data.js`; if they cannot, change both and record why.

**19 Nov continuation:** all B1 implementation items are applied to the linked Supabase project. Eighteen live integration groups, security advisors, lint and build pass, and temporary fixtures were removed. The required code, security and requirements subagents could not start after the Claude account reached its usage limit; the developer explicitly waived that review gate to meet the deadline.

- [x] Migrations for all tables in `CLAUDE.md` "Data model" (including `reservation_items`), with CHECK constraints and indexes
- [x] `profiles` row created by an `auth.users` trigger from the sign-up account type (`customer` → customer, `pharmacy` → pharmacist, anything else → customer; D5); `full_name` and `phone` saved; role and `pharmacy_id` not user-editable
- [x] Reservation functions refuse non-customer callers (pharmacy accounts cannot reserve)
- [x] Admin review (D17–D21): `approve_pharmacy` refuses an expired licence; `suspend_pharmacy(id, reason)` (admin, approved only) cancels the shop's active reservations and releases holds in one transaction; status CHECK includes 'suspended' and search excludes it; `licence_number_normalized` + index and a duplicate lookup; medicines stock-usage count for the edit warning; columns `submitted_at`, `reviewed_at`, `reviewed_by`, `previous_rejection_reason`, `location_source`; seed includes a pending shop with a near-expiry licence
- [x] Customer review (D13–D16): `reserve(p_pharmacy_id, p_items with expected unit prices, p_request_id)` returns new prices without holding if any changed; unique `(customer_id, client_request_id)` returns the existing reservation on retry; max 3 active per customer after lazy expiry; `search_medicine` fallback = nearest 3 distinct pharmacies
- [x] Workflow review (D7–D12): `resubmit_pharmacy` RPC (same row, back to pending, owner only, rejected only); `reservation_items.unit_price` set in `reserve`; expired stock (expiry_date < today Dhaka) = available 0 in search, reserve and sale; every stock function releases expired holds first; search excludes shops with expired licences
- [x] Admin (security review U4): privileged implementations use `SECURITY DEFINER`, `search_path = ''`, check `auth.uid()` internally and are kept in the unexposed `private` schema; public wrappers are `SECURITY INVOKER`. Approval/rejection require pending status, reasons are 10–300 characters, anonymous execution is revoked, catalog writes are admin-only, and identity/location/phone constraints are enforced.
- [x] Sign-up trigger (security review, U1b): `SECURITY DEFINER`, `SET search_path = ''`, INSERT only; reads **only** `account_type` (exactly `'pharmacy'` → pharmacist, anything else → customer), `full_name` (length-capped) and `phone` (format-checked) from metadata; never copies `role`, `pharmacy_id` or `status`; no `user_metadata` anywhere in RLS
- [x] `register_pharmacy` locks the caller's profile (`FOR UPDATE`) so two concurrent calls create one shop; reservation functions check `role = 'customer'` (not `<> 'pharmacist'`); `REVOKE EXECUTE ... FROM PUBLIC, anon` on every RPC that needs a signed-in user; no pharmacy policy uses `coalesce`/`IS NOT DISTINCT FROM` on `pharmacy_id` (a pharmacist without a shop must see nothing)
- [x] `register_pharmacy` function: creates the `pending` shop and sets the caller's `pharmacy_id` in one transaction; accepts only a pharmacist without a pharmacy (the role itself comes from the sign-up trigger, D5)
- [x] Private `licences` Storage bucket with owner/admin policies (D2)
- [x] RLS policies for every table; public stock band read for approved shops only; item tables scoped through their parent
- [x] Functions: `search_medicine` (5 km + nearest-outside fallback), `reserve` (basket, all or nothing, lock order by `medicine_id`), `cancel_reservation`, `collect_reservation` (pickup code), `complete_sale`, lazy expiry
- [x] Seed: ~100 Bangladeshi medicines, 6-8 Dhaka pharmacies (one pending), varied stock, area centre points

**Done when:** advisors clean; SQL tests per role pass, including: two customers racing for the last unit (exactly one succeeds); a basket where one item is short (nothing held, short item named); two overlapping baskets at once (no deadlock); a sale blocked by holds; a user cannot set their own role; an expired hold is released before a sale of those units; expired stock is not found by search and cannot be reserved or sold; a shop with a past licence_expiry is not in search; a price change after reserving does not change the reservation's total; a reserve with outdated prices holds nothing; the same request id twice gives one reservation; a 4th active reservation is refused; the fallback lists 3 distinct shops; approving an expired licence is refused; suspending a shop removes it from search and cancels its active reservations with their holds released; a direct `/auth/v1/signup` with `{account_type:'admin', role:'admin', pharmacy_id:…}` gives a `customer` with no pharmacy; a pharmacist calling `reserve` is refused; two concurrent `register_pharmacy` calls give one shop; `docs/data-model.md` matches the migrations.

## W1: Wire auth, registration and admin

- [x] Email + password sign-in, sign-up (with account type, name, phone) and sign-out via Supabase Auth; email confirmation turned off in the dashboard; role-based redirects (customer → search, pharmacy → dashboard, admin → admin); same-site `next` redirects only — _observed locally 20 Nov (W1 browser, W1 decisions); confirmation off confirmed via `config diff` and an auto-confirmed account_
- [ ] Account menu with "Sign out" in every area header (code review, U1b); on customer pages a signed-in pharmacist or admin sees a link back to their own area — _Sign out observed in the pharmacy area; the link back is in `components/account-controls.jsx` but was not browser-checked_
- [x] Auth hardening (security review, U1b): map every Supabase sign-in/sign-up error to the neutral messages (never show raw Supabase text); confirm Supabase Auth rate limits; any `?next=` return path must be a same-origin path (starts with `/`, not `//`, no ``, no scheme); every protected page and action checks `getClaims`/role on the server, not only in `proxy.js`; remove `mockAccounts` and the mock auth path — _neutral messages observed; rate limits 30 sign-ins/sign-ups per 5 min per IP (`config diff`); `mockAccounts` removed; security review 20 Nov clean_
- [x] Registration form saves through `register_pharmacy` and uploads the licence photo — _observed, plus reject → resubmit of the same shop_
- [x] Admin pending list, licence photo, approve and reject on real data; catalog on real data — _observed, plus suspend_
- [x] Admin hardening (security review U4): validate ids as UUIDs before calling Supabase (generic error, no raw Postgres text); licence photo shown via a short-lived signed URL from an admin-only storage policy; escape the rejection reason in the HTML email — _the email is plain text, so there is no HTML to escape; signed URL lasts 300 s_
- [ ] Emails (D6): "registration received" and the approve/reject result via Gmail app password (developer sets `GMAIL_USER`/`GMAIL_APP_PASSWORD` in `.env.local` and Vercel as Secret); best effort — _code done (plain text, 5 s timeouts); the developer keeps the credentials local only (20 Nov), so no live email; no real send recorded yet_

**Done when:** demo loop steps 1–2 pass on the live site (register → pending → admin approves). — _Met on the live site 20 Nov (W1 7/7, W1 decisions 7/7 with `APP_URL`)._

## W2: Wire inventory and counter sale

- [x] Inventory add, edit and adjust on real data — _add observed in the browser; edits go through `save_stock`, which refuses stale forms and quantities below held (verify-b1)_
- [x] Counter sale through `complete_sale`; blocked-by-holds message from the real function — _observed: "1 unit is reserved for pickup"_
- [x] Dashboard numbers from real data — _today's sale observed_

**Done when:** demo loop step 3 passes; a sale beyond available stock is refused with the reserved count. — _Met on the live site 20 Nov (W2/W3 8/8)._

## W3: Wire search, reservations and collection

- [x] Search through `search_medicine` with real distances — _observed at 375 px; the fallback of 3 shops outside 5 km is verified in the database (verify-b1), not clicked in the browser_
- [x] Reserve, cancel and my reservations through the real functions — _reserve and My reservations observed; customer cancel verified through the RPC (verify-b1), not clicked in the browser_
- [x] Pharmacy incoming reservations and collect with the pickup code — _observed, including a wrong code refused and stock 3 → 2_
- [x] Pickup code (security review U3): generated in the database with pgcrypto `gen_random_bytes`; checked inside `collect_reservation`; lock the reservation (or require a new code) after ~5 wrong attempts; same generic error for wrong code and wrong reservation — _implemented as `collect_pickup` (the old function is revoked); locks after 5; `no_match` for both; the code is hidden from table reads_

**Done when:** demo loop steps 4–7 pass on the live site, as a customer, a pharmacist of the shop, and a pharmacist of another shop (who sees nothing). — _Met on the live site for all three roles 20 Nov (W2/W3 8/8)._

## F: Demo loop and hand-in

- [ ] Remove `lib/mock-data.js`, the `/dev/components` page and every `TODO(W<n>)`
- [ ] The 7-step demo loop passes end to end on the deployed URL (Playwright MCP); screenshots
- [ ] `security-reviewer` and `requirements-reviewer` on the whole app; fix or record findings
- [ ] README: how to run, done/not done, agentic tools used and where
- [ ] Stretch (only if all above is done): AI prescription reading with Gemini — _moved before F as S1 by the developer (24 Nov)_

## S1: AI prescription reading (stretch, moved before F)

**Decided 24 Nov (developer):** the developer moved this ahead of F, accepting that F is still open; all of W1–W3 is live. Signed-in **customers only**, with a daily limit per account enforced in the database (paid API, bots). The developer's own Gemini key goes in `GEMINI_API_KEY`: server only, `.env.local` and later a Vercel secret, never `NEXT_PUBLIC_`. Output is an editable list with one normal search per name; there is no multi-medicine search.

- [x] `/prescription` page (customer area, works at 375 px), linked from the home page's blue search box: upload one photo (JPEG/PNG/WebP, ≤ 5 MB, checked by content like the licence photo)
- [x] Server action sends the image to Gemini with a fixed JSON response format and returns medicine names (brand or generic, strength if written). **The photo is never stored**: no Storage, no database row, no logging of the image or the names; the page says so
- [x] Each name is checked against `medicines` (brand or generic, case-insensitive): "In our catalog" or "Not in our catalog"; the customer can edit, remove and add names, and each has a Search link (`/search?q=…`; search then asks for a location as usual)
- [x] Daily limit: a `prescription_reads` table (customer id and time only, RLS on, no client access) and a function that allows at most **10 reads per customer per Dhaka day**; a clear message when it is reached
- [ ] Errors: no key configured → "Prescription reading isn't available right now"; unreadable photo or no medicines found → say so and offer typing names; Gemini failure or timeout → generic retry message, never raw API text — _no-key, nothing-found and limit paths are in the code; only the limit and Gemini fallback (503/504 → next model) were observed_
- [x] Not medical advice: the page says to check the list against the prescription; nothing is reserved automatically

**Done when:** a signed-in customer uploads a test prescription image on the live site, sees the medicine names, edits the list and searches one; a signed-out visitor is asked to sign in; a pharmacist cannot use it; the 11th read in a day is refused. — _Met locally 24 Nov (verify-s1-browser 6/6, one real Gemini read in 8 s). **Live site not done:** needs `GEMINI_API_KEY` in Vercel (developer decision) and a merge._
