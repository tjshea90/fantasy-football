# INBOX.md — the raw paper trail, not the plan

Every message Tj sends lands here VERBATIM, the instant it arrives, via a
`UserPromptSubmit` hook (`tools/capture_inbox.sh`) — before any session has
done a single read, let alone written anything to `TASKS.md`. It is
committed and pushed immediately, on its own, independent of whether the
session that receives it ever gets around to acting on it.

This exists because of a real failure (2026-09-15): a session spent its
whole budget reading the codebase for a new feature request, was cut off by
a usage cap before ever writing that request to `TASKS.md`, and the next
session opened cold with nothing on disk to find. The `PostToolUse` autosave
hook only fires after `Edit|Write|NotebookEdit|Bash` — a pure research
stretch trips it zero times. This file is the backstop that does not depend
on any tool call happening at all: it fires on the message itself.

**This is not TASKS.md.** TASKS.md is the curated, broken-down version a
session writes deliberately, in Tj's words but organised into checkable
steps. This file is uncurated and append-only — `tools/resume.sh` prints its
tail on every session start specifically so a resuming session can compare
"does TASKS.md already cover the last thing in here?" If yes, this file cost
nothing but the compare. If no, THIS is the request that was never written
down — read it and write it into TASKS.md before doing anything else.

Once an entry here is reflected in TASKS.md (and eventually LADDER.md), it
can be trimmed from this file — it is a safety net, not an archive. When it
gets long, keep only entries newer than the oldest one not yet folded into
TASKS.md.

---

## 2026-09-15T01:58:01Z
```
test message with "quotes" and
newline
```
