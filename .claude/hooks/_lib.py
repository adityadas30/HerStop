"""Shared helpers for HerStop deterministic hooks.

Hooks are enforced by Claude Code itself, not by the model, so they are the right
place for constraints that must never be talked around.
"""
import json
import sys


def read_event():
    """Read the hook event JSON from stdin. Never crash the session on bad input."""
    try:
        return json.loads(sys.stdin.read() or "{}")
    except Exception:
        return {}


def deny(reason):
    """Block a PreToolUse tool call deterministically."""
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def ask(reason):
    """Force a human permission prompt even if a broad allow rule would match."""
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def allow_silently():
    sys.exit(0)


def feedback(reason):
    """PostToolUse: hand the model a correction it must act on."""
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)
