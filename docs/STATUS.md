# Project status and next handoff

**Updated:** 20 November 2026
**Phase:** M0, U1–U4, R1 and B1 are merged and live. **W1–W3 (wiring to Supabase) are implemented, reviewed and verified locally** on three stacked branches (`feature/w1-wire-auth-admin` → `feature/w2-wire-inventory-sale` → `feature/w3-wire-search-reservations`), with pull requests open. All 14 migrations are applied to the hosted database. The live site still runs the sample-data UI from `main` until the three PRs merge; the plan's "done when" checks on the **live** site are not done yet.

- Live: https://med-kothay.vercel.app (auto-deploys from `main`)
- Repo: https://github.com/ashfiatabassum/MedKothay (public)
- Supabase: hosted project `gkzqlpaknytdvbbknaxp` (ap-southeast-2), CLI linked; auth Site URL and redirect URLs set for localhost:3000 and the Vercel URL

## Decisions made

- Stack: Next.js 16.4 (App Router, JavaScript), Tailwind 4, shadcn/ui (base-nova), Supabase (hosted project; no Docker locally), Vercel.
- Next.js **Cache Components turned off** (`next.config.mjs`): the template enables it, but it makes every cookie-reading page need a `<Suspense>` boundary. The classic model is simpler for a 3-day build.
- Next.js 16 renamed middleware to **`proxy.js`**; it only refreshes the Supabase session. Authorization is done on pages and by RLS.
- Env var names follow the current Supabase dashboard: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the anon/publishable key) and `SUPABASE_SECRET_KEY` (server only).
- Build order (18 Nov): **UI first on sample data (U1–U4), then backend (B1), then wiring (W1–W3)**, at the developer's request. Accepted cost: about half a day of wiring work, and the stock logic is built later. Mitigation: `lib/data/` functions return data in the same shape the Postgres functions will.
- Accounts (18 Nov, D5): email + password; one email = one account = one type (customer or pharmacy); pharmacy accounts cannot reserve; neutral auth messages; email confirmation off; no password reset for now. Header shows only logo + Sign in when signed out.
- Sample-era sign-in (U2–R1): a demo cookie and fixed `@medkothay.test` sample accounts with password `demo-password`. **Removed in W1** (`mockAccounts`/`mockSession` deleted); on the W1–W3 branches these accounts do not exist. Sign-in is Supabase Auth only.
- Demo admin (20 Nov): `admin@medkothay.test`, signed up as a customer through the normal endpoint and promoted once with SQL (CLAUDE.md "admin is set once by hand"). Its password is only in the developer's `.env.local` (`DEMO_ADMIN_PASSWORD`), never in the repo. The seeded shops have no owner accounts; the demo loop registers a new shop.
- Emails (20 Nov, developer): Gmail credentials stay in `.env.local` only, not in Vercel, so the live site sends no email (logged "not configured"; D6 is best effort). Local test runs keep email off.
- Pharmacy registration (D6, 18 Nov): shop name, address, area, map location, shop phone, DGDA licence number, licence photo (≤ 5 MB, checked by content; server action body limit 6 MB), licence expiry; status banner on the dashboard; two emails from W1 (developer will set up a Gmail app password).
- Theme (18 Nov): white and deep blue `#0B5CAD`, blue-white background, amber accent for pickup code and countdown (`CLAUDE.md` "Theme").
- Admin workflow review (19 Nov), accepted: D17 no approval of an expired licence; D18 `suspended` status (leaves search, active reservations cancelled, owner can resubmit); D19 duplicate licence warning; D20 catalog edit warning, no delete; D21 review metadata (submitted/reviewed at/by, previous reason, location source); plus wording and small UI (in R1).
- Customer workflow review (19 Nov), accepted: D13 price check before holding; D14 safe retry with a request id; D15 at most 3 active reservations per customer; D16 fallback shows 3 distinct shops; plus wording and small UI fixes (in R1).
- Pharmacy workflow review (19 Nov), accepted: D7 resubmit same shop; D8 reservation item price snapshot; D9 expired stock unavailable; D10 expired holds released in every stock function; D11 unit follows the form; D12 shops with an expired licence leave search. Details in `docs/data-model.md`.
- Data model decisions D1–D4 (18 Nov): sign-up offers customer or pharmacy owner, but the role is written by the database; licence photos in a private bucket; location from the browser or an area picker, 5 km radius; **one reservation = one shop, many medicines, one pickup code** (new `reservation_items` table). Details in `docs/data-model.md`.
- Agentic tooling: Prettier PostToolUse hook; skills `grill-me`/`grilling`, `supabase` + `supabase-postgres-best-practices` + project `review-supabase-model`, `vercel-react-best-practices` + project `review-react-ui`; subagents `code-reviewer`, `security-reviewer`, `requirements-reviewer`; Playwright MCP.

## Progress

