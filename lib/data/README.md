# lib/data

The only place screens get data from. Every function is server-only and returns camelCase objects.

| File          | Used by                                              | Milestone that adds it                | Wired to Supabase in |
| ------------- | ---------------------------------------------------- | ------------------------------------- | -------------------- |
| `customer.js` | search, my reservations                              | U1 (search, reservations); U2 extends | W3                   |
| `pharmacy.js` | dashboard, inventory, counter, incoming reservations | U3                                    | W2, W3               |
| `admin.js`    | pending pharmacies, catalog                          | U4                                    | W1                   |

Until W1–W3, functions read `lib/mock-data.js` and mark the line to replace with `TODO(W<n>)`. Keep the return shapes when wiring; if a real function cannot return the same shape, change the screen and this note together.

Customer functions return stock **bands** (`"in" | "low" | "out"`), never quantities.

R1 contracts to preserve when wiring:

- Search excludes expired stock, suspended/unapproved shops and expired licences; fallback selects three distinct pharmacies with their matching medicines. Public contact/location fields support Call and Directions.
- Reservation creation accepts `customerId` from the server session, `requestId` and expected unit prices. Price changes return `prices` without holding anything; accepted items retain `unitPrice`. Enforce the three-active limit and request-id uniqueness in the database, not these mock functions.
- Customer reservation rows include `cancellationReason` (`pharmacy_unavailable` on suspension), without the private admin reason, plus pharmacy coordinates and contact details. Sort active rows soonest-to-expire first.
- Own-pharmacy DTOs include latitude, longitude and `locationSource` so correcting a registration preserves its pin. Incoming reservation items include `form` for quantity units.
- Admin rows use `submittedAt` from the latest submission, `reviewedAt`, `reviewedBy` display name, prior rejection reason, location source and duplicate-licence warnings. Catalog rows include `stockCount` for the shared-edit confirmation.

Run `npm run verify:r1` for isolated sample-data/action contract checks. This does not replace browser, RLS or transaction tests.
