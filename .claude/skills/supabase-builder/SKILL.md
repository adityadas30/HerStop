---
description: Design and implement Supabase-backed features using migration-first schema changes, clear types, and RLS-aware thinking.
---

# Supabase Builder

Use this skill when working on database schema, queries, auth, storage, or backend logic.

## Rules
- Prefer migration-first changes
- Explain schema impact clearly
- Call out RLS implications
- Keep SQL readable
- Keep naming consistent
- Avoid magical hidden behavior
- Mention required env vars
- Keep app-side data access typed and understandable

## Required output format
1. Goal
2. Tables/functions/policies affected
3. Migration plan
4. RLS/security notes
5. App-side changes needed
6. Verification steps

## HerStop-specific reminders
- Browse without login; auth gates saving/reviewing
- OTP auth planned
- Community trust matters more than external safety context
- Never encode “safe” as a guarantee in product-facing labels