# MedKothay

A pharmacy stock finder for Bangladesh. Local pharmacies run their inventory here; customers search across all of them to find which nearby shop has a medicine, and reserve it for pickup. Counter sales and online reservations share one inventory.

**Status:** the customer, pharmacy and admin UI and R1 workflow improvements are complete on sample data. The B1 Supabase schema, RLS, transactional functions, private licence storage and seed are implemented and integration-tested; the app still uses sample data until W1–W3 wire the UI to Supabase. See [docs/STATUS.md](docs/STATUS.md).

## Stack

Next.js 16 (App Router, JavaScript), Tailwind CSS 4, shadcn/ui, Supabase (Postgres, Auth, Row Level Security), Vercel.

## Run locally

1. Node.js 24 and npm.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable (anon) key.
4. `npm run dev` and open http://localhost:3000. `http://localhost:3000/api/health` should return `"supabase":"ok"`.

Apply the migrations and seed under `supabase/` to a development project. Until wiring (W1–W3), account creation and mutations in the UI show demo feedback without saving data.

## Features

| Feature                                 | Status                                     |
| --------------------------------------- | ------------------------------------------ |
| Setup and day-one deploy                | Complete                                   |
| Customer, pharmacy and admin UI (U1–U4) | Complete on sample data; merged            |
| Workflow review improvements (R1)       | Complete on sample data; browser QA passed |
| Supabase backend (B1)                   | Implemented and integration-tested         |
| Real data/auth wiring (W1–W3)           | Not started; see [plan.md](plan.md)        |

## Verification

- `npm run lint`
- `npm run build`
- `npm run verify:r1` — 13 deterministic, in-memory data/action contract checks; no database writes. Browser journeys at 375/1280 and real backend tests remain separate requirements.
- `npm run verify:r1:browser` — 48 real Chrome journey groups at 375/1280. First build and start the sample app on port 3100. Requires Chrome and the `playwright` package, resolved locally or from `R1_PLAYWRIGHT_MODULE` (absolute package directory). Uses disposable browser profiles and a separate fixed-clock server on port 3101; writes results to `docs/r1-browser-results.json` and screenshots to `docs/screenshots/`. All mutations remain sample-only. Database concurrency/RLS are not tested here.
- `npm run verify:b1` — destructive integration checks against the designated MedKothay demo Supabase project only. Set `B1_TEST_REMOTE=gkzqlpaknytdvbbknaxp` and provide its secret key in `B1_SERVICE_KEY`. The script creates uniquely prefixed temporary fixtures and removes them in `finally`; never run it against customer data.

Sample accounts use `demo-password` at `@medkothay.test`: `customer`, `pharmacy`, `newpharmacy`, `pending`, `rejected`, `suspended`, `expired`, `admin`.

## Agentic tools used

- **Hook:** Prettier formatting after every Claude Code edit (`.claude/hooks/format-changed.cjs`).
- **Skills:** `grill-me`/`grilling`, `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, and project skills `review-supabase-model` and `review-react-ui` (`.claude/skills/`).
- **Subagents:** `code-reviewer`, `security-reviewer`, `requirements-reviewer` (`.claude/agents/`).
- **MCP:** Playwright for browser checks (`.mcp.json`).

Where each was used: [docs/verification.md](docs/verification.md).
