#!/usr/bin/env bash
# toobig.sh — fires when the conversation has grown enough to auto-compact.
#
# WHY THIS EXISTS
# ---------------
# This is the moment Tj's usage actually goes. Every turn resends the whole
# conversation, and prompt caching only makes that cheap while the cache is
# WARM. Come back to a big session hours later and the cache has expired: the
# entire conversation is re-read at full price before a single new word is
# written. That is what made the old Cowork chats so expensive — not the work,
# the re-reading of the chat the work happened in.
#
# Compaction is not the escape either. It REWRITES the earlier messages, which
# is itself a cold start on the rewritten portion, and it summarises away
# detail that CHECKPOINT.md holds losslessly on disk anyway.
#
# The cheap move is to stop and start a fresh session: tools/resume.sh rebuilds
# everything a session needs in ~150 lines, versus re-reading a conversation
# that by this point is hundreds of times that. GitHub made that switch free —
# in Cowork, abandoning a chat meant losing your place unless a zip was
# attached, so staying in the huge chat was the safer option. It no longer is.
#
# So: guarantee everything is saved, then say so plainly.
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$D" || exit 0

bash tools/autosave.sh >/dev/null 2>&1 || true

UNPUSHED="$(git rev-list --count '@{u}'..HEAD 2>/dev/null || echo '?')"
if [ "$UNPUSHED" = "0" ]; then
  STATE="Everything is committed and pushed to GitHub."
else
  STATE="WARNING: $UNPUSHED commit(s) are not pushed yet — run: git push origin HEAD"
fi

echo "{\"systemMessage\": \"This session is now large enough to auto-compact, which is the point where it starts costing real usage: every turn resends the whole conversation, and compaction rewrites it rather than shrinking what you pay for. $STATE  Cheapest next move: run  bash tools/ckpt.sh \\\"what I just did\\\" \\\"what comes next\\\"  and then START A NEW SESSION on whichever account has usage left. It resumes from GitHub in about 150 lines instead of re-reading this entire conversation. Nothing is lost by doing that.\"}"
exit 0
