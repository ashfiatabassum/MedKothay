# External workflow reviews (19 November 2026)

Before the backend phase, the developer asked separate AI assistants to review
the pharmacy, customer and admin workflows (prompts prepared by Claude). Claude
checked every point against the code and docs; the developer accepted the
resulting decisions, recorded in `docs/data-model.md`:

| Review | File | Decisions |
| --- | --- | --- |
| Pharmacy workflow | pasted in the conversation (not saved as a file) | D7–D12 |
| Customer workflow | `customer-workflow-review.md` | D13–D16 |
| Admin workflow | `admin-workflow-review.md` | D17–D21 |

An earlier review of the whole frontend (10 findings, all fixed in PR #6) is
recorded in `docs/verification.md` under "External UI review".
