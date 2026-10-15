#!/usr/bin/env python3
"""PostToolUse(Edit|Write) — HerStop's non-negotiable trust-and-safety wording rule.

HerStop is decision support, not a safety guarantee (.claude/rules/product-boundaries.md).
This checks only user-facing app source, and only for absolute safety *claims* —
"safety" as a topic (the Safety tab, "area safety context") is legitimate and allowed.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import read_event, feedback  # noqa: E402

BANNED = [
    (r"verified\s+safe", "verified safe"),
    (r"guaranteed\s+safe", "guaranteed safe"),
    (r"guarantees?\s+(your\s+)?safety", "guarantees safety"),
    (r"ensures?\s+(your\s+)?safety", "ensures safety"),
    (r"crime[\s-]?free", "crime-free"),
    (r"100%\s*safe", "100% safe"),
    (r"\bsafe\s+stops?\b", "safe stop(s)"),
    (r"\bsafe\s+places?\b", "safe place(s)"),
    (r"(objectively|completely|totally|always)\s+safe", "absolute safety claim"),
    (r"\b(is|are|was|were)\s+safe\b", "asserts a place is safe"),
]

PREFER = ("Use decision-support wording instead: Recommended Stop · Good Option · "
          "Use Caution · Limited Data · better-reviewed · higher-confidence · "
          "recent traveler feedback · area safety context.")

event = read_event()
path = (event.get("tool_input") or {}).get("file_path") or ""
norm = os.path.normpath(path)

# Only user-facing app source. Rules/docs must be able to quote the banned words.
if "/apps/mobile/" not in norm or not norm.endswith((".ts", ".tsx")):
    sys.exit(0)

try:
    with open(path, "r", encoding="utf-8") as fh:
        source = fh.read()
except OSError:
    sys.exit(0)

# Only look inside string literals — that is what a user actually reads.
literals = re.findall(r"'[^'\n]{3,200}'|\"[^\"\n]{3,200}\"|`[^`]{3,400}`", source)
hits = []
for text in literals:
    for pattern, label in BANNED:
        if re.search(pattern, text, re.I):
            hits.append(f'  {label}  →  {text.strip()[:100]}')
            break

if hits:
    feedback(
        "PRODUCT-LANGUAGE VIOLATION in " + os.path.relpath(norm) + "\n"
        + "\n".join(sorted(set(hits)))
        + "\n\nHerStop must never claim a place is safe (.claude/rules/product-boundaries.md).\n"
        + PREFER + "\nFix this copy now before continuing."
    )

sys.exit(0)
