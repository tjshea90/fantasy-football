# TASKS — the current job, in Tj's words

**There is no active job right now.** The nav-refactor request, the
branch-reconciliation, and the Data-tab bug fix + score-entry redesign are
all complete and archived at the end of `LADDER.md` (§19, §20, §21). Shipped
as v5.3 (versionCode 503; not yet through `ship.sh`'s full release gate).

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

- [ ] Confirm v5.3 on the phone: the Data tab's sync-status line shows a real
      game count (not "[object Object]"), the weekly-scores section reads as
      simple (team name + box, nothing else), and everything from §19/§20
      still works (back button, Adjust button, Roster/Wire tabs, the two-box
      Live tab, the narrowed Lineups tab).
- [ ] **Decide on repo cleanup, deferred three times now**: fast-forward
      `main` to this branch? Delete the 3 stale sibling branches
      (`android-app-nav-ui-refactor-os6q53`, `resume-logic-claude-code-
      2ye25r`, `live-tab-dual-scores-h2nxyf`)? A future session should
      re-raise this if he still hasn't said.
- [ ] Verify v4.7-era item: **Data > Test the projection feed** (a QB should
      land near 40-55 under this scoring; 15-25 means the re-scoring is not
      running), and **Data > Test the key** if he wants Claude's reads.
