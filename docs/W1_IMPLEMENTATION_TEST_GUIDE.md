# W1 Implementation and Test Guide

## Purpose

This guide is the execution contract for W1 of MedKothay. It is written so a new AI or developer can implement W1 without relying on previous conversation history.

W1 wires the completed sample-data UI to Supabase for accounts, pharmacy registration, admin pharmacy review, and the master medicine catalog. B1 is already complete and applied to the linked Supabase project. W1 must reuse the B1 schema, RLS policies, Storage bucket, and RPCs instead of rebuilding them.

The working rule is:

> Define one small feature, write its tests, implement only that feature, pass its tests, run regression tests, and then move to the next feature.

The goal is a reliable three-day MVP. It is not an enterprise-sized exhaustive test program. Prioritize permissions, ownership, status transitions, private files, data integrity, duplicate requests, and safe failure handling.

## Source of truth

Read these files before changing W1 code:

1. `AGENTS.md`
2. `CLAUDE.md`, especially Accounts, Pharmacy, Admin, Do NOT build, Roles and access, and Feature workflow
3. `docs/data-model.md`, especially D1, D5-D7 and D17-D21
4. `plan.md`, especially B1 and W1
5. `docs/STATUS.md`
6. The current migrations in `supabase/migrations/`

If sources disagree, stop and resolve the disagreement before implementing. Do not silently choose one interpretation. `CLAUDE.md` and the recorded decisions in `docs/data-model.md` define product behaviour; applied migrations define the current database interface.

## W1 scope

W1 includes:

- Supabase email and password sign-up, sign-in, session reading, and sign-out
- Account type selection for customer or pharmacy owner
- Role-based server redirects and authorization
- Safe same-site `next` redirects
- Account controls in all area headers
- Pharmacy registration and licence-photo upload
- Correction and resubmission of rejected, suspended, or licence-expired shops
- Real pharmacy status on the owner dashboard
- Admin pharmacy counts, lists, search, details, duplicate warning, and private photo viewing
- Admin approval, rejection, and suspension using B1 RPCs
- Real master medicine catalog list, add, edit, duplicate prevention, and usage warning
- Best-effort registration and approve/reject email
- Neutral, user-safe errors with no raw Supabase or Postgres messages

W1 does not include:

- Inventory persistence or counter sales; these belong to W2
- Customer search, reservation, cancellation, or collection persistence; these belong to W3
- AI prescription reading; it is a stretch goal after the core product is deployed
- Password reset, email confirmation, magic links, phone verification, notification centre, licence auto-expiry jobs, catalog deletion, CSV import, receipts, or any other item in `CLAUDE.md` Do NOT build

## Starting state

Treat the following as already built and verified by B1:

- `profiles`, `pharmacies`, `medicines`, and the remaining core tables
- Auth trigger that maps exact `account_type = 'pharmacy'` to `pharmacist`; everything else becomes `customer`
- RLS and grants for all tables
- Private `licences` Storage bucket with a 5 MB limit and JPEG, PNG, and WebP MIME allow-list
- Owner-folder Storage rule: licence paths begin with the authenticated owner's UUID
- `register_pharmacy`
- `resubmit_pharmacy`
- `approve_pharmacy`
- `reject_pharmacy`
- `suspend_pharmacy`
- `duplicate_licence_pharmacies`
- `medicine_stock_usage`
- Database constraints preventing invalid roles, statuses, medicine identities, and other unsafe values

Do not add a migration during W1 unless an executable test proves a B1 database gap. If that happens, document the failing case and make the smallest forward-only migration.

## Current W1 replacement points

The current UI already works with sample data. W1 should replace the data layer while preserving the existing component contracts wherever possible.

