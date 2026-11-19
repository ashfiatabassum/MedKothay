# Project status and next handoff

**Updated:** 19 November 2026
**Phase:** M0 and the UI phase complete and live. **All three workflow reviews accepted** (pharmacy D7–D12, customer D13–D16, admin D17–D21). Next: **R1** (the UI changes they require, on sample data), then **B1 (backend)**.

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
- Demo session (U2/U3, until W1): signing in with a sample account sets an httpOnly cookie holding only that account's **key** (customer, pharmacist, pharmacist_new, pharmacist_pending, pharmacist_rejected, admin), never an id or role from the browser. Sample data only; removed in W1.
- Sample pending shops for the admin: Green Life Pharmacy (owner `pending@`) and Rahman Drug House (no owner; licence expires 2026-12-10, so it shows "expires within 30 days" until then and "expired" after).
- Demo accounts (password `demo-password`, all `@medkothay.test`): `customer`, `pharmacy` (approved Lazz Pharma), `newpharmacy` (no shop yet: step 2), `pending` (Green Life, pending), `rejected` (MediCare Point, rejected with a reason), `admin`.
- Pharmacy registration (D6, 18 Nov): shop name, address, area, map location, shop phone, DGDA licence number, licence photo (≤ 5 MB, checked by content; server action body limit 6 MB), licence expiry; status banner on the dashboard; two emails from W1 (developer will set up a Gmail app password).
- Theme (18 Nov): white and deep blue `#0B5CAD`, blue-white background, amber accent for pickup code and countdown (`CLAUDE.md` "Theme").
- Admin workflow review (19 Nov), accepted: D17 no approval of an expired licence; D18 `suspended` status (leaves search, active reservations cancelled, owner can resubmit); D19 duplicate licence warning; D20 catalog edit warning, no delete; D21 review metadata (submitted/reviewed at/by, previous reason, location source); plus wording and small UI (in R1).
- Customer workflow review (19 Nov), accepted: D13 price check before holding; D14 safe retry with a request id; D15 at most 3 active reservations per customer; D16 fallback shows 3 distinct shops; plus wording and small UI fixes (in R1).
- Pharmacy workflow review (19 Nov), accepted: D7 resubmit same shop; D8 reservation item price snapshot; D9 expired stock unavailable; D10 expired holds released in every stock function; D11 unit follows the form; D12 shops with an expired licence leave search. Details in `docs/data-model.md`.
- Data model decisions D1–D4 (18 Nov): sign-up offers customer or pharmacy owner, but the role is written by the database; licence photos in a private bucket; location from the browser or an area picker, 5 km radius; **one reservation = one shop, many medicines, one pickup code** (new `reservation_items` table). Details in `docs/data-model.md`.
- Agentic tooling: Prettier PostToolUse hook; skills `grill-me`/`grilling`, `supabase` + `supabase-postgres-best-practices` + project `review-supabase-model`, `vercel-react-best-practices` + project `review-react-ui`; subagents `code-reviewer`, `security-reviewer`, `requirements-reviewer`; Playwright MCP.

## Progress

| Milestone | Planned | Implemented | Verified | Notes |
| --- | :---: | :---: | :---: | --- |
| M0 setup | Yes | Yes | Yes | Build/lint pass; health ok locally and on Vercel; hook fired in a real edit; Playwright MCP opened the live site |
| U1 UI foundation | Yes | Yes | Yes | Merged PR #1 (`c6ab437`); Playwright 3 runs, 2 skills, code-reviewer |
| U1b header and accounts UI | Yes | Yes | Yes | Merged PR #2 (`34d1f42`); Playwright 2 runs, review-react-ui, code-reviewer, security-reviewer |
| U2 customer screens | Yes | Yes | Yes | Merged PR #3 (`26be1b4`); Playwright 2 runs; review-react-ui, vercel-react-best-practices; code, security and requirements reviewers. Sample data: new reservations and cancels are **not saved** until W3 |
| U3 pharmacy screens | Yes | Yes | Yes | Merged PR #4 (`460454e`); Playwright 6 runs; review-react-ui, vercel-react-best-practices; code, security and requirements reviewers. Registration, stock edits, sales and collection are **not saved** until W1–W3 |
| U4 admin screens | Yes | Yes | Yes | Merged PR #5 (`05a1b67`); Playwright 4 runs; review-react-ui, vercel-react-best-practices; code, security and requirements reviewers. Decisions and catalog changes are **not saved** until W1 |
| B1 schema, RLS, functions, seed | Yes | No | No | |
| W1 wire auth, registration, admin | Yes | No | No | |
| W2 wire inventory, counter sale | Yes | No | No | |
| W3 wire search, reservations, collection | Yes | No | No | |
| F demo loop and hand-in | Yes | No | No | |

## Next task

Start **R1 (workflow review changes)** on `feature/r1-review-changes`: the UI items listed in `plan.md` R1 from all three reviews, on sample data. Then **B1** on `feature/b1-schema`, whose checklist already includes D7–D21.

Order: U1 → U2 → U3 → U4 → B1 (backend) → W1–W3 (wire up) → F. Data-model decisions D1–D4 are already confirmed (`docs/data-model.md`).
