#!/usr/bin/env bash
# version.sh — the single source of truth for the app version.
# Format is deliberately dumb: MAJOR.MINOR, both plain integers. v1.8, v1.9, v2.0.
# Nothing else in the bundle may hard-code a version number.
ver_read() { tr -d ' \t\n\r' < "$(dirname "${BASH_SOURCE[0]}")/../VERSION"; }
ver_next() {                      # 1.8 -> 1.9 ; 1.9 -> 2.0
  local v="$1" maj min
  maj="${v%%.*}"; min="${v##*.}"
  min=$((min + 1))
  if [ "$min" -ge 10 ]; then maj=$((maj + 1)); min=0; fi
  printf '%s.%s' "$maj" "$min"
}
ver_code() {                      # 1.8 -> 108 ; 2.0 -> 200 (monotonic for Android)
  local v="$1"; printf '%d' $(( ${v%%.*} * 100 + ${v##*.} ))
}