| Area | Primary files | Required change |
| --- | --- | --- |
| Auth operations | `lib/data/auth.js` | Replace mock accounts and demo sessions with Supabase Auth |
| Session and roles | `lib/data/session.js` | Replace demo cookie with `getClaims()` plus the caller's profile |
| Sign-in actions | `app/(customer)/sign-in/actions.js` | Keep server validation; use real auth results and sign-out |
| Pharmacy data | `lib/data/pharmacy.js` | Wire own pharmacy read, registration, resubmission, and Storage |
| Pharmacy action | `app/(pharmacy)/pharmacy/actions.js` | Preserve validation and call the real data layer |
| Admin data | `lib/data/admin.js` | Replace sample lists and mutations with real queries and RPCs |
| Admin actions | `app/(admin)/admin/actions.js` | Validate UUIDs, preserve role checks, map errors, and revalidate data |
| Protected layouts and pages | `app/(admin)/`, `app/(pharmacy)/` | Continue checking the role on the server; do not trust navigation hiding |
| Supabase clients | `lib/supabase/server.js`, `client.js`, `proxy.js` | Reuse these; create a server client per request |
| Verification | `scripts/` and `package.json` | Add focused W1 verification commands without weakening B1 checks |

Before editing Next.js code, read the relevant installed Next.js 16 documentation under `node_modules/next/dist/docs/` as required by `AGENTS.md`.

## Required implementation sequence

Do not implement all of W1 in one prompt or one change set.

| Slice | Feature | Exit condition |
| --- | --- | --- |
| W1.0 | Baseline and test harness | B1, lint, and build pass before W1 changes |
| W1.1 | Auth, session, roles, redirects, sign-out | AUTH and ACCESS cases pass |
| W1.2 | Registration, private photo, owner status, resubmission | REG and STORAGE cases pass |
| W1.3 | Admin lists, review details, and signed photo URL | ADMIN-READ cases pass |
| W1.4 | Approve, reject, suspend, and emails | ADMIN-WRITE and EMAIL cases pass |
| W1.5 | Medicine catalog | CAT cases pass |
| W1.6 | Complete W1 regression and deployed demo | All W1 gates and demo steps 1-2 pass |

Commit or checkpoint after each slice. Do not start the next slice while a required test in the current slice is failing.

## Standard feature loop

Use this loop for every slice:

1. Read only the specification, migration, data-layer, action, component, and existing test files relevant to the slice.
2. Write or update the slice's automated tests before implementation.
3. Run the new tests and confirm they fail for the expected missing behaviour.
4. Implement the smallest change that satisfies the cases.
5. Run the slice tests.
6. Run all earlier W1 tests.
7. Run `npm run verify:b1`, `npm run lint`, and `npm run build`.
8. Perform the required browser checks at 375 px and desktop width.
9. Inspect `git diff`; remove unrelated changes and secrets.
10. Record evidence in `docs/verification.md` and update `docs/STATUS.md` only after the slice passes.

## Test levels

Every important rule must be enforced at the lowest practical layer.

| Level | What it proves | Examples |
| --- | --- | --- |
| Database and Storage | RLS, RPC authorization, constraints, ownership, state transitions | Customer cannot approve; another owner cannot read a licence |
| Data-layer integration | Supabase calls, result mapping, cleanup, neutral errors | Failed registration removes the newly uploaded unused photo |
| Server action | Validation, role recheck, UUID checks, safe return shape | Nine-character rejection reason is refused before the RPC |
| Browser journey | Redirects, forms, banners, revalidation, visible state | Approved shop leaves Pending and owner sees Approved |
| Manual configuration | Hosted settings that code cannot prove | Email confirmation is off; Auth rate limits are checked |

UI hiding is never sufficient authorization. A protected page, data function, server action, and database policy or RPC must each enforce the part of the rule that belongs to it.

### Keeping the test work small enough for the deadline

The IDs below are acceptance assertions, not instructions to create one expensive browser test for every row. Combine related assertions into focused automated groups:

- Reuse `npm run verify:b1` for database concurrency, RPC authorization, RLS, and transaction guarantees already proved by B1. Do not rewrite those tests in W1.
- Test data-layer and server-action mappings with fast automated checks.
- Use one live integration setup to assert several related IDs before cleaning it up.
- Reserve browser automation for the ten end-to-end journeys in W1.6.
- Check hosted email-confirmation and rate-limit settings manually once and record evidence.

A sensible target is roughly 25 to 35 automated W1 groups, ten browser journeys, and two hosted-configuration checks. Each group may satisfy several IDs. This preserves broad case coverage without turning each table row into a separate development task.

## Test record format

For any new case, record:

- Test ID
- Layer
- Actor
- Preconditions
- Input or action
- Expected response
- Expected database or Storage state
- Cleanup performed
- Result and evidence

