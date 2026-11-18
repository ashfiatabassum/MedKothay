---
name: review-react-ui
description: Review or implement MedKothay's Next.js UI (customer search and reservations, pharmacy inventory, counter sale and reservations, admin approval and catalog). Use for any page, component, form or server action under app/ or components/.
---

# Review React UI (MedKothay)

Pair this with the general `vercel-react-best-practices` skill. This app uses Next.js 16 App Router in JavaScript with **Cache Components turned off**, so skip rules about `use cache` and Cache Components. Read the matching guide in `node_modules/next/dist/docs/` before using an API you are unsure of: this Next.js version differs from older training data (for example, middleware is now `proxy.js`).

Read `CLAUDE.md` ("Scope", "Business rules", "Conventions") and identify the exact route group (`(customer)`, `(pharmacy)`, `(admin)`) and user journey before editing.

## Check

1. **Server Components by default.** `"use client"` only where state or events are needed. Mutations are server actions that call Postgres functions (`supabase.rpc(...)`), never read-modify-write of quantities.
2. **Authorization is on the server.** Every pharmacy and admin page checks the user and role on the server and redirects otherwise. Hidden buttons are not security. Never import `lib/supabase/server.js` or use a secret key in a client component.
3. **Customers see bands, not numbers:** "In stock", "Low stock", "Out of stock". No exact quantities or other shops' private data in props sent to the browser.
4. **Every data screen has loading, error and empty states** (`loading.js`, `error.js`, and a clear message when a search has no results within the radius). Never a blank page.
5. **Forms:** labels, required fields marked, field errors from the server shown next to the field, a disabled/pending submit button, and success feedback. The counter shows the "N units are reserved" message when a sale is blocked by holds.
6. **Reservations:** pickup code is prominent; the 30-minute countdown is based on `expires_at` from the server, not a client timer started at click time.
7. **Phone browser first:** works at 375 px with a 16 px gutter and no horizontal scroll; tap targets are large enough; Bangla-friendly text sizes.
8. **Accessibility:** semantic headings, keyboard reachable controls, visible focus, badges have text (not colour only).

## Verify

- `npm run lint` and `npm run build` pass.
- Use **Playwright MCP** to walk the journey in a real browser: signed-out customer, signed-in customer, pharmacist of shop A, pharmacist of shop B (cannot see A's data), admin. Check 375 px and desktop. Use accessibility snapshots for checks and screenshots only for final evidence in `docs/screenshots/`.
- Report files changed, checks run, observed gaps. Record the run in the **Skill usage log** and results in `docs/verification.md`. Do not claim a pass from code reading alone.
