# MedKothay build plan

Deadline: 3 days from 18 November 2026. Each milestone is one branch (`feature/m<N>-<name>`) merged by pull request, except M0. Follow the feature loop in `CLAUDE.md`. Tick a box only after it was checked in the running app and recorded in `docs/verification.md`.

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

## M1: Schema, RLS, stock functions, seed

Decisions D1–D4 are confirmed in `docs/data-model.md` (role choice at sign-up; private licence bucket; geolocation or area picker with 5 km radius; multi-medicine reservations).

- [ ] Migrations for all tables in `CLAUDE.md` "Data model" (including `reservation_items`), with CHECK constraints and indexes
- [ ] `profiles` row created on sign-up (role `customer`); role and `pharmacy_id` not user-editable
- [ ] `register_pharmacy` function: creates the `pending` shop and makes the caller its pharmacist in one transaction (D1)
- [ ] Private `licences` Storage bucket with owner/admin policies (D2)
- [ ] RLS policies for every table; public stock band read for approved shops only; item tables scoped through their parent
- [ ] Functions: `search_medicine` (5 km + nearest-outside fallback), `reserve` (basket, all or nothing, lock order by `medicine_id`), `cancel_reservation`, `collect_reservation` (pickup code), `complete_sale`, lazy expiry
- [ ] Seed: ~100 Bangladeshi medicines, 6-8 Dhaka pharmacies (one pending), varied stock, area centre points

**Done when:** advisors clean; SQL tests per role pass, including: two customers racing for the last unit (exactly one succeeds); a basket where one item is short (nothing held, short item named); two overlapping baskets at once (no deadlock); a sale blocked by holds; a user cannot set their own role; `docs/data-model.md` matches the migrations.

## M2: Auth and pharmacy registration

- [ ] Sign-in page with two choices ("I'm looking for medicine" / "I own a pharmacy"); email magic link; sign-out; auth callback with same-site redirect only
- [ ] Pharmacy registration form (shop details, licence number, photo upload to a private bucket, expiry) → `pending`
- [ ] Role-based redirects for `(customer)`, `(pharmacy)`, `(admin)`

## M3: Admin

- [ ] Pending list, licence details and photo, approve, reject with reason
- [ ] Minimal medicine catalog screen

## M4: Pharmacy inventory and counter sale

- [ ] Add medicine from catalog with quantity, price, expiry; edit and adjust
- [ ] Counter sale by brand or generic; blocked by holds with the reserved count shown

## M5: Customer search and reservation

- [ ] Location from the browser or an area picker
- [ ] Search by brand or generic, approved shops within 5 km sorted by distance, bands and badges; "none within 5 km" message with nearest shops further away
- [ ] Per-shop basket (add several medicines, 1–5 each; adding from another shop starts a new basket)
- [ ] Reserve the basket: one 30-minute hold and one pickup code; short-item error names the medicine; cancel; my reservations with items and status

## M6: Pharmacy reservations and dashboard

- [ ] Incoming reservations with their items and a countdown; mark the whole reservation collected with the pickup code
- [ ] Dashboard: today's sales, low stock count, active reservations

## M7: Demo loop and hand-in

- [ ] The 7-step demo loop passes end to end on the deployed URL (Playwright MCP)
- [ ] README: how to run, done/not done, agentic tools used and where
- [ ] Stretch (only if all above is done): AI prescription reading with Gemini