Never mark a test passed based only on a success toast. Verify the persisted row, status, ownership, or file state.

## W1.0 Baseline and harness

### Tasks

- Create branch `feature/w1-wire-auth-admin` from an up-to-date `main`.
- Confirm `.env.local` has the public Supabase URL and publishable key.
- Keep `SUPABASE_SECRET_KEY`, Gmail credentials, and test-only keys server-only.
- Add a W1 verification script and npm command. It may use temporary accounts and rows, but it must have an explicit project-ref guard like `verify:b1`.
- Use unique run IDs in test emails, licence numbers, filenames, and catalog entries.
- Track every created Auth user, Storage object, pharmacy, and medicine for cleanup in `finally`.
- Never run destructive cleanup against records that do not contain the current test run ID.

### Baseline cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| BASE-01 | Run B1 verification before W1 edits | All B1 integration groups pass |
| BASE-02 | Run lint and production build | Both pass without W1 warnings or errors |
| BASE-03 | Start W1 verifier without explicit remote target | It refuses to run |
| BASE-04 | W1 verifier finishes or fails halfway | Its own temporary users, files, and rows are removed |
| BASE-05 | Inspect tracked changes | No `.env.local`, key, password, Gmail credential, or generated test secret is present |

## W1.1 Auth, session, roles, redirects, and sign-out

### Implementation rules

- Sign-up sends only `account_type`, `full_name`, and `phone` as user metadata.
- Accepted UI account types are only `customer` and `pharmacy`.
- Never send or trust `role`, `pharmacy_id`, approval status, or admin status from the browser.
- Read the authenticated identity with `supabase.auth.getClaims()` on the server, then read the matching `profiles` row.
- Treat a valid Auth user without a readable profile as an authentication failure, not as a customer.
- Map every auth error to the approved neutral messages. Do not return raw provider text.
- Customers may follow a valid same-site `next` path. Pharmacists and admins always go to their own area.
- A safe `next` value starts with exactly one `/`, contains no backslash, scheme, control character, or leading `//`, and stays within the length limit already implemented.
- Sign-out must use Supabase Auth and remove the demo-session path.
- `proxy.js` refreshes sessions; it is not authorization.
- Every protected read and write rechecks the user and role on the server.

