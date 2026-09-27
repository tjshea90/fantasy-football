# TASKS — the current job, in Tj's words

## Current job

None — the 2026-09-27b checkpoint-system job is archived in LADDER.md §47
(v9.0's lineup/live-DEF/quarter job is §46).

## When Tj asks for something new

Write it HERE FIRST, in his own words, as unticked boxes — before writing any
code. Until it is written into `TASKS.md` as real steps, nobody has actually
planned the work — a message sitting in a chat window is not a task list.

**You do not have to race a usage cap to get the raw request itself onto
disk any more (learned the hard way, 2026-09-15).** A `UserPromptSubmit`
hook (`tools/capture_inbox.sh`) already writes every message Tj sends to
`INBOX.md`, verbatim, and commits+pushes it the instant it arrives — before
you have read a single file. See `INBOX.md`'s own header and CLAUDE.md's
"Saving work" for the full reasoning. This does not lower the bar on writing
`TASKS.md` promptly — it means a forgotten or interrupted `TASKS.md` write is
now a recoverable gap instead of a total loss.

```
# TASKS — the <date> request, in Tj's words

> "<paste what he actually said, verbatim>"

- [ ] 1a. <first step>
- [ ] 1b. <second step>
```

Ticking a box means: written, tested, committed, and the test that proves it is
named in the box. **Never tick a box you have not verified** — the next account
will not re-check it.

When a job is finished, move it to `LADDER.md` and reset this file. This file
is printed into every session briefing, so a finished job left here is re-read
at cost on every cold start, forever.

## Waiting on Tj

The full history of older asks (superseded or answered) is in WAITING.md — not
printed at session start; read it only if one of those issues comes up again.

- [ ] **Confirm v9.0 on the phone**
      https://github.com/tjshea90/fantasy-football/releases/tag/v9.0
      (a) change a slot in your lineup AND your opponent's, fully close the
      app, reopen — both exactly as you left them; (b) a defense at kickoff
      shows 0.0, not 10; (c) a live player row reads "Q2 10:32". Supersedes
      every older "Confirm vX" ask (v5.5-v8.9); the specific checks those
      carried (Wire board rules, back button, week auto-advance, tab lock,
      tab highlight) are in WAITING.md if one of them misbehaves again.
- [ ] **Decide:** the Anthropic API key rides in Android's automatic cloud
      backup / device transfer in plain text (low severity: private, encrypted
      app-data). Fix = move it out of the backed-up JSON into an excluded
      SharedPreferences file (NativeBridge + store/ai/ui + a migration). Fix
      it, or accept it? Full analysis in WAITING.md.
- [ ] **Decide:** get a pay-as-you-go Anthropic API key, or keep the free
      "Or use the Claude app" handoff on Advice and Wire.
- [ ] **Tj only:** delete stale branches — no session can (a permission
      boundary, not a bug). Every finished `claude/*` branch is already
      contained in main.
- [ ] Standing: if a reputable free third projection source turns up, it is
      worth adding (NFL.com, FantasyPros, Yahoo, MFL rejected — LADDER.md §27).
