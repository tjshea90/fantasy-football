# TASKS — the current job, in Tj's words

**There is no active job right now.** Both the 2026-09-12 nav-refactor request
and the 2026-09-12b branch-reconciliation request are complete — 7/7 and 8/8
items respectively, written, tested and committed — and archived at the end
of `LADDER.md` (§19, §20). Shipped as v5.2 (not yet through `ship.sh`'s full
release gate — VERSION was hand-bumped past a sibling branch's already-issued
v5.0 so the APK would install as an update rather than a downgrade; `build.sh`
confirms it compiles and packages clean).

## When Tj asks for something new

Write it HERE FIRST, in his own words, as unticked boxes — before writing any
code. Until it is on disk the job exists only in a chat window that no other
Claude account can see, and a usage cap landing before the first checkpoint
loses not just the work but the knowledge of what was asked.

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

- [ ] Confirm the v5.2 APK installs over v5.0/v5.1 without needing an
      uninstall, and try everything end to end: the back button, the "Adjust"
      button on a player card, Roster team tabs, the new Wire tab, the
      two-box Live tab, the narrowed Lineups tab, and the weekly-scores +
      standings cards now on the Data tab.
- [ ] **Decide on repo cleanup, deferred once already**: should `main` be
      fast-forwarded to this branch (safe — a clean fast-forward, zero
      conflicts)? Should the 3 stale sibling branches
      (`android-app-nav-ui-refactor-os6q53`, `resume-logic-claude-code-
      2ye25r`, `live-tab-dual-scores-h2nxyf`) be deleted now that their work
      is either superseded or merged in? A future session should re-raise
      this if he still hasn't said.
- [ ] Verify v4.7-era item: **Data > Test the projection feed** (a QB should
      land near 40-55 under this scoring; 15-25 means the re-scoring is not
      running), and **Data > Test the key** if he wants Claude's reads.
