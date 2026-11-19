# lib/data

The only place screens get data from. Every function is server-only and returns camelCase objects.

| File          | Used by                                              | Milestone that adds it                | Wired to Supabase in |
| ------------- | ---------------------------------------------------- | ------------------------------------- | -------------------- |
| `customer.js` | search, my reservations                              | U1 (search, reservations); U2 extends | W3                   |
| `pharmacy.js` | dashboard, inventory, counter, incoming reservations | U3                                    | W2, W3               |
| `admin.js`    | pending pharmacies, catalog                          | U4                                    | W1                   |

Until W1–W3, functions read `lib/mock-data.js` and mark the line to replace with `TODO(W<n>)`. Keep the return shapes when wiring; if a real function cannot return the same shape, change the screen and this note together.

Customer functions return stock **bands** (`"in" | "low" | "out"`), never quantities.
