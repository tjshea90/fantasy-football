#!/usr/bin/env bash
# ship.sh — MILESTONE release. Not the routine checkpoint; that is tools/ckpt.sh.
#
# GITHUB REPLACED THE ZIP (changed 2026-09-09).
# This used to build FFTracker_v<V>.zip into the parent directory, because in
# Cowork the zip was the only thing that survived the chat and the resume
# procedure was "attach it to a new chat". None of that is true now: the repo
# is the transport, every checkpoint is pushed, and a new session on any of the
# three accounts clones it. A zip written next to the repo would not even be
# committed — it would die with the container, which is the exact failure the
# zip existed to prevent.
#
# So the gates below are unchanged (they are what make a release trustworthy)
# and the output is now: a versioned APK committed under releases/, plus a
# pushed commit. GitHub Actions builds its own APK from the same commit.
# VERSION is the single source of truth (see tools/version.sh). If a zip for the
# current version already exists, the version is bumped and written back, so two
# checkpoints can never collide and every zip name says exactly what it is.
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$D" || exit 1
# (there is no longer an output directory outside the repo — see the header)
# shellcheck source=tools/version.sh
. "$D/tools/version.sh"
NOTE="${1:-}"; [ -z "$NOTE" ] && { echo "FAIL: a one-line change note is required."; exit 1; }
echo "== checkpoint =="
rm -rf __pycache__ tools/__pycache__ 2>/dev/null

# COMMIT BEFORE ZIPPING. The zip carries .git so a resumed session gets the
# whole history — but a zip built from a DIRTY tree carries the final files
# plus a history that does not contain them, and bootstrap.sh then greets the
# next session with "uncommitted edits are present, the last session may have
# been interrupted mid-change" when nothing of the sort happened. Worse, the
# real signal is destroyed: that warning is how a genuinely interrupted session
# is recognised, and it must not cry wolf on every clean ship.
if [ -d .git ] && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  bash tools/ckpt.sh "ship: $NOTE" "verify on the phone" >/dev/null 2>&1
  echo "  OK    committed the working tree before zipping"
fi
# IS STATE.md STALE? Asked properly, not by calendar.
#
# This used to be `grep "Last updated: $(date +%F)" STATE.md`, which fails the
# moment the clock rolls past midnight even when STATE.md is perfectly current
# — a session that shipped at 23:50 could not ship again at 00:10 without
# faking a date. Worse, it PASSES for a whole day after one token edit, so it
# never actually measured what it claims to.
#
# The real question is whether the narrative has kept up with the code. Commit
# timestamps answer that and survive cloning (file mtimes do not — every file
# in a fresh clone is stamped at clone time, so `find -newer` is meaningless
# here).
if [ -d .git ]; then
  ST="$(git log -1 --format=%ct -- STATE.md 2>/dev/null || echo 0)"
  SRC="$(git log -1 --format=%ct -- app android 2>/dev/null || echo 0)"
  if [ "${ST:-0}" -lt "${SRC:-0}" ]; then
    echo "  FAIL  STATE.md is older than the last change to app/ or android/."
    echo "        It is the narrative the next account reads for WHY things are"
    echo "        the way they are. Update it, then ship."
    exit 1
  fi
fi
bash bootstrap.sh >/dev/null 2>&1 || { echo "  FAIL  bootstrap does not pass. Fix MANIFEST.txt, then re-run."; bash bootstrap.sh | head -20; exit 1; }
echo "  OK    STATE.md current, manifest agrees"

