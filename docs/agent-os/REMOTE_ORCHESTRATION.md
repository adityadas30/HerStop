# REMOTE ORCHESTRATION

Goal: the founder drives development from a phone while the home machine (or cloud) runs Claude Code.

## Loop
1. **Founder (phone):** write a one-paragraph intent into an issue/note, or reply to the HerStop Lead.
2. **Lead:** turns intent into `docs/features/<name>/{intent,spec,plan}.md`; posts the plan
   back for a quick approve/adjust. Keeps scope small.
3. **Builder:** implements on `agent/<name>`, runs `tsc`+`lint`, commits, opens PR into `dev`.
4. **QA verifier:** independent pass; fills `verification.md`; reports PASS/FAIL + discrepancies.
5. **Reviewer:** reviews the diff (security/RLS/privacy/language/overengineering).
6. **Founder (phone):** approves. Merges to `dev`; later approves `dev → main`.
7. **Anyone:** updates `STATUS.md` + `TASK_BOARD.md`.

## What the founder must approve remotely (never auto)
Push/merge to `main`; destructive DB ops; new paid APIs or large deps; product-positioning changes;
storing sensitive location data. See `.claude/rules/agent-workflow-rules.md`.

## Phone-friendly conventions
- `STATUS.md` and `TASK_BOARD.md` are terse, newest-on-top, skimmable.
- Every feature folder is self-contained: intent → spec → plan → verification.
- Blockers are stated as **exact next manual steps** so they can be actioned from anywhere.

## Keep usage low
One Lead planning burst, one builder, one verifier per task. Batch reviews. Prefer Sonnet;
reserve Opus for planning and high-risk review (see `MODEL_ROUTING.md`).
