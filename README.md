# MedKothay

A pharmacy stock finder for Bangladesh. Local pharmacies run their inventory here; customers search across all of them to find which nearby shop has a medicine, and reserve it for pickup. Counter sales and online reservations share one inventory.

**Status:** the customer, pharmacy and admin UI is complete on sample data. R1 workflow improvements are implemented locally and await final browser verification; backend/persistence is next. See [docs/STATUS.md](docs/STATUS.md).

## Stack

Next.js 16 (App Router, JavaScript), Tailwind CSS 4, shadcn/ui, Supabase (Postgres, Auth, Row Level Security), Vercel.

## Run locally

1. Node.js 24 and npm.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable (anon) key.
4. `npm run dev` and open http://localhost:3000. `http://localhost:3000/api/health` should return `"supabase":"ok"`.

Database migrations and seed are planned in B1. Until wiring (W1–W3), account creation and mutations show demo feedback without saving data.

## Features

| Feature                                        | Status                                        |
| ---------------------------------------------- | --------------------------------------------- |
| Setup and day-one deploy                       | Complete                                      |
| Customer, pharmacy and admin UI (U1–U4)        | Complete on sample data; merged               |
| Workflow review improvements (R1)              | Implemented locally; final browser QA pending |
| Database and real data/auth wiring (B1, W1–W3) | Not started; see [plan.md](plan.md)           |

## Verification

- `npm run lint`
- `npm run build`
- `npm run verify:r1` — 13 deterministic, in-memory data/action contract checks; no database writes. Browser journeys at 375/1280 and real backend tests remain separate requirements.

Sample accounts use `demo-password` at `@medkothay.test`: `customer`, `pharmacy`, `newpharmacy`, `pending`, `rejected`, `suspended`, `expired`, `admin`.

## Agentic tools used

- **Hook:** Prettier formatting after every Claude Code edit (`.claude/hooks/format-changed.cjs`).
- **Skills:** `grill-me`/`grilling`, `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, and project skills `review-supabase-model` and `review-react-ui` (`.claude/skills/`).
- **Subagents:** `code-reviewer`, `security-reviewer`, `requirements-reviewer` (`.claude/agents/`).
- **MCP:** Playwright for browser checks (`.mcp.json`).

Where each was used: [docs/verification.md](docs/verification.md).
