# Data model

**Status: decisions confirmed (18 Nov 2026); not built yet.** The intended model is in `CLAUDE.md` ("Data model", "Business rules", "Roles and access"). This file records the decisions behind it and, from M1 on, the model **as built** in `supabase/migrations/`: tables, constraints, indexes, RLS policies, functions and grants. Update it in the same change as any migration.

## Decisions (confirmed by the developer, 18 Nov 2026)

Agreed in chat instead of a `grill-me` session (no time that day). Claude proposed defaults; the developer changed D1 and D4, and later added D5 (which revises D1). D7–D12 come from an external review of the pharmacy workflow (19 Nov), each point checked by Claude and accepted by the developer.

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| D1 | How does someone become a customer, pharmacist or admin? | ~~Everyone starts as `customer`; registering a shop turns the caller into a pharmacist.~~ **Revised by D5:** the account type is chosen at sign-up and fixed. The sign-up trigger maps the type `customer` → `role 'customer'`, `pharmacy` → `role 'pharmacist'` (no `pharmacy_id` yet); anything else, including `admin`, → `customer`. `register_pharmacy` creates the `pending` shop and sets `pharmacy_id`, only for a pharmacist without one. Admin is never offered; set once by hand with SQL. | Developer wanted stakeholders to choose at sign-up. Reading the type from sign-up metadata is safe only because both accepted values are ones anyone may choose; nothing privileged can be claimed, and it is read once, at account creation. |
| D7 | Can a rejected pharmacy resubmit? (19 Nov, pharmacy workflow review) | Yes. A resubmit RPC updates **the same** pharmacy row (details, coordinates kept unless changed, photo replaced), clears `rejection_reason` and sets `status = 'pending'`; allowed only for the owning pharmacist while the shop is `rejected`. `register_pharmacy` stays for owners without a shop. | The UI already offers "Correct and resubmit"; without this the promised path could not complete. |
| D8 | What price does a reservation keep? (19 Nov) | `reservation_items.unit_price` copied from `pharmacy_stock.selling_price` inside `reserve`. Pickup totals use it. Payment happens at the shop and is not recorded. | Sales already store `unit_price`; without it a price change would silently alter an existing reservation's total. |
| D9 | Is expired stock available? (19 Nov) | No. A stock row with `expiry_date` < today (Asia/Dhaka) has available = 0 for search, reserve and sale. The owner's inventory marks it "Expired" and it can still be edited (dates from 2000 to 10 years ahead). | Availability must mean usable stock. |
| D10 | When are expired holds released? (19 Nov) | Inside **every** stock function (reserve, complete_sale, collect, cancel, and the search read), in the same transaction, before checking or showing availability. Tested in B1. | A card can show "Expired" in the browser; the database must agree before anything is sold or held. |
| D11 | Per what are quantity and price? (19 Nov) | The unit follows `medicines.form`: tablet/capsule → per piece, syrup → per bottle, injection → per vial. Displayed everywhere ("৳12 per tablet"). No new column. | "5 available, ৳12 each" was ambiguous (strip? tablet?). Deriving from the form avoids a schema change. |
| D12 | What if an approved shop's licence expires? (19 Nov) | It drops out of customer search while `licence_expiry` < today (Asia/Dhaka), checked on every read (no background job, which CLAUDE.md excludes). The owner updates the licence through the same correct-and-resubmit form (back to pending). | "Verified" must not outlive the licence. |
| — | Wording (19 Nov) | Licence photo: "Only you and MedKothay admins can see it". "Shop location" instead of "Location on the map", explaining the area-centre fallback. Rx: "Check the customer's prescription before handing over" at counter and pickup. Inventory: "Medicine not in the list? Contact MedKothay admin". "Verified" tooltip: "Licence documents reviewed by MedKothay" (not DGDA accreditation). | Pharmacy workflow review, accepted by the developer. |
| D6 | How does a pharmacy owner learn the review result? (18 Nov) | **Status banner on the pharmacy dashboard** (pending / rejected with `rejection_reason` / approved) **and two emails**: "received, under review" on registering, and the result when an admin approves or rejects. Sent from server code with a Gmail app password (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, server-only env, set by the developer). Best effort: failure is logged, never blocks the action. Registration fields: shop name, address, area, latitude/longitude (area centre or browser location), shop phone, DGDA licence number, licence photo, licence expiry. | Developer: owners must be told the outcome. Claude added the in-app banner because email can land in spam. Not an inbox or notification centre (still out of scope): two fixed emails only. |
| D5 | How do people sign in, and can one account be both? (18 Nov) | **Email + password**, not magic links. `/sign-in` has tabs **Sign in** (email, password) and **Create account** (type, full name, email, password 8–72, Bangladeshi mobile phone, stored unverified). **One email = one account = one type.** Pharmacy accounts cannot reserve; owners use a separate customer account. Neutral messages only: "An account with this email already exists. Sign in instead." / "Email or password is incorrect." Email confirmation off for the demo; no password reset for now. | Developer's decisions. Password login suits a demo that switches between accounts often, and avoids Supabase's low free email limit. Claude advised against a message naming the pharmacy behind an email (it would reveal who owns which shop); developer agreed to neutral messages. |
| D2 | Where do licence photos go? | Private Storage bucket. Owning pharmacist can upload and read; admins can read. JPEG/PNG/WebP, max 5 MB. | Licences are private documents; customers never need them. |
| D3 | Customer location and radius? | Browser geolocation, or the centre of an area picked from a list (Dhanmondi, Mirpur 10, Uttara Sector 7, Bashundhara, Mohakhali, Banani, …). Radius 5 km. If no shop within 5 km has the medicine, show the nearest ones further away, labelled "outside 5 km". | Geolocation may be refused or unavailable on a demo laptop; an area picker always works. An empty result page looks broken. |
| D4 | What does one reservation contain? | **One shop, any number of medicines (1–5 units each), one pickup code, one status.** New table `reservation_items`. All or nothing on create; collect and cancel/expire apply to the whole reservation. | Developer's change: a customer usually needs several medicines from the same shop and should get one pickup code. Splitting a basket across shops stays out of scope. |

## Consequences for the schema and functions

- `reservations` loses `medicine_id` and `quantity`; they move to `reservation_items (reservation_id, medicine_id, quantity 1..5, UNIQUE (reservation_id, medicine_id))`.
- `reservation_items` and `sale_items` have no `pharmacy_id`; RLS scopes them through their parent (`reservations.pharmacy_id`, `sales.pharmacy_id`). This is the one exception to "every pharmacy-owned table has `pharmacy_id`", and the policy must join to the parent.
- `reserve` takes a shop and a list of `(medicine_id, quantity)`. It runs lazy expiry, then locks every affected `pharmacy_stock` row with `SELECT ... FOR UPDATE` **ordered by `medicine_id`** (so two overlapping baskets lock in the same order and cannot deadlock), checks every item, and either holds all of them or raises an error naming the short item.
- `collect` (pharmacist, requires the pickup code) and `cancel` (customer) / lazy `expire` loop over the reservation's items under the same lock order.
- The `auth.users` insert trigger is the only path that sets `role`, from the sign-up account type (D1/D5). `register_pharmacy` is the only path that sets `pharmacy_id`.
- `reserve` and `cancel_reservation` raise an error unless the caller's `role = 'customer'` (pharmacy accounts cannot reserve, D5).
- `profiles` gains nothing new for D5: `full_name` and `phone` already exist; the email lives in `auth.users`.

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