| Milestone                                | Planned | Implemented | Verified | Notes                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | :-----: | :---------: | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 setup                                 |   Yes   |     Yes     |   Yes    | Build/lint pass; health ok locally and on Vercel; hook fired in a real edit; Playwright MCP opened the live site                                                                                                                                                                                  |
| U1 UI foundation                         |   Yes   |     Yes     |   Yes    | Merged PR #1 (`c6ab437`); Playwright 3 runs, 2 skills, code-reviewer                                                                                                                                                                                                                              |
| U1b header and accounts UI               |   Yes   |     Yes     |   Yes    | Merged PR #2 (`34d1f42`); Playwright 2 runs, review-react-ui, code-reviewer, security-reviewer                                                                                                                                                                                                    |
| U2 customer screens                      |   Yes   |     Yes     |   Yes    | Merged PR #3 (`26be1b4`); Playwright 2 runs; review-react-ui, vercel-react-best-practices; code, security and requirements reviewers. Sample data: new reservations and cancels are **not saved** until W3                                                                                        |
| U3 pharmacy screens                      |   Yes   |     Yes     |   Yes    | Merged PR #4 (`460454e`); Playwright 6 runs; review-react-ui, vercel-react-best-practices; code, security and requirements reviewers. Registration, stock edits, sales and collection are **not saved** until W1–W3                                                                               |
| U4 admin screens                         |   Yes   |     Yes     |   Yes    | Merged PR #5 (`05a1b67`); Playwright 4 runs; review-react-ui, vercel-react-best-practices; code, security and requirements reviewers. Decisions and catalog changes are **not saved** until W1                                                                                                    |
| R1 workflow review changes               |   Yes   |     Yes     |   Yes    | Code, requirements and security reviews completed; 13 contract groups and 48 direct Playwright/Chrome journey groups at 375/1280 passed, plus lint/build. Final screenshots and results in `docs/verification.md`. Merged PR #7 (`2c87183`); production smoke checks passed. Sample-only behavior |
| B1 schema, RLS, functions, seed          |   Yes   |     Yes     |   Yes    | Nine migrations, private Storage and seed applied; 18 live integration groups, advisors, lint and build pass. The developer explicitly waived the unavailable three-agent review gate on 19 November to meet the deadline                                                                         |
| W1 wire auth, registration, admin        |   Yes   |     Yes     | Locally  | Supabase Auth, registration with private licence upload, admin decisions and catalog, best-effort email. Browser: W1 7/7 and W1 decisions 7/7 on a local production build. Live site and real email not verified. PR open (stack 1 of 3)                                                          |
| W2 wire inventory, counter sale          |   Yes   |     Yes     | Locally  | `save_stock` (refuses stale forms) and `complete_sale`; dashboard from real data. Browser: W2/W3 8/8 locally. Live site not verified. PR open (stack 2 of 3)                                                                                                                                      |
| W3 wire search, reservations, collection |   Yes   |     Yes     | Locally  | Real search/reserve/cancel/collect; pgcrypto pickup code with 5-wrong-code lockout. DB: verify-b1 20/20. Code, security and requirements reviews done and fixed (`docs/verification.md`). Live site not verified. PR open (stack 3 of 3)                                                          |
| F demo loop and hand-in                  |   Yes   |     No      |    No    |                                                                                                                                                                                                                                                                                                   |

## W1–W3 stack

The three branches are stacked because W2 and W3 need W1's real sign-in (a deviation from "branch from main", accepted to start W2/W3 before W1 was tested). Merge order: **W1 → W2 → W3**. When a PR merges and its branch is deleted, GitHub retargets the next PR to `main`. Merging W1 alone deploys real sign-in while inventory and reservations still show sample data, so merge all three in one sitting. The review fixes (`7010ecf`) live on the W3 branch, including fixes to W1/W2 code.

How to test (needs `SUPABASE_SECRET_KEY` and `DEMO_ADMIN_*` in `.env.local`; server: `npm run build` then `GMAIL_USER= GMAIL_APP_PASSWORD= npx next start -p 3102`):

- `B1_TEST_REMOTE=gkzqlpaknytdvbbknaxp npm run verify:b1`
- `W1_TEST_REMOTE=… B1_SERVICE_KEY=… npm run verify:w1:browser`, `W1D_TEST_REMOTE=… npm run verify:w1:decisions`, `W23_TEST_REMOTE=… npm run verify:w23:browser`

Each creates uniquely prefixed fixtures on the hosted project and deletes them; a read-only leftover query found none after every run.

## Next task

1. Merge the three PRs in order; check the Vercel deploy.
2. Run the demo loop on the live site (the W1–W3 "done when" checks) and record it.
3. F: delete `lib/mock-data.js`, `/dev/components`, `scripts/verify-r1*.mjs` and the `verify:r1*` scripts; README; final reviews.

Optional Supabase dashboard settings (not changed): Auth minimum password length is 6 (the app enforces 8); leaked password protection is off (the only advisor warning).

Order: U1 → U2 → U3 → U4 → R1 → B1 (backend) → W1–W3 (wire up) → F. Decisions D1–D21 are recorded in `docs/data-model.md`.
