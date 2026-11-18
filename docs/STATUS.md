# Project status and next handoff

**Updated:** 18 November 2026
**Phase:** M0 setup, in progress.

## Decisions made

- Stack: Next.js 16.4 (App Router, JavaScript), Tailwind 4, shadcn/ui (base-nova), Supabase (hosted project; no Docker locally), Vercel.
- Next.js **Cache Components turned off** (`next.config.mjs`): the template enables it, but it makes every cookie-reading page need a `<Suspense>` boundary. The classic model is simpler for a 3-day build.
- Next.js 16 renamed middleware to **`proxy.js`**; it only refreshes the Supabase session. Authorization is done on pages and by RLS.
- Env var names follow the current Supabase dashboard: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the anon/publishable key) and `SUPABASE_SECRET_KEY` (server only).
- Agentic tooling: Prettier PostToolUse hook; skills `grill-me`/`grilling`, `supabase` + `supabase-postgres-best-practices` + project `review-supabase-model`, `vercel-react-best-practices` + project `review-react-ui`; subagents `code-reviewer`, `security-reviewer`, `requirements-reviewer`; Playwright MCP.

## Progress

| Milestone | Planned | Implemented | Verified | Notes |
| --- | :---: | :---: | :---: | --- |
| M0 setup | Yes | Partly | Partly | Build and lint pass locally; waiting on Supabase project, GitHub repo, Vercel |
| M1 schema, RLS, functions, seed | Yes | No | No | |
| M2 auth and registration | Yes | No | No | |
| M3 admin | Yes | No | No | |
| M4 inventory and counter sale | Yes | No | No | |
| M5 customer search and reserve | Yes | No | No | |
| M6 reservations and dashboard | Yes | No | No | |
| M7 demo loop and hand-in | Yes | No | No | |

## Next task

Finish M0: create the Supabase project and fill `.env.local`, push to GitHub, deploy to Vercel, check `/api/health` on both. Then start M1 with a `grill-me` session on the data model.
