#!/usr/bin/env python3
"""PreToolUse(Bash) guard for HerStop's highest-value constraints.

Blocks, deterministically, the things CLAUDE.md lists as approval gates:
secrets exposure, destructive/production Supabase operations, protected-branch
writes, production deploys, and destructive resets. Everything else passes through
to the normal permission system.
"""
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import read_event, deny, ask  # noqa: E402

event = read_event()
cmd = (event.get("tool_input") or {}).get("command") or ""
low = cmd.lower()

APPROVAL = ("Requires founder approval (.claude/rules/agent-workflow-rules.md). "
            "Ask, and let the founder run it.")

# --- 1. Secrets ------------------------------------------------------------
# Reading .env for a real reason is fine; dumping it into the transcript is not.
if re.search(r"\b(cat|bat|less|more|head|tail|xxd|od|strings)\b[^|;&\n]*\.env\b(?!\.example)", cmd):
    deny("Blocked: this would print .env (secrets) into the transcript. "
         "security-privacy-rules.md forbids logging secrets. Use "
         "`npm run supabase:check` to test config, or read .env.example instead.")

if re.search(r"service[_-]?role", low):
    deny("Blocked: service-role keys are never allowed in this repo or its tooling "
         "(supabase-rules.md). Mobile uses the anon/public key only. " + APPROVAL)

if re.search(r"echo\s+\$\{?EXPO_PUBLIC_SUPABASE_ANON_KEY", cmd) or \
   re.search(r"\benv\b\s*(\||$)", cmd) and "SUPABASE" in cmd:
    deny("Blocked: this would print an API key. Print a masked prefix instead "
         "(e.g. `${KEY:0:8}...`).")

# --- 2. Destructive / production database ---------------------------------
DESTRUCTIVE_SQL = r"(drop\s+(table|column|policy|schema|database)|truncate\s+|delete\s+from|alter\s+table\s+\S+\s+drop)"
SQL_EXECUTORS = r"(psql|supabase\s+db|pg_dump|pg_restore|/rest/v1/rpc|curl[^|;&]*supabase\.co)"
if re.search(DESTRUCTIVE_SQL, low) and re.search(SQL_EXECUTORS, low):
    deny("Blocked: destructive SQL against a live database. " + APPROVAL +
         " Migration-first: put the SQL in docs/migrations/ and let a human run it "
         "in the Supabase SQL Editor.")

if re.search(r"supabase\s+db\s+(reset|push|remote\s+commit)", low):
    deny("Blocked: `supabase db " + low.split("supabase db ")[1].split()[0] +
         "` changes a real database. " + APPROVAL)

if re.search(r"\bpsql\b", low) and not re.search(r"--help|--version", low):
    ask("`psql` executes SQL directly against a database. Confirm this is read-only "
        "and against the intended project before allowing.")

# --- 3. Protected branches -------------------------------------------------
if re.search(r"git\s+push[^|;&]*\b(origin\s+)?(main|master)\b", low) or \
   re.search(r"git\s+push[^|;&]*--force", low):
    deny("Blocked: pushing to main (or force-pushing) needs founder approval "
         "(agent-workflow-rules.md). Open a PR into dev instead.")

if re.search(r"git\s+(merge|rebase)[^|;&]*\b(main|master)\b", low) and "merge-base" not in low:
    ask("Merging/rebasing against main is an approval gate. Confirm the direction and "
        "that a human approved this merge.")

if re.search(r"git\s+branch\s+-D\b|git\s+reset\s+--hard|git\s+clean\s+-[a-z]*f", low):
    ask("This git command discards work irreversibly. Confirm before running.")

# --- 4. Production deploy --------------------------------------------------
if re.search(r"\b(eas\s+(build|submit|update|deploy)|expo\s+publish|vercel\s+(deploy|--prod)|netlify\s+deploy)\b", low):
    deny("Blocked: production build/deploy is a founder decision. " + APPROVAL)

# --- 5. Destructive repo operations ---------------------------------------
if "reset-project" in low:
    deny("Blocked: `npm run reset-project` scaffolds a blank app and deletes the current "
         "app code (docs/agent-os/COMMANDS.md). Never run it.")

if re.search(r"\brm\s+-[a-z]*[rf]", low):
    target = cmd
    safe = ("/tmp/" in target or "claude-501" in target or "scratchpad" in target
            or "node_modules" in target or ".expo" in target)
    if not safe:
        ask("Recursive/forced delete outside the scratchpad. Confirm the exact path first.")

sys.exit(0)
