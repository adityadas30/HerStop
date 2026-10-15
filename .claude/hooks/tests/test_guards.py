#!/usr/bin/env python3
"""Exercise the HerStop deterministic guards with realistic payloads.

Sensitive literals are assembled at runtime so this file can be written and read
without tripping the guards it is testing.
"""
import json
import subprocess
import os
import sys
from pathlib import Path

# Derived from this file's location (<repo>/.claude/hooks/tests/test_guards.py) so the
# test exercises the hooks of whichever checkout or worktree it runs from.
REPO = str(Path(__file__).resolve().parents[3])
HOOKS = REPO + "/.claude/hooks"

DOTENV = "." + "env"
CAT = "c" + "at"
SVC = "service" + "_" + "role"
NORLS = "disable" + " row level security"
DROP = "drop" + " table saved_stops"
JWT = "ey" + "JhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey" + "Jyb2xlIjoiYW5vbiJ9." + "a" * 40
OPEN = "using" + " (true)"


def run(hook, payload):
    p = subprocess.run(["python3", HOOKS + "/" + hook],
                       input=json.dumps(payload), capture_output=True, text=True,
                       env=dict(os.environ, CLAUDE_PROJECT_DIR=REPO))
    out = p.stdout.strip()
    if not out:
        return "PASS-THROUGH", ""
    try:
        d = json.loads(out)
    except Exception:
        return "BAD-JSON", out
    h = d.get("hookSpecificOutput", {})
    if h:
        return h.get("permissionDecision", "?").upper(), h.get("permissionDecisionReason", "")[:100]
    return str(d.get("decision", "?")).upper(), str(d.get("reason", ""))[:100]


def bash(cmd):
    return {"tool_name": "Bash", "tool_input": {"command": cmd}}


def write(p, c=""):
    return {"tool_name": "Write", "tool_input": {"file_path": p, "content": c}}


CASES = [
    ("dump secrets file",        "guard-bash.py",  bash(CAT + " apps/mobile/" + DOTENV), "DENY"),
    ("privileged key export",    "guard-bash.py",  bash("export SUPABASE_" + SVC.upper() + "_KEY=abc"), "DENY"),
    ("destructive SQL on live",  "guard-bash.py",  bash('psql "$DB" -c "' + DROP + '"'), "DENY"),
    ("supabase db reset",        "guard-bash.py",  bash("supabase db reset"), "DENY"),
    ("push to main",             "guard-bash.py",  bash("git push origin main"), "DENY"),
    ("force push",               "guard-bash.py",  bash("git push --force origin agent/x"), "DENY"),
    ("production build",         "guard-bash.py",  bash("eas build --platform ios"), "DENY"),
    ("reset-project",            "guard-bash.py",  bash("npm run reset-project"), "DENY"),
    ("recursive delete in repo", "guard-bash.py",  bash("rm -rf apps/mobile/app"), "ASK"),
    ("bare psql",                "guard-bash.py",  bash("psql $DATABASE_URL -c 'select 1'"), "ASK"),
    ("OK typecheck",             "guard-bash.py",  bash("npx tsc --noEmit"), "PASS-THROUGH"),
    ("OK live-read check",       "guard-bash.py",  bash("npm run supabase:check"), "PASS-THROUGH"),
    ("OK push agent branch",     "guard-bash.py",  bash("git push -u origin agent/pilot"), "PASS-THROUGH"),
    ("OK rm in scratchpad",      "guard-bash.py",  bash("rm -rf /tmp/claude-501/scratchpad/x"), "PASS-THROUGH"),

    ("write secrets file",       "guard-write.py", write(REPO + "/apps/mobile/" + DOTENV, "X=1"), "DENY"),
    ("privileged key in code",   "guard-write.py", write(REPO + "/apps/mobile/lib/admin.ts",
                                                         "const k = process.env." + SVC.upper() + "_KEY"), "DENY"),
    ("real JWT in tracked file", "guard-write.py", write(REPO + "/apps/mobile/lib/supabase.ts",
                                                         "const k = '" + JWT + "'"), "DENY"),
    ("RLS turned off",           "guard-write.py", write(REPO + "/docs/migrations/003_x.sql",
                                                         "alter table reviews " + NORLS + ";"), "DENY"),
    ("open policy on user data", "guard-write.py", write(REPO + "/docs/migrations/003_x.sql",
                                                         "create policy p on saved_stops for select " + OPEN + ";"), "ASK"),
    ("edit the guards",          "guard-write.py", write(REPO + "/.claude/hooks/guard-bash.py", "pass"), "ASK"),
    ("OK normal component",      "guard-write.py", write(REPO + "/apps/mobile/components/ui/Chip.tsx",
                                                         "export const Chip = () => null;"), "PASS-THROUGH"),
    ("OK env example",           "guard-write.py", write(REPO + "/apps/mobile/" + DOTENV + ".example",
                                                         "EXPO_PUBLIC_SUPABASE_URL=your-project-url"), "PASS-THROUGH"),
]

fails = 0
print("%-6s %-27s %-14s %s" % ("RESULT", "CASE", "GOT", "EXPECTED"))
print("-" * 76)
for label, hook, payload, expected in CASES:
    got, reason = run(hook, payload)
    ok = (got == expected)
    fails += 0 if ok else 1
    print("%-6s %-27s %-14s %s" % ("ok" if ok else "FAIL", label, got, expected))
    if not ok and reason:
        print("       reason: " + reason)
print("-" * 76)
print("%d/%d guard cases passed" % (len(CASES) - fails, len(CASES)))


# --- PostToolUse: product-language rule -------------------------------------
import os
import tempfile


def product_language(source_text, filename="screen.tsx"):
    """Write source into a fake apps/mobile path and ask the hook to judge it."""
    root = tempfile.mkdtemp()
    d = os.path.join(root, "apps", "mobile", "app")
    os.makedirs(d)
    fp = os.path.join(d, filename)
    with open(fp, "w") as fh:
        fh.write(source_text)
    return run("check-product-language.py",
               {"tool_name": "Edit", "tool_input": {"file_path": fp}})


BANNED_COPY = [
    ("claims verified safe",   'const t = "' + "Verified safe" + ' stops near you";', "BLOCK"),
    ("claims a place is safe", 'const t = "This stop ' + "is safe" + ' at night";', "BLOCK"),
    ("crime-free claim",       'const t = "' + "Crime-free" + ' area";', "BLOCK"),
    ("guarantees safety",      'const t = "We ' + "guarantee your safety" + '";', "BLOCK"),
    ("OK decision-support",    'const t = "Recommended Stop - better reviewed";', "PASS-THROUGH"),
    ("OK safety as a topic",   'const t = "Area safety context - Limited Data";', "PASS-THROUGH"),
    ("OK identifier not copy", 'const isSafeMode = true; // internal flag', "PASS-THROUGH"),
]

print()
print("%-6s %-27s %-14s %s" % ("RESULT", "PRODUCT-LANGUAGE CASE", "GOT", "EXPECTED"))
print("-" * 76)
for label, src, expected in BANNED_COPY:
    got, reason = product_language(src)
    ok = (got == expected)
    fails += 0 if ok else 1
    print("%-6s %-27s %-14s %s" % ("ok" if ok else "FAIL", label, got, expected))
print("-" * 76)
print("%d product-language cases checked" % len(BANNED_COPY))

sys.exit(1 if fails else 0)
