#!/usr/bin/env python3
"""PreToolUse(Edit|Write|NotebookEdit) guard.

Stops secrets and security-weakening changes before they reach disk.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import read_event, deny, ask  # noqa: E402

event = read_event()
ti = event.get("tool_input") or {}
path = ti.get("file_path") or ti.get("notebook_path") or ""
content = " ".join(str(ti.get(k, "")) for k in ("content", "new_string", "new_source"))
base = os.path.basename(path)

# Content rules apply to files that can actually reach the repo. Scratch files
# outside the project are the model's own workspace and are left alone.
project = os.path.realpath(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))
in_repo = os.path.realpath(path).startswith(project + os.sep) if path else False
if not in_repo:
    content = ""

# --- Secrets ---------------------------------------------------------------
if re.match(r"^\.env(\..*)?$", base) and base != ".env.example":
    deny(f"Blocked: agents do not write {base}. It holds real credentials and is "
         "gitignored/per-machine. Update .env.example (placeholders only) and tell the "
         "founder which value to set.")

if re.search(r"service[_-]?role", content, re.I):
    deny("Blocked: a service-role key (or reference) must never enter app code or config "
         "(supabase-rules.md). Mobile uses the anon/public key only.")

# A real Supabase JWT is a long 3-part token starting with the standard header.
if re.search(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}", content):
    if ".example" not in base:
        deny("Blocked: this writes what looks like a real JWT/API key into a tracked file. "
             "Keys live in .env only; reference them via process.env.")

# --- Security weakening ----------------------------------------------------
if re.search(r"(disable|drop)\s+row\s+level\s+security", content, re.I) or \
   re.search(r"alter\s+table[^;]*disable\s+row\s+level", content, re.I):
    deny("Blocked: disabling RLS weakens security on user data. " 
         "Requires founder approval (supabase-rules.md).")

if re.search(r"using\s*\(\s*true\s*\)", content, re.I) and \
   re.search(r"\b(saved_stops|reviews|profiles)\b", content, re.I):
    ask("This policy uses `using (true)` on a user-scoped table (saved_stops/reviews/"
        "profiles). Those must be scoped to auth.uid(). Confirm this is intentional.")

# --- Guard the guards ------------------------------------------------------
norm = os.path.normpath(path)
if "/.claude/hooks/" in norm or norm.endswith("/.claude/settings.json"):
    ask("This edits the enforcement layer itself (hooks/settings). "
        "Confirm — weakening a guard should be a deliberate founder decision.")

sys.exit(0)
