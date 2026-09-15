#!/usr/bin/env bash
# capture_inbox.sh — UserPromptSubmit hook. Appends the message Tj just sent
# to INBOX.md, verbatim, and commits+pushes it — BEFORE Claude does any work
# on it.
#
# WHY THIS EXISTS (2026-09-15, after a real failure)
# ----------------------------------------------------------------------
# CLAUDE.md's rule was "write the request to TASKS.md before writing any
# code" -- but that depends on a session remembering to do it, and a usage
# cap does not wait for a good moment. A session ran a long research phase
# on a new feature request, was cut off before ever writing it down, and
# the PostToolUse autosave hook (which only fires on
# Edit|Write|NotebookEdit|Bash) never fired either, because a pure research
# stretch calls none of those. Nothing was on disk, anywhere, saying the
# request had ever been made. The next session opened cold and had no way
# to know — confirmed against this repo's own history: the sibling session
# that opened next resumed CORRECTLY from what was on disk, which was
# exactly the problem, because the request was not on it.
#
# This closes the gap at the one point that can never be skipped: the
# message arriving, before any tool call, before any judgment call about
# whether it is "worth" saving yet. It does not replace TASKS.md -- see
# INBOX.md's own header for that split.
#
# MUST NEVER BLOCK THE PROMPT. Whatever goes wrong here, the message still
# has to reach Claude. Always exit 0, and never emit a "decision":"block".
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$D" || exit 0
[ -d .git ] || exit 0

INPUT="$(cat)"
[ -z "$INPUT" ] && exit 0

if command -v python3 >/dev/null 2>&1; then
  PROMPT="$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    p = d.get("prompt", "")
    sys.stdout.write(p if isinstance(p, str) else "")
except Exception:
    pass
' 2>/dev/null)"
else
  PROMPT=""
fi
[ -z "$PROMPT" ] && exit 0

{
  echo ""
  echo "## $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo '```'
  printf '%s\n' "$PROMPT"
  echo '```'
} >> INBOX.md

# Reuse the already-tested commit/secretscan/push path rather than a second
# copy of it — this file's only job is getting the message onto disk.
bash tools/autosave.sh
exit 0
