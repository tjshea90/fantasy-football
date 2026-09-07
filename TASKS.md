# TASKS — the 2026-09-07 request, in Tj's words

**This file is the scope of the current job.** It is not the ladder (`LADDER.md`
is the historical record of finished programmes). A session resuming mid-job
reads `CHECKPOINT.md` for *where*, and this file for *what*.

Ticking a box means: written, tested, committed, and the test that proves it is
named in the box. An unticked box is work that has not happened. **Never tick a
box you have not verified** — the ticks are the only record a resuming session
has, and a false one costs more than an untouched one.

---

## 0. Checkpointing (do this first, he asked for it first)

- [ ] 0a. Fine-grained checkpoints that survive a usage cap mid-edit.
      `git` for history + `tools/ckpt.sh` for one-command commits +
      `CHECKPOINT.md` as the always-current resume card.
- [ ] 0b. `bootstrap.sh` prints `CHECKPOINT.md` + `TASKS.md` + `git log` so a
      cold session is briefed by one command.
- [ ] 0c. The zip carries `.git`, so resuming from an attached zip restores the
      entire history, not just the final files.
- [ ] 0d. Deliver the zip to Tj at every milestone. The container is ephemeral;
      a checkpoint he does not have is a checkpoint that does not exist.

## 1. The three reported bugs

- [ ] 1a. **The JSON error.** Screenshot 3: `Claude FAILED: the model did not
      return usable JSON`. Diagnose it properly and fix the cause, not the
      message. → `tools/test_ai.js`
- [ ] 1b. **Sentences cut off in the advice.** Screenshots 1 and 2: the injury
      note stops mid-word ("Even still, Swift wil"), in both the per-player
      *why* and the FLAGGED list. → `tools/test_ai.js`
- [ ] 1c. **"Re-default all teams now" always says "Nothing to change"** even
      after several changes away from the default. → `tools/test_integration.js`

## 2. The two new Claude-app round trips

Tj: *"I should be able to export a file from the app, upload it to a Claude chat
with no explanation, and Claude creates a file which I can import back into the
football app which fills in all relevant information in the app."*

- [ ] 2a. **Advice tab, under the Sync button.** Export a briefing file →
      upload to a Claude chat → import Claude's reply file → all advice fields
      filled. → `tools/test_handoff.js`
- [ ] 2b. **Roster tab, the "Ask Claude about the wire" button.** Same round
      trip, same file format family. → `tools/test_handoff.js`
- [ ] 2c. The exported file must be self-explanatory to a Claude that has been
      told **nothing** — it carries the league's scoring, the task, the exact
      output contract, and a worked example.
- [ ] 2d. Import must accept what Claude actually hands back (a fenced block,
      a bare object, a whole chat transcript pasted in) and must refuse
      anything else with a reason, never half-apply.
- [ ] 2e. Tested end to end: build the export, run it through the contract,
      import the result, assert the app's fields are populated.

## 3. Game day/time on every roster + early-week alerts

- [ ] 3a. Show the day and time each player plays this week, next to his name,
      everywhere a player is listed. Easy to read at a glance.
- [ ] 3b. Refresh often enough that a schedule change shows up, but only ever
      the current week's games.
- [ ] 3c. **A loud, unmissable alert for players who play BEFORE Sunday** —
      Thursday, and this week a Wednesday game — naming which players and which
      are recommended to start. → `tools/test_schedule.js`

## 4. The sweep he asks for every time, done once, thoroughly

- [ ] 4a. Background behaviour: the app must actually sleep. No timers, no
      network, no CPU when it is not on screen. → `tools/test_lifecycle.js`
- [ ] 4b. Network: cache anything that cannot change, stop refetching it, and
      keep request rates polite enough that no provider ever rate-limits or
      bans. → `tools/test_net.js`
- [ ] 4c. Whole-app bug sweep: correctness, error paths, ES2018, dead code,
      leaks. Everything found is either fixed or written down.
- [ ] 4d. UI/efficiency pass over every screen.
- [ ] 4e. Verify the fixes did not introduce new bugs: full suite green, plus
      the new suites.

## 5. Needs Tj's approval before it happens

He said: *"consider features and ui from other similar apps but do not make any
major changes unless I approve."* So candidates are **listed, not built** — see
the "For your approval" section at the end of `RELEASE_NOTES.md`.

- [ ] 5a. Write the candidate list. Build none of it.
