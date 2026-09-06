# DECISIONS

> Append-only log of durable decisions. Newest on top. One entry per decision.

## 2026-09-06 — Agent OS v0.1 is lean, not a full framework
Kept existing skills + docs; added agents, rules, agent-os docs, and a feature template. Rejected
duplicating skills into agents. **Why:** the founder's principle is small durable improvements over
big fragile automation.

## 2026-09-06 — Git workflow documented, not created
`dev`/worktrees are documented in `WORKFLOW.md` but not created; harness build + validation done on
`main` working tree with no push. **Why:** pushing/branch setup is the founder's call and needs
their machine + approval.

## 2026-09-06 — Supabase stays the v1 backend
No migration to AWS/MongoDB. **Why:** repository reality (working Supabase client + typed data
layer) and scope discipline. AWS reconsidered later only for enrichment jobs.

## 2026-09-06 — `.env` blocker is a dead project, not placeholders
Live reads fail because the project host `xnkjqcygzjlspeagcoal.supabase.co` returns NXDOMAIN, not
because env values are placeholders (historical assumption corrected). See `db-live-reads`.
