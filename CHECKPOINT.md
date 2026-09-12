# CHECKPOINT 88 — read me first, then TASKS.md

**Written:** 2026-09-12T05:51:16Z · **version:** 4.7 · **tests:** all 13 suites green

## Just done
CRITICAL BUG FOUND WHILE INVESTIGATING WHY TJ HAS v5.0: 'keepAdj' was referenced at ui.js's sync path (doSync) but never declared — a ReferenceError on the first matched player of EVERY sync, since the v4.2 baseline per a sibling branch's diagnosis. This is why 'Sync week' has been silently broken on main/v4.7 (and inherited into this branch) this whole time. Fixed by declaring and populating keepAdj from the existing stats before the wipe, exactly as branch claude/resume-logic-claude-code-2ye25r independently fixed it. Also hardened test_boot.js's regression check, which only grepped for the USE site (keepAdj[pid]) and stayed green the whole time the DECLARATION was missing — added a second assertion for the declaration itself. Also discovered: at least 3 OTHER unmerged branches (android-app-nav-ui-refactor-os6q53 v4.8, resume-logic-claude-code-2ye25r v4.8, live-tab-dual-scores-h2nxyf v5.0) forked from the same v4.7 base as this one and shipped independently; main is still stuck at v4.7; Tj's phone has v5.0 from the live-tab-dual-scores branch, which has NONE of this session's nav-refactor work but DOES have a Table-tab manual-score-entry feature this branch's work would delete. Told Tj directly; waiting on his call for how to reconcile.

## Do this next
waiting on Tj's decision on how to reconcile the 4 divergent branches (this one, android-app-nav-ui-refactor-os6q53, resume-logic-claude-code-2ye25r, live-tab-dual-scores-h2nxyf) before doing any merge work

## How to resume, exactly
Open this GitHub repo in a Claude Code session on ANY of the three
accounts and say "continue". The SessionStart hook runs tools/resume.sh,
which pulls the latest and prints this file automatically — nothing has
to be attached, uploaded or explained. If that briefing did not appear,
run it by hand:
```bash
bash tools/resume.sh       # pull + this file + TASKS.md + the rules
```
Then continue from **Do this next** above. Do not re-plan, do not re-read
finished work, do not ask Tj to re-explain anything — `TASKS.md` carries his
request in his own words and `git log` carries every step already taken.

## Uncommitted right now
     M CHECKPOINT.md

## Last ten checkpoints
```
  fea715f ckpt 84: job complete and archived: moved the 2026-09-12 request (7/7 items) from TASKS.
  033e178 ckpt 81: verified the build: ran build.sh end-to-end (first run, downloaded the Android 
  26dc8b6 ckpt 80: tasks 3-7 done: deleted the Table/League tabs and their view code entirely (vie
  21fd85f ckpt 61: task 1 done: Android back button now unwinds a real tab-visit history (ui.js na
  84cdb98 ckpt 52: wrote Tj's new nav/UI overhaul request into TASKS.md verbatim before starting (
  3dbbef9 ckpt 50: scan fixes: ship.sh's STATE.md gate compared the CALENDAR DATE so it broke at m
  5d3fb69 ckpt 48: usage scan: archived the finished 2026-09-09 job from TASKS.md into LADDER.md (
  1553bac ckpt 45: usage optimisation: bootstrap printed an 851-char JAVA_TOOL_OPTIONS dump into e
  53c689e ckpt 44: reverted the end-to-end handoff test: it simulated a cap landing mid-edit, push
  07d0984 ckpt 42: wrote Tj's new request into TASKS.md before starting
```

(3 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
