# TASKS — the current job, in Tj's words

## Current job — the 2026-09-27b request (the resume/checkpoint system failed)

> "Continue doing what you are doing, but note that the Claude resume
> checkpoint system completely failed. Most of these tasks are already
> completed in a prior Claude session. The checkpoint system is important and
> I must be able to resume Claude work without losing data or wasting usage"

(v9.0 itself is done and archived — LADDER.md §46. This job is the tooling.)

- [x] 2a. Diagnose where the prior session's work went. FOUND: the session
      that took the 17:19Z request ran on another account (not visible from
      this one). Its hooks and pushes worked — inbox capture 972bcc6 and
      "ckpt 52" 515598e (17:21:24Z) both reached GitHub, on its branch
      claude/lineup-persistence-live-scoring-wpjlve AND main. Nothing after
      17:21:24 ever did; this session started 17:31:06 from 515598e. Its
      checkpoint said "Do this next: 1a: find why the lineup reverts", so the
      likeliest story is ~9 minutes of READ-ONLY analysis (Read/Grep/Bash
      reads) that autosave never saves — findings lived only in its context
      and died with the usage cap. The other possible story: edits made in a
      git worktree / isolated subagent copy, which autosave never looks at.
      Both are holes; both get closed below.
- [ ] 2b. Findings journal: WORKLOG.md + `tools/note.sh "finding"` (append,
      commit, push in one step). resume.sh prints its tail. CLAUDE.md: note
      what you learned AS you learn it, not only what you changed.
- [ ] 2c. Automatic backstop that needs no discipline: a PostToolUse hook on
      EVERY tool (reads included) saves Claude's own recent messages from the
      session transcript to SESSIONLOG.md and pushes it (throttled), and
      after a run of research calls with nothing saved it tells the session
      to write a note.
- [ ] 2d. autosave also commits+pushes edits made inside git worktrees, AND
      fast-forwards main on every save (it only pushed the session's own
      branch; main moved only on ckpt.sh — and new sessions start from main,
      so a cut-off session's autosaved edits were invisible to the next one).
      build-apk.yml: skip Markdown-only pushes, cancel superseded runs.
- [ ] 2e. resume.sh: (1) flag other branches carrying recent commits this
      checkout does not have (stranded work); (2) inbox-only commits no longer
      count as "INTERRUPTED MID-CHANGE".
- [ ] 2g. Stop wasting usage at every start: the briefing measured 42,656
      chars, re-sent every turn — 25,245 of it "Waiting on Tj" (a dozen
      phone-confirm asks v5.5-v7.4 that later versions superseded, plus two
      "Decide" items v6.7 already resolved). Keep the full text in WAITING.md
      (not printed); TASKS.md keeps only the live asks. And INBOX.md captured
      harness <task-notification>s as if Tj sent them (34 of 68 entries),
      crowding his real messages out of the briefing's inbox tail.
- [ ] 2f. Named test (tools/test_checkpoint.js) driving the real scripts in a
      scratch repo with a bare "GitHub" remote; confirmed to fail on the old
      scripts. Then light test, ckpt, onto main.

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
