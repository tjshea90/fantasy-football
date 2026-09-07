#!/usr/bin/env bash
# bootstrap.sh — cold start. Verify the bundle, then print the whole briefing.
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$D" || exit 1
echo "== FF Season Tracker — bootstrap =="
echo "working dir: $D"; echo
fail=0
# --- manifest, both directions ---
mapfile -t listed < <(grep -v '^\s*$' MANIFEST.txt | grep -v '^#')
disk=$(find . -type f -not -path './sdk/*' -not -path './build/*' -not -path './.git/*' \
        -not -name '*.pyc' -printf '%P\n' | sort)
missing=(); for f in "${listed[@]}"; do [ -e "$f" ] || missing+=("$f"); done
stale=$(comm -23 <(printf '%s\n' "$disk") <(printf '%s\n' "${listed[@]}" | sort))
if [ ${#missing[@]} -gt 0 ]; then echo "  FAIL  listed in MANIFEST but not on disk:"; printf '          %s\n' "${missing[@]}"; fail=1; fi
if [ -n "$stale" ]; then echo "  FAIL  on disk but not in MANIFEST:"; printf '          %s\n' $stale; fail=1; fi
[ $fail -eq 0 ] && echo "  OK    manifest and disk agree exactly (${#listed[@]} files)"
# --- toolchain ---
command -v java >/dev/null && echo "  OK    java $(java -version 2>&1 | head -1 | tr -d '\n' | sed 's/.*version //')" || { echo "  WARN  no java — build.sh will fail"; }
command -v python3 >/dev/null && echo "  OK    python3 $(python3 -V 2>&1 | cut -d' ' -f2)" || echo "  WARN  no python3"
[ -d sdk ] && echo "  OK    android sdk already installed (build.sh will be fast)" || echo "  note  android sdk not installed yet — first build.sh downloads it (~600MB)"
[ -f build/app-release.apk ] && echo "  OK    an APK exists at build/app-release.apk" || echo "  note  no APK built yet"
echo
[ $fail -ne 0 ] && { echo "== bootstrap FAILED — fix the manifest before doing anything =="; exit 1; }
echo "== bootstrap clean =="
echo
echo "##############################################################################"
echo "#  STATE.md"
echo "##############################################################################"
cat STATE.md
echo
echo "##############################################################################"
echo "#  LADDER.md — continue from the first unticked step"
echo "##############################################################################"
cat LADDER.md
echo
echo "##############################################################################"
echo "#  BRIEF.md — standing rules (usage discipline matters, read it)"
echo "##############################################################################"
cat BRIEF.md
