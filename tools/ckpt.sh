#!/usr/bin/env bash
# ckpt.sh — THE FAST CHECKPOINT. Run after every meaningful edit, not just at
# the end of a task. Takes well under a second.
#
# WHY THIS EXISTS SEPARATELY FROM ship.sh
# --------------------------------------
# ship.sh is a RELEASE gate: it refuses to produce a zip unless STATE.md is
# current, the manifest agrees, all six suites are green and the APK's dex
# contains a class for every Java source. That strictness is correct for
# something Tj installs — and exactly wrong for the middle of a job, which is
# precisely when a usage cap lands. A session that can only checkpoint when
# everything is green cannot checkpoint at all while it is halfway through a
# three-file change, so the interruption costs the whole change.
#
# ckpt.sh has NO gate. It commits whatever is on disk, red suites and all, and
# records honestly whether the tests passed. A broken intermediate state that
# is COMMITTED and DESCRIBED is recoverable; the same state uncommitted is not.
#
#   bash tools/ckpt.sh "what I just did" "what comes next"
#
# Both notes are written into CHECKPOINT.md and into the commit message, so a
# session resuming hours later reads one file and knows where it stands. The
# second argument is the important one: "what comes next" is the thing that is
# lost when a session dies, and it is the thing no diff can reconstruct.
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$D" || exit 1

DID="${1:-}"; NEXT="${2:-}"
[ -z "$DID" ] && { echo "usage: bash tools/ckpt.sh \"what I just did\" \"what comes next\""; exit 1; }

# ---- test state, recorded rather than enforced ------------------------------
# Never gate on this. The point is to capture the state, whatever it is.
# DISCOVERED, NOT LISTED. A hard-coded list silently stops covering the suite
# you just added — which is the same class of hole as v3.0's discarded javac
# exit status and v3.10's ship.sh that never ran the tests at all: a check that
# exists but is not wired to the thing it is meant to stop. This caught itself
# within a minute of being written (test_ai.js was added and the gate reported
# "all 6 suites green" without ever running it).
PASS=0; FAIL=0; REDS=""
for T in tools/test_*.js tools/check_es2018.js; do
  [ -f "$T" ] || continue
  if node "$T" >/dev/null 2>&1; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); REDS="$REDS $(basename "$T" .js)"; fi
done
if [ "$FAIL" -eq 0 ]; then TESTS="all $PASS suites green"; else TESTS="$FAIL RED:$REDS ($PASS green)"; fi

VER="$(cat VERSION 2>/dev/null || echo '?')"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
N="$(git rev-list --count HEAD 2>/dev/null || echo 0)"
N=$((N+1))

# ---- rewrite the resume card ------------------------------------------------
# CHECKPOINT.md is regenerated every time rather than appended to, so it can
# never grow stale or contradict itself. The history lives in git log; this
# file is only ever "where things stand right now".
{
  echo "# CHECKPOINT $N — read me first, then TASKS.md"
  echo
  echo "**Written:** $STAMP · **version:** $VER · **tests:** $TESTS"
  echo
  echo "## Just done"
  echo "$DID"
  echo
  echo "## Do this next"
  echo "${NEXT:-see the first unticked box in TASKS.md}"
  echo
  echo "## How to resume, exactly"
  echo "Open this GitHub repo in a Claude Code session on ANY of the three"
  echo "accounts and say \"continue\". The SessionStart hook runs tools/resume.sh,"
  echo "which pulls the latest and prints this file automatically — nothing has"
  echo "to be attached, uploaded or explained. If that briefing did not appear,"
  echo "run it by hand:"
  echo '```bash'
  echo "bash tools/resume.sh       # pull + this file + TASKS.md + the rules"
  echo '```'
  echo "Then continue from **Do this next** above. Do not re-plan, do not re-read"
  echo "finished work, do not ask Tj to re-explain anything — \`TASKS.md\` carries his"
  echo "request in his own words and \`git log\` carries every step already taken."
  echo
  echo "## Uncommitted right now"
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    git status --porcelain 2>/dev/null | sed 's/^/    /'
  else
    echo "    (nothing — the tree is clean as of this checkpoint)"
  fi
  echo
  echo "## Last ten checkpoints"
  echo '```'
  git log --oneline -10 2>/dev/null | sed 's/^/  /'
  echo '```'
} > CHECKPOINT.md

# ---- commit -----------------------------------------------------------------
git add -A >/dev/null 2>&1

# THE ONE EXCEPTION TO "NO GATE".
# Everything above is deliberately ungated: a red suite commits, a half-written
# function commits, because a described broken state is recoverable and an
# uncommitted one is not. A live credential is a different category. This repo
# is PUBLIC and every checkpoint is pushed, so a key that reaches a commit has
# to be rotated — deleting the commit does not undo it, GitHub keeps the object
# reachable by SHA. So this refuses, and it is the only thing that does.
if ! bash tools/secretscan.sh; then
  git reset -q >/dev/null 2>&1
  echo "  NOTHING COMMITTED. Remove the credential above and re-run this."
  exit 1
fi

if git diff --cached --quiet 2>/dev/null; then
  echo "  ckpt $N: nothing changed on disk — no commit made"
else
  git commit -q -m "ckpt $N: $DID

next: ${NEXT:-see TASKS.md}
tests: $TESTS

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" >/dev/null 2>&1
  echo "  ckpt $N committed · $TESTS"
fi
[ "$FAIL" -gt 0 ] && echo "  NOTE: red suites recorded, not hidden:$REDS"

# ---- push --------------------------------------------------------------------
# A commit that never leaves this container is not a checkpoint. The work is
# split across three Claude accounts and each one starts in a FRESH container
# that clones from GitHub — so anything only committed locally is exactly as
# lost as if it had never been written, the moment a usage cap ends the session.
# Best-effort: a failed push must not fail the checkpoint (the commit is made
# either way, and autosave.sh retries the push after the next edit).
if bash tools/push.sh; then
  echo "  pushed to GitHub — a new session on any account resumes from here"
else
  echo "  WARN  COULD NOT PUSH. This checkpoint exists only in this container,"
  echo "        and containers do not survive the session. Retry by hand:"
  echo "          git push origin HEAD"
fi
exit 0
