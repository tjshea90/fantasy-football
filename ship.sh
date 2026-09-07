#!/usr/bin/env bash
# ship.sh — checkpoint. Run after EVERY completed ladder step.
# Naming is plain version numbers now: FFTracker_v1.8.zip / FFTracker_v1.8.apk.
# VERSION is the single source of truth (see tools/version.sh). If a zip for the
# current version already exists, the version is bumped and written back, so two
# checkpoints can never collide and every zip name says exactly what it is.
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$D" || exit 1
OUT="$(dirname "$D")"
# shellcheck source=tools/version.sh
. "$D/tools/version.sh"
NOTE="${1:-}"; [ -z "$NOTE" ] && { echo "FAIL: a one-line change note is required."; exit 1; }
echo "== checkpoint =="
rm -rf __pycache__ tools/__pycache__ 2>/dev/null
TODAY=$(date +%Y-%m-%d)
grep -q "Last updated: $TODAY" STATE.md || { echo "  FAIL  STATE.md not updated today. The next chat would not know where this stands."; exit 1; }
bash bootstrap.sh >/dev/null 2>&1 || { echo "  FAIL  bootstrap does not pass. Fix MANIFEST.txt, then re-run."; bash bootstrap.sh | head -20; exit 1; }
echo "  OK    STATE.md current, manifest agrees"

# ---- the test suites must be green -----------------------------------------
# ship.sh checked the APK's dex and the manifest, but never ran the tests, so a
# zip could go out with a red suite. That is the same class of hole as v3.0's
# discarded javac exit status: a check that exists but is not wired to the
# thing it is supposed to stop.
FAILED=""
for T in tools/test_scoring.js tools/test_engine.js tools/test_boot.js \
         tools/test_integration.js tools/test_names.js tools/check_es2018.js; do
  [ -f "$T" ] || continue
  if node "$T" >/tmp/ship-test.log 2>&1; then
    echo "  OK    $(basename "$T")"
  else
    echo "  FAIL  $(basename "$T")"
    grep -E 'FAIL|Error' /tmp/ship-test.log | head -6 | sed 's/^/          /'
    FAILED="$FAILED $(basename "$T")"
  fi
done
if [ -n "$FAILED" ]; then
  echo "  FAIL  not shipping with a red suite:$FAILED"
  exit 1
fi

# THE APK IN THE ZIP MUST BE A REAL ONE. v2.7-v2.9 shipped an APK that was
# missing NativeBridge and Alerts entirely, because build.sh discarded javac's
# exit status and packaged whatever had compiled. Three checkpoints went out
# crashing on launch. Two things are checked now, and neither is optional:
#   1. every Java source has a class inside the dex
#   2. the APK is newer than every source file it claims to contain
if [ -f build/app-release.apk ]; then
  DEX=$(mktemp -d)
  unzip -o -q build/app-release.apk classes.dex -d "$DEX" 2>/dev/null || true
  # Read the dex string table ONCE. `strings file | grep -q` looks right and is
  # not: grep -q closes the pipe on its first match, strings dies of SIGPIPE,
  # and `set -o pipefail` (on at the top of this script) turns that success into
  # a failure — intermittently, depending on where the match falls.
  DEXSTR=$(strings "$DEX/classes.dex" 2>/dev/null || true)
  MISSING=""
  for f in $(find android/src -name '*.java'); do
    CN=$(basename "$f" .java)
    case "$DEXSTR" in
      *"Lcom/tj/fftracker/$CN;"*) ;;
      *) MISSING="$MISSING $CN" ;;
    esac
  done
  rm -rf "$DEX"
  if [ -n "$MISSING" ]; then
    echo "  FAIL  the built APK is missing:$MISSING"
    echo "        Run bash build.sh and read what javac says. Do NOT ship this."
    exit 1
  fi
  NEWER=$(find android app build.sh -newer build/app-release.apk -type f 2>/dev/null | head -3)
  if [ -n "$NEWER" ]; then
    echo "  FAIL  these are newer than the APK — rebuild before shipping:"
    echo "$NEWER" | sed 's/^/          /'
    exit 1
  fi
  echo "  OK    APK contains every class and is newer than every source file"
else
  echo "  WARN  no APK in build/ — the zip will carry the last known-good one"
fi

