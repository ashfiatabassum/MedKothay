# Project status and next handoff

**Updated:** 18 November 2026
**Phase:** M0 and **U1 (UI foundation) complete**; U1 merged by PR #1 (`c6ab437`) and live. Next: U2 (customer screens).

- Live: https://med-kothay.vercel.app (auto-deploys from `main`)
- Repo: https://github.com/ashfiatabassum/MedKothay (public)
- Supabase: hosted project `gkzqlpaknytdvbbknaxp` (ap-southeast-2), CLI linked; auth Site URL and redirect URLs set for localhost:3000 and the Vercel URL

## Decisions made

- Stack: Next.js 16.4 (App Router, JavaScript), Tailwind 4, shadcn/ui (base-nova), Supabase (hosted project; no Docker locally), Vercel.
- Next.js **Cache Components turned off** (`next.config.mjs`): the template enables it, but it makes every cookie-reading page need a `<Suspense>` boundary. The classic model is simpler for a 3-day build.
- Next.js 16 renamed middleware to **`proxy.js`**; it only refreshes the Supabase session. Authorization is done on pages and by RLS.
- Env var names follow the current Supabase dashboard: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the anon/publishable key) and `SUPABASE_SECRET_KEY` (server only).
- Build order (18 Nov): **UI first on sample data (U1–U4), then backend (B1), then wiring (W1–W3)**, at the developer's request. Accepted cost: about half a day of wiring work, and the stock logic is built later. Mitigation: `lib/data/` functions return data in the same shape the Postgres functions will.
- Theme (18 Nov): white and deep blue `#0B5CAD`, blue-white background, amber accent for pickup code and countdown (`CLAUDE.md` "Theme").
- Data model decisions D1–D4 (18 Nov): sign-up offers customer or pharmacy owner, but the role is written by the database; licence photos in a private bucket; location from the browser or an area picker, 5 km radius; **one reservation = one shop, many medicines, one pickup code** (new `reservation_items` table). Details in `docs/data-model.md`.
- Agentic tooling: Prettier PostToolUse hook; skills `grill-me`/`grilling`, `supabase` + `supabase-postgres-best-practices` + project `review-supabase-model`, `vercel-react-best-practices` + project `review-react-ui`; subagents `code-reviewer`, `security-reviewer`, `requirements-reviewer`; Playwright MCP.

## Progress

| Milestone | Planned | Implemented | Verified | Notes |
| --- | :---: | :---: | :---: | --- |
| M0 setup | Yes | Yes | Yes | Build/lint pass; health ok locally and on Vercel; hook fired in a real edit; Playwright MCP opened the live site |
| U1 UI foundation | Yes | Yes | Yes | Merged PR #1 (`c6ab437`); Playwright 3 runs, 2 skills, code-reviewer |
| U2 customer screens | Yes | No | No | |
| U3 pharmacy screens | Yes | No | No | |
| U4 admin screens | Yes | No | No | |
| B1 schema, RLS, functions, seed | Yes | No | No | |
| W1 wire auth, registration, admin | Yes | No | No | |
| W2 wire inventory, counter sale | Yes | No | No | |
| W3 wire search, reservations, collection | Yes | No | No | |
| F demo loop and hand-in | Yes | No | No | |

## Next task

Start **U2 (customer screens)** on `feature/u2-customer` from an up-to-date `main`. Use `searchMedicine` (`needsLocation` when no location yet) and `getMyReservations` (`expiresAt` only for active) from `lib/data/customer.js`; replace the `/basket` and `/reservations` placeholders and the "search arrives in U2" note on the home page. See `plan.md` "Rules for the UI-first phase".

Order: U1 → U2 → U3 → U4 → B1 (backend) → W1–W3 (wire up) → F. Data-model decisions D1–D4 are already confirmed (`docs/data-model.md`).
