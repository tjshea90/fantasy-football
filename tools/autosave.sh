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

# THE HOOK'S OWN INPUT (2026-09-27b). Claude Code hands every hook a JSON
# object on stdin: session_id, transcript_path, hook_event_name, tool_name.
# Read it once, without ever blocking — capture_inbox.sh and note.sh call this
# with nothing on stdin, and a terminal would wait forever on a bare `cat`.
IN=""
if [ ! -t 0 ]; then IN="$(timeout 2 cat 2>/dev/null || true)"; fi
EVENT=""
case "$IN" in *'"hook_event_name"'*)
  EVENT="$(printf '%s' "$IN" | sed -n 's/.*"hook_event_name"[[:space:]]*:[[:space:]]*"\([A-Za-z]*\)".*/\1/p' | head -1)";;
esac

SYSMSG=""   # shown to Tj
CTX=""      # handed to Claude (PostToolUse only)

# WHAT THE SESSION HAS LEARNED, not just what it changed — see the header of
# tools/sessionlog.py for the 2026-09-27 failure this closes. Writes
# SESSIONLOG.md (throttled) and returns the research nudge, if one is due.
if [ -n "$IN" ] && command -v python3 >/dev/null 2>&1; then
  CTX="$(printf '%s' "$IN" | timeout 20 python3 tools/sessionlog.py 2>/dev/null || true)"
fi

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
    SYSMSG="AUTOSAVE BLOCKED: what looks like a live credential is in the working tree, so nothing was committed or pushed. Run: bash tools/secretscan.sh -- and remove the credential. Auto-checkpointing stays off until it is clean."
  fi
fi

# EDITS MADE IN A GIT WORKTREE (2026-09-27b). An isolated subagent or
# EnterWorktree edits a SEPARATE checkout; everything above only ever looked
# at this one, so that work was never committed and died with the container.
# Each extra worktree is committed on its own branch and pushed there;
# resume.sh's stranded-branch check then points the next session at it.
git worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' | while IFS= read -r WT; do
  [ -z "$WT" ] && continue
  [ "$(cd "$WT" 2>/dev/null && pwd -P)" = "$(pwd -P)" ] && continue
  [ -d "$WT" ] || continue
  WB="$(git -C "$WT" branch --show-current 2>/dev/null || true)"
  [ -z "$WB" ] && continue
  git -C "$WT" add -A >/dev/null 2>&1
  if ! git -C "$WT" diff --cached --quiet 2>/dev/null; then
    if SCAN_DIR="$WT" bash tools/secretscan.sh >/dev/null 2>&1; then
      git -C "$WT" commit -q -m "auto-checkpoint (worktree): $(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null 2>&1
    else
      git -C "$WT" reset -q >/dev/null 2>&1
    fi
  fi
  timeout 30 git -C "$WT" push -q origin "HEAD:refs/heads/$WB" >/dev/null 2>&1 || true
done

# push.sh skips the network when there is provably nothing to push, and pushes
# whenever it cannot prove that. Read the header there before "optimising" it —
# the obvious version of this check fails silently on a checkout with no
# remote-tracking ref, which is the one failure this whole file exists to stop.
if ! bash tools/push.sh >/dev/null 2>&1; then
  # A FAILED PUSH MUST NEVER BE SILENT.
  # Committing locally and failing to push looks identical to working: the tree
  # is clean, CHECKPOINT.md updates, every status line says saved. But the
  # container is destroyed when the session ends, so those commits are as lost
  # as work never written — and nobody finds out until the next account clones
  # and the work simply is not there. Measured before this existed: three
  # commits piled up with no output at all.
  N="$(git rev-list --count '@{u}'..HEAD 2>/dev/null || echo 'Some')"
  SYSMSG="PUSH TO GITHUB IS FAILING. $N commit(s) exist ONLY in this container and will be LOST when the session ends — the work is committed locally but is NOT on GitHub, so a new session on another account will not see it. Check the connection, then run:  git push origin HEAD"
else
  # MAIN MOVES WITH EVERY SAVE (2026-09-27b). New sessions start from main,
  # and main used to move only on a deliberate ckpt.sh — so the autosaved
  # half-finished change of a session cut off by a cap sat on its own branch
  # where the next session never looked, and resume.sh's "INTERRUPTED
  # MID-CHANGE" warning could not fire. Fast-forward only: GitHub refuses a
  # non-fast-forward push, so a diverged main is left alone (quietly — the
  # branch push above already saved the work, and resume.sh flags branches
  # main does not contain). Skipped when main already has HEAD.
  BR="$(git branch --show-current 2>/dev/null || true)"
  if [ -n "$BR" ] && [ "$BR" != "main" ]; then
    MAINREF="$(git rev-parse -q --verify refs/remotes/origin/main 2>/dev/null || true)"
    if [ "$MAINREF" != "$(git rev-parse HEAD 2>/dev/null)" ]; then
      if timeout 30 git push -q origin HEAD:refs/heads/main >/dev/null 2>&1; then
        git update-ref refs/remotes/origin/main HEAD >/dev/null 2>&1 || true
      fi
    fi
  fi
fi

# ONE reply: stdout must be a single JSON object or Claude Code drops it.
if [ -n "$SYSMSG$CTX" ] && command -v python3 >/dev/null 2>&1; then
  SYSMSG="$SYSMSG" CTX="$CTX" EVENT="$EVENT" python3 -c '
import json, os
o = {}
if os.environ.get("SYSMSG"): o["systemMessage"] = os.environ["SYSMSG"]
if os.environ.get("CTX") and os.environ.get("EVENT") == "PostToolUse":
    o["hookSpecificOutput"] = {"hookEventName": "PostToolUse", "additionalContext": os.environ["CTX"]}
if o: print(json.dumps(o))
' 2>/dev/null || true
elif [ -n "$SYSMSG" ]; then
  printf '{"systemMessage": "%s"}\n' "$(printf '%s' "$SYSMSG" | sed 's/"/\\"/g')"
fi

exit 0
