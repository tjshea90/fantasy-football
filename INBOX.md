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

## 2026-09-15T02:01:25Z
```
Continue building the stats tab feature
```

## 2026-09-15T02:42:43Z
```
Look at the attached screenshots. It won't load week 1 for the top players at all even though I have week 1 selected. Also the team tab doesn't show the player names who scored those statistics
```

## 2026-09-15T03:34:11Z
```
Do an overall sweep for bugs and ways to improve ui and functionality. In the rosters tab , move the trade evaluator to the very bottom, I want to see team rosters at the top. Make sure if I press the android back arrow it goes to the last thing in the app, because right now when I press back it goes to my android home screen. Make it so if I switch apps then go back to the fantasy app it automatically goes back to what I was already looking at last. Right now it always jumps back to the live tab if I switch apps then go back to it. If it is possible, when I switch back to the fantasy app from another app, immediately show the thing I was last looking at without the logo of the app splashing. Right now when I switch back to the app, it splashes the app logo first. I want no delays. Get rid of anywhere in the app where it says how much Claude api usage I have left, because I no longer have the API key. Instead, put an estimate of what each request would cost on a Claude api. For example, under "ask Claude" put "estimated 8 cents". Try to make the price estimate accurate, or if it is better, ask Claude itself to estimate the cost via the API. In the advice section, for the bench players, let me see a Claude explanation for each player why not to start them that week, just as it explains for why to start the starting players it recommends. In the data section, there is an option to refresh the total player database for all teams. Keep this there but also make the app itself automatically refresh this data at least every couple days and each time I refresh waiver wire information or anything else that it is important to see all players. 

After all these are finished, run tests that everything works and everything is well coded and efficient
```