### Auth and validation cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| AUTH-01 | Create a valid customer account | Auth user and customer profile are created; session starts; redirect is customer search/home |
| AUTH-02 | Create a valid pharmacy account | Profile role is `pharmacist`, `pharmacy_id` is null, and redirect is `/pharmacy/register` |
| AUTH-03 | Submit `account_type = admin` directly to Auth | Profile becomes `customer`; no admin or pharmacy access is granted |
| AUTH-04 | Submit forged `role`, `pharmacy_id`, or approval metadata | Trigger ignores them; profile remains safe |
| AUTH-05 | Sign up with an existing email | Show exactly the neutral existing-account message; do not reveal its role |
| AUTH-06 | Sign in with a wrong email, wrong password, or both | All produce `Email or password is incorrect.` |
| AUTH-07 | Supabase returns network, rate-limit, or unexpected sign-up error | Show the generic creation failure; never show raw text or stack traces |
| AUTH-08 | Supabase returns an unexpected sign-in error | Show the neutral credential message; never show raw text |
| AUTH-09 | Sign up with invalid account type, name, email, password, or phone | Server action returns field errors and creates nothing |
| AUTH-10 | Password contains leading or trailing spaces | Password is not trimmed; Auth receives the exact submitted value |
| AUTH-11 | Customer signs in normally | Redirect to customer home/search |
| AUTH-12 | Pharmacist signs in normally | Redirect to `/pharmacy` |
| AUTH-13 | Admin signs in normally | Redirect to `/admin` |
| AUTH-14 | Customer signs in with a valid `/basket`-style `next` path | Redirect to that same-site path |
| AUTH-15 | Pharmacist or admin signs in with a customer `next` path | Ignore it and redirect to the role's own area |
| AUTH-16 | `next` is `//evil.test`, a full URL, contains `\`, control text, or exceeds 200 characters | Ignore it and use the normal role destination |
| AUTH-17 | Auth succeeds but the profile is missing or unreadable | Fail safely; do not guess a role or grant access |
| AUTH-18 | User signs out from each area | Supabase session ends; protected pages redirect to sign-in |

### Access-control cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| ACCESS-01 | Signed-out visitor requests an admin page | Redirect to sign-in; no admin data is returned |
| ACCESS-02 | Customer or pharmacist requests an admin page or admin data function | Access is denied |
| ACCESS-03 | Signed-out visitor, customer, or admin requests a pharmacy management page | Access is denied or redirected appropriately |
| ACCESS-04 | Pharmacist without a shop requests pharmacy management | Redirect to registration and show no stock/admin data |
| ACCESS-05 | Browser calls an admin or registration server action directly with the wrong role | Server action refuses before mutation; RPC/RLS also refuses |
| ACCESS-06 | User attempts to update their own `role` or `pharmacy_id` | Database refuses; values do not change |
| ACCESS-07 | Pharmacist or admin visits customer pages | Customer data stays protected and a link back to the user's own area is visible where specified |
| ACCESS-08 | Account menu is opened in customer, pharmacy, and admin headers | Correct account identity and Sign out are available |
| ACCESS-09 | Session expires between page render and form submission | Action refuses cleanly; no mutation occurs |
| ACCESS-10 | Two users make requests at the same time | No server Supabase client or cached user leaks across requests |

### W1.1 exit gate

- AUTH-01 through AUTH-18 pass.
- ACCESS-01 through ACCESS-10 pass.
- `mockAccounts`, `mk_demo_session`, `startDemoSession`, and the mock auth path are no longer used by production code.
- Protected pages and actions still contain server-side role checks.
- B1, lint, and build pass.

## W1.2 Pharmacy registration, Storage, owner status, and resubmission

### Implementation rules

- Validate form fields on the server before uploading.
- Inspect the photo's first bytes as already implemented; never trust filename or browser MIME alone.
- Store the photo in `licences/<authenticated-user-id>/...`.
- Use a unique new object name for each submission attempt.
- After upload, call `register_pharmacy` for a pharmacist without a shop or `resubmit_pharmacy` for an allowed existing shop.
- If the RPC fails, delete the newly uploaded unused object on a best-effort basis.
- On successful resubmission, delete the previous photo only after the database points to the new photo. Failure to delete the old object must not undo the valid resubmission; log it without exposing sensitive data.
- Do not use the service key for an ordinary owner's upload or registration. The signed-in user's client and RLS are the intended path.
- After success, revalidate the owner dashboard and registration route.
- Send the registration email after persistence. Email failure never changes the successful result.

### Registration cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| REG-01 | Pharmacist without a shop submits valid details and PNG | One pending pharmacy is created, profile links to it, and dashboard shows Pending |
| REG-02 | Repeat submission after success | No second pharmacy is created; user sees already registered |
| REG-03 | Two registration submissions race for the same owner | Exactly one shop is created and linked; loser fails safely and cleans its unused upload |
| REG-04 | Signed-out user, customer, or admin submits registration | Refused; no file or pharmacy is created |
| REG-05 | Missing or invalid name, address, area, coordinates, source, phone, licence number, or expiry | Field error is returned; nothing is uploaded or saved |
| REG-06 | Latitude or longitude is outside the Bangladesh bounds used by the action | Location error; nothing is saved |
| REG-07 | Expiry is malformed, today, in the past, or more than ten years ahead | Expiry error; nothing is saved |
| REG-08 | Licence photo is missing or empty | Photo field error; nothing is saved |
| REG-09 | Licence photo is larger than 5 MB | Photo field error; nothing is saved |
| REG-10 | File claims image MIME or extension but has invalid magic bytes | Photo field error; nothing is saved |
| REG-11 | Valid JPEG, PNG, and WebP are submitted separately | Each accepted format can complete registration |
| REG-12 | Valid file is uploaded but registration RPC fails | New object is removed best effort; no partial shop/profile link exists |
| REG-13 | Client sends another user's Storage path to the RPC | RPC refuses; no pharmacy is created or changed |
| REG-14 | Client sends a nonexistent Storage path | RPC refuses; no pharmacy is created or changed |
| REG-15 | Registration succeeds but Gmail fails | Shop remains pending, UI reports success, failure is logged safely |

### Resubmission and owner-status cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| REG-16 | Rejected owner opens dashboard | Rejected banner and actionable reason are visible |
| REG-17 | Rejected owner corrects data and resubmits | Same pharmacy ID becomes pending; current reason clears; previous reason is retained; submission time updates |
| REG-18 | Suspended owner corrects data and resubmits | Same pharmacy ID becomes pending; suspension reason is retained as previous context |
| REG-19 | Approved shop with an expired licence resubmits a renewed licence | Same pharmacy ID becomes pending and is hidden until reapproved |
| REG-20 | Pending shop attempts resubmission | Refused; original row and photo reference remain unchanged |
| REG-21 | Approved shop with a still-valid licence attempts resubmission | Refused; original row remains unchanged |
| REG-22 | Resubmission RPC fails after new upload | Old photo reference remains valid; new unused upload is cleaned best effort |
| REG-23 | Resubmission succeeds | New photo is readable by owner/admin; old photo is removed best effort |
| REG-24 | Owner refreshes after register or resubmit | Persisted status and details remain; success is not only local component state |

### Storage privacy cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| STORAGE-01 | Owner uploads into their own UUID folder | Upload succeeds for an allowed image within 5 MB |
| STORAGE-02 | Owner uploads into another user's folder | RLS refuses |
| STORAGE-03 | Customer or anonymous user uploads to `licences` | RLS refuses |
| STORAGE-04 | Owner reads their own licence | Read succeeds |
| STORAGE-05 | Different pharmacy owner, customer, or anonymous user reads that licence | Read refuses |
| STORAGE-06 | Admin reads a licence | Read succeeds through the admin-authorized path |
| STORAGE-07 | Public URL is attempted for the private bucket | Licence is not publicly retrievable |
| STORAGE-08 | Filename contains unusual characters or path traversal text | Server-generated safe object name is used; user filename is not used as a path |

### W1.2 exit gate

- REG-01 through REG-24 and STORAGE-01 through STORAGE-08 pass.
- New registration, rejection correction, suspension correction, and expired-licence renewal all persist across refresh.
- There is no orphan-photo leak in the tested RPC-failure path.
- B1 and all W1.1 tests still pass.

## W1.3 Admin pharmacy reads and licence review

### Implementation rules

- Every admin data function calls `requireRole('admin')` or an equivalent server check.
- Validate a route or action pharmacy ID as a full UUID before querying or calling an RPC.
- Query only the fields required by the admin UI.
- Resolve reviewer names from profiles without exposing unrelated profile data.
- Generate a short-lived signed URL for the private licence photo only after the admin check.
- Do not persist signed URLs in the database or send them to unauthorized callers.
- Pending sorts oldest `submitted_at` first. Other tabs use the UI's documented ordering.
- Search matches pharmacy name, area, or licence number.
- Duplicate-licence lookup is normalized, is a warning rather than a block, and excludes the current shop from the displayed duplicate list.

### Admin-read cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| ADMIN-READ-01 | Admin opens pharmacy list | Real pending, approved, rejected, and suspended counts match database rows |
| ADMIN-READ-02 | Admin switches tabs | Only records with the selected status appear |
| ADMIN-READ-03 | Pending list has several rows | Oldest submitted row appears first |
| ADMIN-READ-04 | Search by partial name, area, or licence number | Correct matching rows appear; nonmatches do not |
| ADMIN-READ-05 | Search has no result | Existing empty state appears without an exception |
| ADMIN-READ-06 | Admin opens a valid review page | All decision fields, location source, review context, and map link are present |
| ADMIN-READ-07 | Licence expires in 30 days or fewer | Warning badge appears but approval remains available until it is past |
| ADMIN-READ-08 | Licence expired before Dhaka today | Expired badge appears and approval is unavailable or refused |
| ADMIN-READ-09 | Same normalized licence is used by another shop | Duplicate warning names the other shop and status; current shop is not listed as its own duplicate |
| ADMIN-READ-10 | No other shop has the normalized licence | No duplicate warning appears |
| ADMIN-READ-11 | Admin requests a valid licence photo | A short-lived signed URL displays the private image |
| ADMIN-READ-12 | Customer, pharmacist, or signed-out caller requests the review data or signed URL | Access is denied and no signed URL is returned |
| ADMIN-READ-13 | Route contains malformed UUID | Generic not-found/error response; no raw Postgres message |
| ADMIN-READ-14 | UUID is valid but no pharmacy exists | Not-found UI; no crash |
| ADMIN-READ-15 | Database or Storage temporarily fails | Error boundary or safe message appears; no mock data is silently substituted |

### W1.3 exit gate

- ADMIN-READ-01 through ADMIN-READ-15 pass.
- Admin screens contain real data and no production fallback to `lib/mock-data.js`.
- Licence photos remain private.
- All earlier W1 tests pass.

## W1.4 Admin decisions, status changes, suspension, and email

### Implementation rules

- Recheck admin role inside every server action and rely on the RPC's internal admin check as the final guard.
- Validate IDs as UUIDs before the RPC.
- Reject and suspend reasons are trimmed and must be 10 to 300 characters at both action and database layers.
- Map expected database errors to stable user-safe messages. Log unexpected details only on the server.
- Revalidate the list, counts, review page, and owner dashboard after a successful decision.
- Do not optimistically show success before the RPC succeeds.
- Approval and rejection email is sent only after the decision commits.
- Escape owner-controlled and admin-controlled text in HTML email. Prefer a mail library's escaping or a single tested escape helper; never concatenate raw rejection text into HTML.
- Email failure is logged and does not roll back or misreport the committed decision.
- For decision email lookup, any Supabase secret/service key must stay in a server-only module and must never be imported into a client component.

### Approval and rejection cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| ADMIN-WRITE-01 | Admin approves a valid pending shop | Status becomes approved; reviewer and reviewed time are saved; list counts update |
| ADMIN-WRITE-02 | Admin approves a pending shop whose licence expired before Dhaka today | RPC refuses; status stays pending |
| ADMIN-WRITE-03 | Admin approves a licence expiring within 30 days | Approval succeeds after warning/confirmation |
| ADMIN-WRITE-04 | Customer, pharmacist, or signed-out caller invokes approval | Both action and RPC refuse; status does not change |
| ADMIN-WRITE-05 | Two approval requests race | At most one succeeds; final status is approved and no inconsistent review data exists |
| ADMIN-WRITE-06 | Approve is repeated after success | Clean state-conflict message; no duplicate side effect |
| ADMIN-WRITE-07 | Admin rejects a pending shop with a 10-character reason | Rejection succeeds and owner can see the exact trimmed reason |
| ADMIN-WRITE-08 | Reason is 9 characters, 301 characters, empty, or whitespace | Refused; status remains pending |
| ADMIN-WRITE-09 | Reason is exactly 300 characters | Rejection succeeds |
| ADMIN-WRITE-10 | Reason contains HTML or script-like text | Stored as text; email escapes it; no HTML executes in app or email |
| ADMIN-WRITE-11 | Reject is attempted on approved, rejected, suspended, or missing shop | Refused; existing state remains unchanged |
| ADMIN-WRITE-12 | Malformed pharmacy ID is submitted | Generic validation error before RPC; no raw database error |
| ADMIN-WRITE-13 | Database call fails | No success message, no email, and current state remains visible after refresh |

### Suspension cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| ADMIN-WRITE-14 | Admin suspends an approved shop with a valid reason | Status becomes suspended and owner sees the reason |
| ADMIN-WRITE-15 | Suspended shop has active reservations | They become cancelled with `pharmacy_unavailable`; all holds are released atomically |
| ADMIN-WRITE-16 | Suspension is attempted on pending, rejected, suspended, or missing shop | Refused; no reservation or stock state changes |
| ADMIN-WRITE-17 | Non-admin attempts suspension | Refused at action and RPC layers |
| ADMIN-WRITE-18 | Two suspension requests race | One valid transition; no held quantity becomes negative and reservations are not released twice |
| ADMIN-WRITE-19 | Suspension transaction fails midway | Entire transaction rolls back; no partial status or hold changes |

### Email cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| EMAIL-01 | Valid new registration commits | One received/under-review email is attempted after commit |
| EMAIL-02 | Approval commits | One approval-result email is attempted after commit |
| EMAIL-03 | Rejection commits | One rejection-result email with escaped reason is attempted after commit |
| EMAIL-04 | Validation, upload, RPC, or database action fails | No success email is sent |
| EMAIL-05 | Gmail credentials are missing or Gmail rejects the message | Core action remains successful; dashboard is authoritative; safe server log records failure |
| EMAIL-06 | Email address or reason contains HTML-significant characters | Output is escaped and cannot inject markup |
| EMAIL-07 | User double-clicks a decision | Database transition is not duplicated; avoid duplicate emails where practical, but database correctness is mandatory |

### W1.4 exit gate

- ADMIN-WRITE-01 through ADMIN-WRITE-19 and EMAIL-01 through EMAIL-07 pass.
- Admin decision persists, lists update, and owner dashboard shows the result after refresh.
- Email outages do not block registration or decisions.
- B1 and all earlier W1 tests still pass.

## W1.5 Medicine catalog

### Implementation rules

- Catalog reads use real `medicines` rows.
- Only admins may insert or update.
- The same normalized brand name, strength, and form may exist only once; the database unique index is the final guard.
- Keep the existing field limits and form allow-list in the server action.
- Do not add delete in this build.
- Before editing, obtain `medicine_stock_usage` on the server. If usage is greater than zero, require explicit confirmation.
- Never trust a browser-supplied usage count.
- Map uniqueness and other expected database errors to the existing catalog messages.
- Revalidate the catalog after successful writes so the list changes immediately.

### Catalog cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| CAT-01 | Admin opens catalog | Real medicines appear in deterministic brand order |
| CAT-02 | Search by brand, generic, or manufacturer | Correct matching rows appear |
| CAT-03 | Admin adds a valid medicine | One row is created and appears after refresh |
| CAT-04 | Customer, pharmacist, or signed-out caller adds or edits | Action and RLS refuse; no row changes |
| CAT-05 | Required field is missing or outside its length limit | Field error; no write |
| CAT-06 | Form is not in the approved form list | Field error; no write |
| CAT-07 | Add duplicates existing brand, strength, and form using case or spacing differences | Friendly duplicate message; no second row |
| CAT-08 | Two admins or requests add the same identity concurrently | Database permits exactly one; loser receives friendly duplicate message |
| CAT-09 | Admin edits an unused medicine with valid values | Row changes and list updates |
| CAT-10 | Admin edits a medicine used by pharmacies without confirmation | Refused and usage count is shown |
| CAT-11 | Admin confirms edit of a medicine used by pharmacies | Shared row changes; existing stock references remain valid |
| CAT-12 | Browser lies about usage count or omits the warning | Server recomputes usage and enforces confirmation |
| CAT-13 | Edit would duplicate another catalog identity | Friendly duplicate message; original row remains unchanged |
| CAT-14 | Medicine ID is malformed or missing | Generic validation/not-found response; no raw database error |
| CAT-15 | Database fails during add or edit | No success state; list does not pretend the write happened |
| CAT-16 | Admin looks for a delete action | No catalog delete control or server action exists in W1 |
| CAT-17 | Prescription-only is toggled | Boolean persists and reloads correctly |

### W1.5 exit gate

- CAT-01 through CAT-17 pass.
- Add and edit visibly persist after refresh.
- No catalog delete path exists.
- B1 and all earlier W1 tests pass.

## W1.6 Regression and deployed acceptance

### Required complete journeys

| ID | Journey | Expected result |
| --- | --- | --- |
| E2E-01 | New customer signs up, signs out, and signs back in | Correct session, menu, and customer redirects |
| E2E-02 | New pharmacy owner signs up and registers a pharmacy | Same session continues to step 2; shop persists as pending |
| E2E-03 | Admin reviews that new pharmacy and opens its private photo | Correct details and signed image are visible only to admin/owner |
| E2E-04 | Admin approves the pharmacy | Pending count decreases, approved count increases, owner sees Approved |
| E2E-05 | Admin rejects a separate pending pharmacy, owner corrects it, and admin approves it | Same shop row moves rejected to pending to approved; previous reason is visible to admin |
| E2E-06 | Admin suspends an approved pharmacy and owner resubmits | Shop becomes suspended, then the same row returns to pending |
| E2E-07 | Admin adds and edits a medicine | Catalog list persists both changes and enforces shared-use confirmation |
| E2E-08 | Wrong-role user attempts every protected W1 URL and action | No protected data or mutation is available |
| E2E-09 | Refresh each success screen | Persisted state remains; no feature depends on mock/local state |
| E2E-10 | Repeat at 375 px and desktop width | No horizontal overflow or blocked controls |

### Final commands

The final implementation should expose commands equivalent to:

```text
npm run verify:b1
npm run verify:w1
npm run verify:w1:browser
npm run lint
npm run build
```

If the exact command names differ, record them in `docs/verification.md` and `README.md`.

### Final repository checks

- Search for `TODO(W1)` and resolve or deliberately reclassify every result.
- Search production imports for `mockAccounts`, `mockSession`, `mock-data`, and demo-session helpers.
- It is acceptable for W2/W3 screens to retain sample data until their milestones, but W1 auth, registration, admin, and catalog paths must not.
- Confirm no service key, Gmail password, test password, signed URL, or user token is committed or logged.
- Confirm every server action maps unexpected provider/database errors to safe messages.
- Confirm every successful mutation revalidates affected pages.
- Confirm test cleanup removed temporary W1 users, licence files, shops, and catalog entries.
- Confirm the deployed environment has email confirmation disabled and expected Auth rate limits.

## Definition of done for W1

W1 is complete only when all of the following are true:

- All required W1 test IDs pass or a documented product decision explicitly defers one.
- Demo loop step 1 works: a pharmacy account registers and becomes pending.
- Demo loop step 2 works: the admin reviews and approves it.
- Registration, decisions, and catalog changes persist across refresh and deployment.
- Wrong roles cannot read private data or call protected actions.
- Licence photos remain private and are shown to admins through short-lived signed URLs.
- Rejected, suspended, and licence-expired owners can correct and resubmit the same shop row.
- Approval refuses an expired licence.
- Suspension transactionally cancels active reservations and releases holds.
- Catalog duplicate and shared-edit rules work on the server and in the database.
- Email failure never changes the committed business result.
- No raw Supabase/Postgres error reaches the browser.
- `verify:b1`, W1 verification, lint, and build pass.
- Browser journeys pass at 375 px and desktop width.
- Evidence is recorded in `docs/verification.md` and W1 status is updated in `docs/STATUS.md`.

## Stop conditions

Stop the current slice and report the blocker instead of improvising if:

- A requested change conflicts with `CLAUDE.md`, a recorded decision, or the Do NOT build list.
- An applied RPC signature differs from the guide or migration files.
- A test would require deleting or rewriting non-test user data.
- A secret would need to be exposed to client code.
- A B1 rule fails and the cause is not understood.
- The implementation would require starting W2, W3, or the AI stretch goal.
- A new schema design is proposed without a failing test that demonstrates the need.

## Prompt template for each AI implementation slice

Use a prompt in this form so the AI receives a small, controlled task:

```text
Implement only W1.<slice name> from docs/W1_IMPLEMENTATION_TEST_GUIDE.md.

Read AGENTS.md, CLAUDE.md, docs/data-model.md, plan.md, docs/STATUS.md,
the relevant B1 migrations, and only the W1 files named for this slice.

First add or update tests for these IDs: <test IDs>.
Confirm the new tests fail for the expected missing behaviour, then implement
the smallest change that makes them pass.

Do not implement another W1 slice. Do not begin W2, W3, or the AI feature.
Do not change the database schema unless a failing executable test proves a B1
gap. Preserve existing UI contracts and map all external errors to safe messages.

After implementation run the slice tests, all earlier W1 tests,
npm run verify:b1, npm run lint, and npm run build. Inspect git diff, clean only
the temporary fixtures created by this test run, and record evidence in
docs/verification.md. Report changed files, test results, and any remaining risk.
```

## Recommended first prompt

Start with W1.0 and W1.1 only:

```text
Implement W1.0 and W1.1 from docs/W1_IMPLEMENTATION_TEST_GUIDE.md.
Cover BASE-01 to BASE-05, AUTH-01 to AUTH-18, and ACCESS-01 to ACCESS-10.
Stop after real Supabase authentication, session/profile loading, role gates,
safe redirects, account controls, and sign-out pass. Do not wire pharmacy
registration or admin/catalog data yet.
```