V="$(ver_read)"
# Two independent reasons to bump, and the second one matters more than it
# looks. The zip-exists test only sees THIS container's output directory, so a
# resumed session in a fresh container happily re-shipped v3.0 on top of the
# v3.0 Tj already had installed — same versionName, same versionCode, no way
# for either of us to tell the two builds apart. BUILDLOG.md travels in the
# zip, so it is the only record that survives a resume: if it already logged a
# ship at this version, this is a NEW build and the number must move.
while [ -e "$OUT/FFTracker_v${V}.zip" ] || grep -q "| v${V} |" BUILDLOG.md 2>/dev/null; do
  V="$(ver_next "$V")"
done
V0="$(ver_read)"
if [ "$V" != "$V0" ]; then
  printf '%s\n' "$V" > VERSION
  echo "  OK    version bumped v$V0 -> v$V"
  # version.js and the APK's versionName are stamped by build.sh FROM VERSION,
  # so a bump after the build means the APK and the About line still say v$V0.
  # Shipping that is how a build lies about which version it is. Stop instead.
  # The APK in build/ was stamped v$V0 and this ship is v$V, so its versionName
  # and its About line are now both wrong. Shipping it is exactly the "a build
  # that lies about itself" failure v3.0 exists to prevent. Re-stamp it here
  # rather than making the caller run the same two commands again: build.sh is
  # fully guarded (javac failure fatal, every source must produce a class), so
  # if this rebuild is not clean it exits non-zero and takes the ship with it.
  if [ -e build/app-release.apk ]; then
    echo "  ..    re-stamping the APK from v$V0 to v$V"
    if ! bash build.sh >/tmp/ship-rebuild.log 2>&1; then
      echo "  FAIL  the re-stamp build did not succeed. Nothing shipped."
      tail -20 /tmp/ship-rebuild.log | sed 's/^/          /'
      exit 1
    fi
    echo "  OK    APK rebuilt at v$V"
  fi
fi
echo "  OK    version v$V (code $(ver_code "$V"))"

DONE=$(grep -c '^- \[x\]' LADDER.md); TOT=$(grep -c '^- \[' LADDER.md)
ZIP="$OUT/FFTracker_v${V}.zip"
printf '%s | v%s | step %s/%s | %s\n' "$(date -u +%Y-%m-%dT%H:%MZ)" "$V" "$DONE" "$TOT" "$NOTE" >> BUILDLOG.md
grep -q '^BUILDLOG.md$' MANIFEST.txt || echo 'BUILDLOG.md' >> MANIFEST.txt
# THE ZIP CARRIES .git ON PURPOSE (changed 2026-09-07).
# In Cowork the zip is the only thing that survives the chat, so excluding the
# history meant a resumed session got the final state of every file and no
# record of how it got there. If a usage cap lands mid-change, that difference
# is everything: with the history, `git log` and `git diff` say exactly what was
# in flight; without it, the next session sees a tree it cannot reason about and
# re-derives work that was already done. .lastbuild/ is gitignored so the 170 KB
# APK is not re-stored on every checkpoint — it is added to the zip separately
# below, which is why it is still in MANIFEST.txt.
( cd "$D" && zip -q -r "$ZIP" . -x 'sdk/*' 'build/*' '*.pyc' '*.log' '.ckpt/*' )
# The last known-good APK travels INSIDE the zip too, so a resumed session can
# hand Tj a working build immediately even before it rebuilds anything.
if [ -f build/app-release.apk ]; then
  mkdir -p .lastbuild && cp build/app-release.apk .lastbuild/app-release.apk
  ( cd "$D" && zip -q "$ZIP" .lastbuild/app-release.apk )
fi
[ -f build/app-release.apk ] && { cp build/app-release.apk "$OUT/FFTracker_v${V}.apk"; echo "  OK    apk copied out: FFTracker_v${V}.apk"; }
echo "  OK    ladder $DONE/$TOT complete"
echo "  zipped $(unzip -l "$ZIP" | tail -1 | awk '{print $2}') files, $(du -h "$ZIP" | cut -f1)"
echo
echo "== checkpoint saved =="
echo "  $ZIP"
echo
echo "  To resume in a NEW chat: attach this zip and say"
echo "  \"resume the tracker build\". Nothing else is needed."
echo
echo "  This zip contains: every source file, the ladder with $DONE/$TOT ticked,"
echo "  STATE.md, VERSION (v$V), and .lastbuild/app-release.apk."
