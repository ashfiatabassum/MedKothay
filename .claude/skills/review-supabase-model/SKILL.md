---
name: review-supabase-model
description: Design or review MedKothay's Supabase/Postgres schema, migrations, RLS policies, views and stock functions (reserve, sell, collect, cancel, search). Use for any change under supabase/ or any query that touches stock, reservations, sales or pharmacy approval.
---

# Review Supabase model (MedKothay)

Pair this with the general `supabase-postgres-best-practices` and `supabase` skills. When they conflict with this skill or `CLAUDE.md`, raise the conflict with the developer instead of resolving it silently.

Read `CLAUDE.md` ("Core principle", "Hard rules", "Data model", "Business rules", "Roles and access") and `docs/data-model.md`. Inspect existing files in `supabase/migrations/` before proposing changes.

## Check

1. **One inventory.** There is exactly one `pharmacy_stock` row per (pharmacy, medicine). No second stock table, copy, or sync for the customer side.
2. **Stock math lives in Postgres functions.** Reserve, counter sale, collect, cancel and expire each run in one function call (one transaction). The function locks the stock row with `SELECT ... FOR UPDATE` before checking `quantity - held_quantity`. JavaScript never reads a quantity, subtracts and writes it back.
3. **Invariants enforced by the database**, not only by functions: `CHECK (quantity >= 0)`, `CHECK (held_quantity >= 0)`, `CHECK (held_quantity <= quantity)`, `UNIQUE (pharmacy_id, medicine_id)`, status values limited by `CHECK`.
4. **Each operation's effect:** reserve +held; collect -quantity and -held; cancel/expire -held only; sale -quantity only, and only up to `available_quantity`. A sale blocked by holds returns a clear error that says how many units are reserved.
5. **Baskets.** A reservation is one shop and many `reservation_items`. `reserve` is all or nothing, locks every stock row **ordered by `medicine_id`** (no deadlock between overlapping baskets), and names the short item on failure. Collect/cancel/expire act on every item of the reservation. Item tables (`reservation_items`, `sale_items`) are RLS-scoped through their parent's `pharmacy_id`.
6. **Roles.** Only the `register_pharmacy` function sets `role = 'pharmacist'` and `pharmacy_id`; sign-up gives `customer`; admin is set by hand.
7. **Lazy expiry.** No cron. Every function that reads availability first releases `active` reservations whose `expires_at < now()` for the rows it touches (mark `expired`, subtract their `held_quantity`), under the same lock.
8. **RLS on every table in `public`.** Pharmacist policies compare `pharmacy_id` to the caller's profile (`(select auth.uid())`, wrapped in `select` for performance). Update policies have both `USING` and `WITH CHECK`. A user can never change their own `role` or `pharmacy_id`. Never authorize from `user_metadata`.
9. **Customer-facing reads never expose exact quantities.** The public stock read returns a band (`out` / `low` / `in`), only for `approved` pharmacies. Views use `WITH (security_invoker = true)`, or the read is a function that returns only the safe columns.
10. **`SECURITY DEFINER` only when needed** (for example, a customer's reserve call must update `held_quantity` they cannot update directly). Then: `SET search_path = ''`, fully qualified names, an explicit `auth.uid()` check inside, validate every argument, and `REVOKE EXECUTE ... FROM public, anon` / `GRANT` only to the roles that need it.
11. **Grants.** Tables and functions the browser calls have explicit `GRANT`s to `anon`/`authenticated` as intended; nothing more.
12. **Search** matches brand and generic name (case-insensitive), computes Haversine distance in SQL (no PostGIS), filters to a radius, sorts by distance.
13. **Migrations** are new files created with `npx supabase migration new <name>`. Never edit one that has been pushed. Update `docs/data-model.md` in the same change.

## Verify

- Run `npx supabase db advisors` (security and performance) against the linked project and fix what it reports.
- Exercise each function with SQL as the right role (anon, a customer, a pharmacist of shop A, a pharmacist of shop B), including the last-unit race (two concurrent reserves for one available unit → exactly one succeeds), a basket with one short item (nothing held), and two overlapping baskets at once (no deadlock).
- Report: schema changes, exact commands and results, risks and gaps. Record the run in the **Skill usage log** in `docs/verification.md`.

Do not run destructive SQL (drop, truncate, reset) without naming the target project and confirming with the developer.
