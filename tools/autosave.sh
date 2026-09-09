#!/usr/bin/env bash
# autosave.sh — the automatic safety net. Called by hooks, never by hand.
#
# WHY THIS IS NOT ckpt.sh
# -----------------------
# ckpt.sh is the DELIBERATE checkpoint: it runs every suite, and it rewrites
# CHECKPOINT.md with "what I just did" and "what comes next" — the two things
# no diff can reconstruct. It needs a session that knows its own intent.
#
# This runs from a hook, after every file edit and every bash command, with no
# idea what the session is trying to do. So it does the opposite:
#   - no test run (it fires constantly; it must take milliseconds)
#   - it NEVER touches CHECKPOINT.md — overwriting a real "Do this next" with
#     an invented one would destroy the exact thing the next session needs
#   - no gate of any kind: a broken half-edit that is COMMITTED is recoverable,
#     the same half-edit uncommitted dies with the session
#
# It exists for one failure: the usage cap landing mid-change. Everything up to
# the last completed tool call is already on GitHub when that happens.
#
# ALWAYS exits 0. A checkpoint that breaks the session it is protecting is
# worse than no checkpoint.
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$D" || exit 0
[ -d .git ] || exit 0

git add -A >/dev/null 2>&1

if ! git diff --cached --quiet 2>/dev/null; then
  if bash tools/secretscan.sh >.git/autosave-scan.log 2>&1; then
    git commit -q -m "auto-checkpoint: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      -m "Automatic hook checkpoint — not a reviewed commit. See CHECKPOINT.md
for where the session actually stands." >/dev/null 2>&1
  else
    # Unstage so a later deliberate ckpt.sh does not inherit the staged secret,
    # and make it LOUD: a silent skip here would look identical to working.
    # The detail stays in .git/autosave-scan.log (untracked, never pushed).
    git reset -q >/dev/null 2>&1
    echo '{"systemMessage": "AUTOSAVE BLOCKED: what looks like a live credential is in the working tree, so nothing was committed or pushed. Run: bash tools/secretscan.sh -- and remove the credential. Auto-checkpointing stays off until it is clean."}'
    exit 0
  fi
fi

# Push only when there is something to push. A no-op push still costs a network
# round trip, and this runs after EVERY bash command — that latency would be
# paid hundreds of times a session for nothing.
AHEAD="$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)"
[ "${AHEAD:-0}" -gt 0 ] && git push -q origin HEAD >/dev/null 2>&1

exit 0
