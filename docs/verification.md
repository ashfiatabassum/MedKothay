# Verification log

Record **observed** results only. A planned test is not a pass. Use test accounts and seed data; no real customer data in screenshots or commits.

## Environment

- Node 24.18.0, npm 11.16.0, Next.js 16.4.6, React 19.3.0, Tailwind 4.3.3, @supabase/supabase-js 2.119.0, @supabase/ssr 0.12.7, Supabase CLI 3.2.0, Playwright MCP 0.0.84
- Supabase project: hosted, ref `gkzqlpaknytdvbbknaxp`
- Vercel URL: https://med-kothay.vercel.app (project `med-kothay`, auto-deploys from `main`)
- Hook status (`/hooks`): _to check in a fresh session_
- Playwright MCP status: `claude mcp list` (CLI 2.1.322, 18 Nov 2026) → `playwright: cmd /c npx -y @playwright/mcp@0.0.84 - ✔ Connected`; pre-approved in `.claude/settings.local.json`. Tools available from the next session

## M0 setup checks

| Check | Expected | Actual result | Pass/Fail/Not run |
| --- | --- | --- | --- |
| `npm run build` | succeeds | Succeeded 18 Nov 2026: routes `/`, `/api/health`, proxy | Pass |
| `npm run lint` | no errors | No output (no errors) 18 Nov 2026 | Pass |
| Hook, run by hand | formats an in-scope file, ignores others | Piped an Edit event for `lib/__hooktest.js` (`{a:1,   b:2}` plus trailing spaces) → "Formatted with Prettier", file became `{ a: 1, b: 2 };`; `README.md` event → no change | Pass |
| Supabase CLI linked | `migration list --remote` reaches the hosted DB | 18 Nov 2026: developer ran `npx supabase link`; `migration list --remote` → target `gkzqlpaknytdvbbknaxp` (production), `"migrations":[]`. Without `--remote` CLI v3 tried local Docker and failed (ECONNREFUSED 127.0.0.1:54322) | Pass |
| Hook fires in a real session edit | Claude Code reports the hook ran | | Not run |
| `/` and `/api/health` locally without env vars | `/` 200; health 503 "not configured" | `npm run start`: `/` 200, title "MedKothay"; health 503 `{"app":"ok","supabase":"not configured"}` (after fix #5) | Pass |
| `/api/health` locally | 200, `"supabase":"ok"` | `npm run dev` 18 Nov 2026, project `gkzqlpaknytdvbbknaxp`: 200 `{"app":"ok","supabase":"ok"}`; `/` 200 | Pass |
| `/api/health` on Vercel | 200, `"supabase":"ok"` | 18 Nov 2026, https://med-kothay.vercel.app: 200 `{"app":"ok","supabase":"ok"}`; `/` 200. First deploy had no env vars (503 "not configured"); vars were then added as Config for all environments and a fresh build picked them up | Pass |
| Playwright MCP opens the home page | page title "MedKothay" | | Not run |

## Feature checks

| Requirement | Scenario | Expected | Actual result | Pass/Fail/Not run | Evidence / issue / fix |
| --- | --- | --- | --- | --- | --- |

## Skill usage log

| # | Date | Skill | Milestone | Invoked (typed/requested/auto) | What it did | Outcome and commit |
| --- | --- | --- | --- | --- | --- | --- |

## Subagent usage log

| # | Date | Subagent | Milestone | Findings | Fixed / rejected / deferred |
| --- | --- | --- | --- | --- | --- |

## Playwright MCP log

| Date | Milestone | Journey checked | Result |
| --- | --- | --- | --- |

## Issues and corrections log

| # | Date | What went wrong | Caused by | How detected | Fix and verification |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-11-18 | `create-next-app` refused to scaffold into `MedKothay` (npm names cannot contain capitals) | Environment (folder name) | Command error | Scaffolded into a scratchpad folder `medkothay` and copied the files in; build passes |
| 2 | 2026-11-18 | shadcn `init` generated `components/ui/button.jsx` importing `cn` from `"cn"` instead of `"@/lib/utils"` | Tool (shadcn JavaScript conversion) | Claude read the generated file | Changed the import; build passes |
| 3 | 2026-11-18 | shadcn wrote `--font-sans: var(--font-sans)` (refers to itself) in `app/globals.css` | Tool (shadcn) | Claude read the generated file | Pointed it at `--font-geist-sans` from the layout |
| 4 | 2026-11-18 | Template `.gitignore` rule `.env*` would also hide `.env.example` | Template | Claude read `.gitignore` | Added `!.env.example`; `git check-ignore` confirms `.env.local` ignored and `.env.example` not |
| 5 | 2026-11-18 | With no Supabase env vars, `lib/supabase/proxy.js` threw on every request, so `/` and `/api/health` returned 500 | Claude (proxy written without an env check) | `npm run start` + `curl` returned 500; server log showed "URL and Key are required" | Proxy skips the refresh when env vars are missing; re-run: `/` 200 with title "MedKothay", `/api/health` 503 `{"app":"ok","supabase":"not configured"}` |
| 6 | 2026-11-18 | `.env.local` was copied from `.env.example` but still had the placeholder URL and an empty key | Developer (copy step); the dashboard snippet also listed TypeScript helper files that are not needed here | Claude listed the variable names with values hidden | Filled both values; `/api/health` → 200 `"supabase":"ok"` |

## Pull requests and merges

| Milestone | Branch | PR | Merge commit | Checks at merge |
| --- | --- | --- | --- | --- |