# ---- the test suites must be green -----------------------------------------
# ship.sh checked the APK's dex and the manifest, but never ran the tests, so a
# zip could go out with a red suite. That is the same class of hole as v3.0's
# discarded javac exit status: a check that exists but is not wired to the
# thing it is supposed to stop.
# Discovered with a glob, never listed by hand — see tools/ckpt.sh for why a
# hard-coded list is a hole rather than a convenience.
FAILED=""
for T in tools/test_*.js tools/check_es2018.js; do
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
# Both tests are now durable across containers. The old one checked for a zip
# in the parent directory, which a fresh container never had — so a resumed
# session happily re-shipped v3.0 on top of the v3.0 Tj already had installed.
# releases/ and BUILDLOG.md are both committed, so neither can forget.
while [ -e "releases/FFTracker-v${V}.apk" ] || grep -q "| v${V} |" BUILDLOG.md 2>/dev/null; do
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
printf '%s | v%s | step %s/%s | %s\n' "$(date -u +%Y-%m-%dT%H:%MZ)" "$V" "$DONE" "$TOT" "$NOTE" >> BUILDLOG.md
grep -q '^BUILDLOG.md$' MANIFEST.txt || echo 'BUILDLOG.md' >> MANIFEST.txt

# The APK is COMMITTED, at a versioned path, so Tj can install it from the
# GitHub app on his phone and so a later session can tell which build he
# actually has. MANIFEST.txt is updated in the same breath because bootstrap.sh
# checks it in both directions and would fail on the new file otherwise.
APK="releases/FFTracker-v${V}.apk"
if [ -f build/app-release.apk ]; then
  mkdir -p releases && cp build/app-release.apk "$APK"
  grep -q "^${APK}$" MANIFEST.txt || echo "$APK" >> MANIFEST.txt
  echo "  OK    apk committed at $APK"

  # PRUNE OLD RELEASES. Each APK is ~215 KB and every fresh session on every
  # account clones all of them — twenty ships would be 4 MB of dead weight
  # downloaded before a single line is read, to keep versions nobody installs.
  # Three is enough to roll back to a known-good build. Older ones stay in git
  # history (recoverable by SHA), they just stop riding along in the checkout.
  KEEP=3
  OLD="$(ls -1 releases/FFTracker-v*.apk 2>/dev/null | sort -V | head -n -"$KEEP")"
  if [ -n "$OLD" ]; then
    for f in $OLD; do
      git rm -q --cached "$f" >/dev/null 2>&1 || true
      rm -f "$f"
      # MANIFEST is checked in BOTH directions, so a pruned file left listed
      # would fail bootstrap.sh on the next session.
      grep -vxF "$f" MANIFEST.txt > MANIFEST.tmp && mv MANIFEST.tmp MANIFEST.txt
      echo "  ..    pruned old release $(basename "$f") (still in git history)"
    done
  fi
else
  echo "  WARN  no APK in build/ — nothing new to publish this ship"
fi

# Commit everything the gates produced. The earlier commit ran BEFORE them so
# the tests judged a committed tree; BUILDLOG.md, VERSION, MANIFEST.txt and the
# release APK are all written after it, so without this the tree is left dirty
# and the next session is told it was interrupted when it was not.
if [ -d .git ] && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  git add -A >/dev/null 2>&1
  if bash tools/secretscan.sh; then
    git commit -q -m "ship v$V: $NOTE

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" >/dev/null 2>&1
    echo "  OK    working tree committed"
  else
    git reset -q >/dev/null 2>&1
    echo "  FAIL  a credential is in the tree — nothing committed or published."
    exit 1
  fi
fi

# THE SHIP IS NOT DONE UNTIL IT IS PUSHED. Everything above happened inside a
# container that will be destroyed. Unlike ckpt.sh, this one is fatal on
# failure: a "shipped" version that exists nowhere but here is a lie, and the
# next session would bump past it and never build it again.
if bash tools/push.sh; then
  echo "  OK    pushed to GitHub"
else
  echo "  FAIL  COULD NOT PUSH. v$V exists only in this container and will be"
  echo "        lost when the session ends. Retry:  git push origin HEAD"
  exit 1
fi

echo "  OK    ladder $DONE/$TOT complete"
echo
echo "== shipped v$V =="
echo
echo "  Tj installs it from:  github.com/tjshea90/fantasy-football"
echo "                        -> $APK  (tap it, then Download)"
echo
echo "  To continue in a NEW session, on ANY of the three Claude accounts:"
echo "  open the repo and say \"continue\". The SessionStart hook briefs it"
echo "  automatically — nothing is attached and nothing is explained."
