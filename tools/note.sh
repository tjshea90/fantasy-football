#!/usr/bin/env bash
# note.sh "what I just learned" — save a FINDING to GitHub in one step.
#
#   bash tools/note.sh "lineup revert: autoFillWeek re-picks every non-manual slot on boot (ui.js autoFillWeek -> Store.applyAuto)"
#
# WHY (Tj, 2026-09-27: "the Claude resume checkpoint system completely failed
# ... I must be able to resume Claude work without losing data or wasting
# usage"). autosave.sh saves FILES and ckpt.sh saves STEPS. Neither saves an
# analysis in progress: the session that took the 2026-09-27 request spent its
# last ~9 minutes working out causes, edited nothing, hit the usage cap — and
# the next account paid for the same analysis from scratch. A finding costs
# one line here and survives the cap.
#
# Appends a timestamped line to WORKLOG.md, commits, pushes the branch and
# fast-forwards main (autosave.sh), then says plainly whether it reached
# GitHub. No tests, no gate: it must be cheap enough to use every few minutes.
# resume.sh prints the tail of WORKLOG.md into every new session.
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$D" || exit 1
NOTE="$*"
[ -z "$NOTE" ] && { echo 'usage: bash tools/note.sh "what you learned / decided / ruled out"'; exit 1; }
if [ ! -f WORKLOG.md ]; then
  cat > WORKLOG.md <<'HDR'
# WORKLOG — findings as they happen (tools/note.sh)

One line per finding, newest last: causes found, where the code is, decisions,
dead ends ruled out. Written so a session cut off mid-analysis leaves what it
learned on GitHub. resume.sh prints the tail. When a job is archived to
LADDER.md, its lines here go with it.
HDR
fi
printf -- '- %s · %s — %s\n' "$(date -u +%Y-%m-%dT%H:%MZ)" \
  "$(git branch --show-current 2>/dev/null || echo '?')" "$NOTE" >> WORKLOG.md
bash tools/autosave.sh </dev/null >/dev/null 2>&1
if bash tools/push.sh >/dev/null 2>&1 && [ -z "$(git status --porcelain -- WORKLOG.md 2>/dev/null)" ]; then
  echo "  noted + pushed to GitHub (WORKLOG.md)"
else
  echo "  !! noted in WORKLOG.md but NOT on GitHub yet — run: git push origin HEAD"
  exit 1
fi
