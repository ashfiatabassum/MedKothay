# Data model

**Status: decisions confirmed (18 Nov 2026); not built yet.** The intended model is in `CLAUDE.md` ("Data model", "Business rules", "Roles and access"). This file records the decisions behind it and, from M1 on, the model **as built** in `supabase/migrations/`: tables, constraints, indexes, RLS policies, functions and grants. Update it in the same change as any migration.

## Decisions (confirmed by the developer, 18 Nov 2026)

Agreed in chat instead of a `grill-me` session (no time that day). Claude proposed defaults; the developer changed D1 and D4.

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| D1 | How does someone become a customer, pharmacist or admin? | The sign-in page offers two choices: "I'm looking for medicine" and "I own a pharmacy". Everyone starts as `customer` (trigger on `auth.users`). The pharmacy registration form calls a Postgres function that creates the `pending` pharmacy and sets the caller's `role = 'pharmacist'` and `pharmacy_id` in one transaction. Admin is never offered; set once by hand with SQL. | Developer wanted stakeholders to choose at sign-up. The choice only decides which screen comes next; the role itself is written by the database, so a browser cannot claim `admin` or `pharmacist`. |
| D2 | Where do licence photos go? | Private Storage bucket. Owning pharmacist can upload and read; admins can read. JPEG/PNG/WebP, max 5 MB. | Licences are private documents; customers never need them. |
| D3 | Customer location and radius? | Browser geolocation, or the centre of an area picked from a list (Dhanmondi, Mirpur 10, Uttara Sector 7, Bashundhara, Mohakhali, Banani, …). Radius 5 km. If no shop within 5 km has the medicine, show the nearest ones further away, labelled "outside 5 km". | Geolocation may be refused or unavailable on a demo laptop; an area picker always works. An empty result page looks broken. |
| D4 | What does one reservation contain? | **One shop, any number of medicines (1–5 units each), one pickup code, one status.** New table `reservation_items`. All or nothing on create; collect and cancel/expire apply to the whole reservation. | Developer's change: a customer usually needs several medicines from the same shop and should get one pickup code. Splitting a basket across shops stays out of scope. |

## Consequences for the schema and functions

- `reservations` loses `medicine_id` and `quantity`; they move to `reservation_items (reservation_id, medicine_id, quantity 1..5, UNIQUE (reservation_id, medicine_id))`.
- `reservation_items` and `sale_items` have no `pharmacy_id`; RLS scopes them through their parent (`reservations.pharmacy_id`, `sales.pharmacy_id`). This is the one exception to "every pharmacy-owned table has `pharmacy_id`", and the policy must join to the parent.
- `reserve` takes a shop and a list of `(medicine_id, quantity)`. It runs lazy expiry, then locks every affected `pharmacy_stock` row with `SELECT ... FOR UPDATE` **ordered by `medicine_id`** (so two overlapping baskets lock in the same order and cannot deadlock), checks every item, and either holds all of them or raises an error naming the short item.
- `collect` (pharmacist, requires the pickup code) and `cancel` (customer) / lazy `expire` loop over the reservation's items under the same lock order.
- `register_pharmacy` (D1) is the only path that sets `role = 'pharmacist'`.

## Constants

| Name | Value | Used by |
| --- | --- | --- |
| Hold time | 30 minutes | `reserve`, countdown UI |
| Low-stock band | 1–5 available | public stock band, dashboard "low stock" |
| Units per reservation item | 1–5 | `reservation_items` CHECK, basket UI |
| Search radius | 5 km | `search_medicine` |
| Licence photo | JPEG/PNG/WebP, ≤ 5 MB | Storage policy, registration form |

## As built

Filled in during M1 from the migrations.
