# HerStop Docs Index

| Area | File | Notes |
|------|------|-------|
| **Product** | `product-brief.md` | Canonical product brief (what/who/scope). |
| | `product/trust-and-safety-language.md` | Non-negotiable decision-support wording rules. |
| | `product/roadmap.md` | Phases 1–3 and what's out of v1. |
| **Architecture** | `architecture.md` | Canonical architecture (repo/app layout, tech stack, data flow). |
| | `architecture/current-state.md` | **Audit-based** truth of what actually exists (start here). |
| | `architecture/data-model.md` | Tables, types, and data-layer functions. |
| | `architecture/supabase-rls.md` | RLS posture and rules. |
| | `schema.sql` | Runnable `stops` table + seed. |
| **Agent OS** | `agent-os/README.md` | The development harness (agents, workflow, routing, checklists). |
| **Features** | `features/_template/` | Copy to `features/<name>/` for each task. |
| | `features/db-live-reads/` | Live Supabase reads — blocker + tooling. |

Frontend architecture lives in `architecture.md` (mobile app structure section); no separate file
to avoid duplication.
