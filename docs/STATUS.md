# Project status and next handoff

**Updated:** 18 November 2026
**Phase:** M0 setup **complete** (all "done when" checks pass, see `docs/verification.md`). Next: M1.

- Live: https://med-kothay.vercel.app (auto-deploys from `main`)
- Repo: https://github.com/ashfiatabassum/MedKothay (public)
- Supabase: hosted project `gkzqlpaknytdvbbknaxp` (ap-southeast-2), CLI linked; auth Site URL and redirect URLs set for localhost:3000 and the Vercel URL

## Decisions made

- Stack: Next.js 16.4 (App Router, JavaScript), Tailwind 4, shadcn/ui (base-nova), Supabase (hosted project; no Docker locally), Vercel.
- Next.js **Cache Components turned off** (`next.config.mjs`): the template enables it, but it makes every cookie-reading page need a `<Suspense>` boundary. The classic model is simpler for a 3-day build.
- Next.js 16 renamed middleware to **`proxy.js`**; it only refreshes the Supabase session. Authorization is done on pages and by RLS.
- Env var names follow the current Supabase dashboard: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the anon/publishable key) and `SUPABASE_SECRET_KEY` (server only).
- Data model decisions D1–D4 (18 Nov): sign-up offers customer or pharmacy owner, but the role is written by the database; licence photos in a private bucket; location from the browser or an area picker, 5 km radius; **one reservation = one shop, many medicines, one pickup code** (new `reservation_items` table). Details in `docs/data-model.md`.
- Agentic tooling: Prettier PostToolUse hook; skills `grill-me`/`grilling`, `supabase` + `supabase-postgres-best-practices` + project `review-supabase-model`, `vercel-react-best-practices` + project `review-react-ui`; subagents `code-reviewer`, `security-reviewer`, `requirements-reviewer`; Playwright MCP.

## Progress

| Milestone | Planned | Implemented | Verified | Notes |
| --- | :---: | :---: | :---: | --- |
| M0 setup | Yes | Yes | Yes | Build/lint pass; health ok locally and on Vercel; hook fired in a real edit; Playwright MCP opened the live site |
| M1 schema, RLS, functions, seed | Yes | No | No | |
| M2 auth and registration | Yes | No | No | |
| M3 admin | Yes | No | No | |
| M4 inventory and counter sale | Yes | No | No | |
| M5 customer search and reserve | Yes | No | No | |
| M6 reservations and dashboard | Yes | No | No | |
| M7 demo loop and hand-in | Yes | No | No | |

## Next task

Start M1 (schema, RLS, stock functions, seed) on branch `feature/m1-schema`. The open data-model questions are answered (decisions D1–D4 in `docs/data-model.md`, confirmed 18 Nov 2026 without a grill-me session), so M1 can go straight to migrations, reviewed with `review-supabase-model` + `supabase-postgres-best-practices`.
