# MedKothay build plan

Deadline: 3 days from 18 November 2026. Each milestone is one branch (`feature/m<N>-<name>`) merged by pull request, except M0. Follow the feature loop in `CLAUDE.md`. Tick a box only after it was checked in the running app and recorded in `docs/verification.md`.

## M0: Setup (18 Nov)

- [x] Next.js 16 (JavaScript, App Router), Tailwind 4, shadcn/ui, Prettier
- [x] Supabase client helpers (`lib/supabase/`), `proxy.js` session refresh, `supabase/` folder
- [x] `.env.example`; `.env.local` gitignored
- [x] `/api/health` route
- [x] Agentic tooling: formatting hook, skills, three reviewer subagents, Playwright MCP
- [x] Hosted Supabase project created, `.env.local` filled, `npx supabase link` done
- [x] GitHub repo created and pushed
- [x] Vercel project deployed with env vars (https://med-kothay.vercel.app)

**Done when:** `npm run build` and `npm run lint` pass; `/api/health` returns `"supabase":"ok"` locally and on the Vercel URL; `/hooks` shows the PostToolUse hook and it fires on an edit; `/mcp` shows `playwright` connected; Playwright MCP has opened the local home page.

## M1: Schema, RLS, stock functions, seed

- [ ] Migrations for all tables in `CLAUDE.md` "Data model", with CHECK constraints and indexes
- [ ] `profiles` row created on sign-up (role `customer`); role and `pharmacy_id` not user-editable
- [ ] RLS policies for every table; public stock band read for approved shops only
- [ ] Functions: `search_medicine`, `reserve_stock`, `cancel_reservation`, `collect_reservation`, `complete_sale`, lazy expiry
- [ ] Seed: ~100 Bangladeshi medicines, 6-8 Dhaka pharmacies (one pending), varied stock

**Done when:** advisors clean; SQL tests per role pass, including the two-customers-last-unit race (exactly one succeeds) and a sale blocked by holds; `docs/data-model.md` matches the migrations.

## M2: Auth and pharmacy registration

- [ ] Email magic link sign-in and sign-out; auth callback with same-site redirect only
- [ ] Pharmacy registration form (shop details, licence number, photo upload to a private bucket, expiry) → `pending`
- [ ] Role-based redirects for `(customer)`, `(pharmacy)`, `(admin)`

## M3: Admin

- [ ] Pending list, licence details and photo, approve, reject with reason
- [ ] Minimal medicine catalog screen

## M4: Pharmacy inventory and counter sale

- [ ] Add medicine from catalog with quantity, price, expiry; edit and adjust
- [ ] Counter sale by brand or generic; blocked by holds with the reserved count shown

## M5: Customer search and reservation

- [ ] Search by brand or generic, nearby approved shops sorted by distance, bands and badges, "none nearby" message
- [ ] Reserve with 30-minute hold and pickup code; cancel; my reservations with status

## M6: Pharmacy reservations and dashboard

- [ ] Incoming reservations with countdown; mark collected with pickup code
- [ ] Dashboard: today's sales, low stock count, active reservations

## M7: Demo loop and hand-in

- [ ] The 7-step demo loop passes end to end on the deployed URL (Playwright MCP)
- [ ] README: how to run, done/not done, agentic tools used and where
- [ ] Stretch (only if all above is done): AI prescription reading with Gemini
