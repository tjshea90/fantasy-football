# TASKS — the current job, in Tj's words

**There is no active job right now.** The 2026-09-12 request (back button,
Adjust-button gating, delete Table/League, focus Live on mine-vs-opponent
only, Roster-as-tabs, new Wire tab, Data tab audit) is complete — all 7
items written, tested and committed — and archived at the end of `LADDER.md`
(§19). It has not been through `ship.sh` yet, so there is no new version
number; `build.sh` was run once to confirm it compiles and packages clean.

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

- [ ] Try the 2026-09-12 changes on the phone: the back button (it should
      never close the app, and should step back through wherever you actually
      came from), the "Adjust" button on a player's stat card (the keyboard
      should no longer pop up just from opening one), the Roster tab (now
      per-team tabs instead of one long scroll), and the new Wire tab (free
      agents moved off Roster).
- [ ] Verify v4.7 on the phone: **Data > Test the projection feed** (a QB
      should land near 40-55 under this scoring; 15-25 means the re-scoring is
      not running), and **Data > Test the key** if he wants Claude's reads.
