#!/usr/bin/env bash
# bootstrap.sh — cold start. Verify the bundle, then brief the session.
#
# WHY THIS PRINTS SO LITTLE NOW (changed 2026-09-07)
# -------------------------------------------------
# It used to cat STATE.md + LADDER.md + BRIEF.md in full: about 1,200 lines,
# roughly 40k tokens, on every single cold start. In Cowork that is not a
# one-off cost — everything printed into the conversation becomes permanent
# prefix that is resent on every subsequent turn and re-paid at full price the
# moment the cache goes cold. The bundle's own BRIEF.md forbids dumping a
# source file into the reply for exactly that reason, and then bootstrap.sh
# dumped three.
#
# So the default briefing is now the ~120 lines a session actually needs to
# resume correctly: where it stopped, what is next, what the scope is, and the
# constraints that must never be violated. The long narrative history stays on
# disk and is read when a specific question needs it.
#
#   bash bootstrap.sh          # verify + the short briefing (do this)
#   bash bootstrap.sh --full   # ...plus STATE.md, LADDER.md and BRIEF.md whole
#
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$D" || exit 1
FULL=0; [ "${1:-}" = "--full" ] && FULL=1
echo "== FF Season Tracker — bootstrap =="
echo "working dir: $D"; echo
fail=0
# --- manifest, both directions ---
# .claude/scheduled_tasks.lock is the harness's own runtime state for the
# ScheduleWakeup/Routine feature, not project content — it is already
# git-ignored (.git/info/exclude), so excluded here too rather than flagged
# as a stray file on every session that happens to use a scheduled wakeup.
# .claude/settings.json (the SessionStart hook config) is real project
# content and stays fully checked, so this excludes the one file by name
# rather than the whole directory.
mapfile -t listed < <(grep -v '^\s*$' MANIFEST.txt | grep -v '^#')
disk=$(find . -type f -not -path './sdk/*' -not -path './build/*' -not -path './.git/*' \
        -not -path './.ckpt/*' -not -path './.claude/scheduled_tasks.lock' \
        -not -name '*.pyc' -not -name '*.log' -printf '%P\n' | sort)
missing=(); for f in "${listed[@]}"; do [ -e "$f" ] || missing+=("$f"); done
stale=$(comm -23 <(printf '%s\n' "$disk") <(printf '%s\n' "${listed[@]}" | sort))
if [ ${#missing[@]} -gt 0 ]; then echo "  FAIL  listed in MANIFEST but not on disk:"; printf '          %s\n' "${missing[@]}"; fail=1; fi
if [ -n "$stale" ]; then echo "  FAIL  on disk but not in MANIFEST:"; printf '          %s\n' $stale; fail=1; fi
[ $fail -eq 0 ] && echo "  OK    manifest and disk agree exactly (${#listed[@]} files)"
# --- toolchain ---
# The JVM prints a "Picked up JAVA_TOOL_OPTIONS: ..." notice to stderr before
# the version line. In a sandboxed container that notice is an 851-CHARACTER
# proxy/truststore dump, and `head -1` was grabbing it instead of the version —
# putting ~9% of the entire session briefing, every session forever, into a
# line that says nothing. Filter it, do not just widen the pipe.
command -v java >/dev/null && echo "  OK    java $(java -version 2>&1 | grep -v 'JAVA_TOOL_OPTIONS' | head -1 | tr -d '\n' | sed 's/.*version //')" || { echo "  WARN  no java — build.sh will fail"; }
command -v python3 >/dev/null && echo "  OK    python3 $(python3 -V 2>&1 | cut -d' ' -f2)" || echo "  WARN  no python3"
[ -d sdk ] && echo "  OK    android sdk already installed (build.sh will be fast)" || echo "  note  android sdk not installed yet — first build.sh downloads it (~600MB)"
[ -f build/app-release.apk ] && echo "  OK    an APK exists at build/app-release.apk" || echo "  note  no APK built yet"
# --- the checkpoint history ---
# The zip carries .git deliberately. Resuming from an attached zip therefore
# restores every checkpoint, not just the final state of each file, so a
# session interrupted mid-change can see exactly what the change was.
if [ -d .git ]; then
  echo "  OK    checkpoint history present ($(git rev-list --count HEAD 2>/dev/null || echo 0) checkpoints)"
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "  NOTE  uncommitted edits are present — the last session may have been"
    echo "        interrupted mid-change. 'git status' and 'git diff' show what."
  fi
else
  echo "  WARN  no .git — checkpoint history was lost. Run: git init && bash tools/ckpt.sh 'resumed'"
fi
echo
[ $fail -ne 0 ] && { echo "== bootstrap FAILED — fix the manifest before doing anything =="; exit 1; }
echo "== bootstrap clean =="
echo
if [ -f CHECKPOINT.md ]; then
  echo "##############################################################################"
  echo "#  CHECKPOINT.md — where the last session stopped. START HERE."
  echo "##############################################################################"
  cat CHECKPOINT.md
  echo
fi
if [ -f TASKS.md ]; then
  echo "##############################################################################"
  echo "#  TASKS.md — the scope of the current job. Continue from the first [ ]."
  echo "##############################################################################"
  cat TASKS.md
  echo
fi
if [ "$FULL" -eq 0 ]; then
  cat <<'SHORT'
##############################################################################
#  THE RULES THAT MUST NOT BE BROKEN  (full text: BRIEF.md)
##############################################################################
- ONE universal APK, no native libraries, no NDK. WebView + a thin Java shell.
  minSdk 29 / targetSdk 36. Never add an ABI-specific dependency.
- ES2018 ONLY. Android 10 ships Chromium 77: no `?.`, no `??`, no
  `Array.prototype.at`, no `structuredClone`, no top-level await.
  `node tools/check_es2018.js` is the gate.
- ALL network goes through the Java bridge. A file:// page cannot do CORS.
- THE BRIDGE IS ASYNCHRONOUS AND STAYS THAT WAY. A synchronous
  @JavascriptInterface call blocks the renderer's JS thread: no repaint, no
  progress bar, no touch. That froze the app through v1.9. Use
  Native.httpAsync + window.__httpDone. Never "simplify" the promise plumbing.
- THE SCORING ENGINE IS THE PRODUCT. Doubt resolves to RULES_2026.md. A
  completion is worth 1 point here, which is why no outside "projected points"
  number may ever be imported — import the STAT LINE and re-score it.
- NEVER TRUST A BUILD THAT PRINTED AN ERROR. build.sh and ship.sh both refuse;
  do not weaken either guard. v2.7-v2.9 shipped APKs missing half their classes.
- Checkpoint constantly:  bash tools/ckpt.sh "did" "next"   (fast, no gate)
  Ship at milestones:     bash ship.sh "note"               (tests + APK + zip)

  Deeper history, only when a specific question needs it:
    STATE.md    narrative state, decisions taken, traps already paid for
    LADDER.md   the finished programmes, in order
    BRIEF.md    standing rules and the cache-discipline reasoning
    SPEC.md     data contracts — read only the section you are building
    RULES_2026.md   league scoring, ground truth
  Or re-run:  bash bootstrap.sh --full
SHORT
else
  for f in STATE.md LADDER.md BRIEF.md; do
    echo "##############################################################################"
    echo "#  $f"
    echo "##############################################################################"
    cat "$f"; echo
  done
fi
