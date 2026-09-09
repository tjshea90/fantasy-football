# CHECKPOINT 23 — read me first, then TASKS.md

**Written:** 2026-09-09T01:22:43Z · **version:** 4.7 · **tests:** all 13 suites green

## Just done
ship: v4.7 — the audit fixed: return TD scores once, kickoff locks, the name-key bug in four places, honest+75x cheaper saves, API key out of Downloads, daily alarm; plus swipe between tabs, pull to refresh and a working back button

## Do this next
verify on the phone

## How to resume, exactly
```bash
cd "$(dirname "$0")"   # wherever this bundle was unzipped
bash bootstrap.sh          # prints this file, TASKS.md and the git log
```
Then continue from **Do this next** above. Do not re-plan, do not re-read
finished work, do not ask Tj to re-explain anything — `TASKS.md` carries his
request in his own words and `git log` carries every step already taken.

## Uncommitted right now
     M CHECKPOINT.md
     M STATE.md

## Last ten checkpoints
```
  e7c2208 ckpt 22: v4.7 docs: ladder 17a-17j, release notes, tasks
  2df0576 ckpt 21: v4.7: alias variants both ways, new test_locks + test_gestures suites, every tab now renders in test_lifecycle
  90fb9fa ckpt 20: v4.7 wip: return TD scored once, name-key fixes, kickoff locks, split persistence, gestures, back button, alerts daily
  8442c73 ship v4.6: v4.6 — tab bar reserve fixed and self-diagnosing, pre-game player card, TO PLAY redundancy removed, share URI grant hardened
  156423a ckpt 18: ship: v4.6 — tab bar reserve fixed and self-diagnosing, pre-game player card, TO PLAY redundancy removed, share URI grant hardened
  98fdf70 ckpt 17: Sweep of v4.5. (1) Tab bar: body and toast hard-coded 124px for an 89px bar — a stale number from the 60px era — pinning a 35px dead band; both now derive from --tabh, and the boot test that ASSERTED the bug ('padding >= min-height + 24') now tests the relationship. (2) Data > Screen fit is self-diagnosing: measured bar height, CSS expectation, bottom inset, and the SAVED adjBot slider with a one-tap reset. (3) Caught my own bug in that readout: getPropertyValue('--tabh') returns the literal calc() string, so parseFloat was NaN — replaced with a measuring probe. (4) 'TO PLAY' suppressed when a kickoff badge already says so; it was pushing the player's NAME into the ellipsis in a nowrap row. (5) Tapping a player before the week is synced was a dead-end toast — now a pre-game card with kickoff, projection, injury note and Claude's read, all already computed and previously unreachable. (6) Hardened the share URI grant (ClipData + flag on the chooser) on the unverified handoff path. 11 suites green.
  992853b ckpt 16: Tab bar: found the real layout bug behind the 'nav shifted up' report. The bar is 89px (--tab-h 88 + 1px border) but body{padding-bottom} and .toast{bottom} both hard-coded 124px — a leftover from when the tabs were 60px, updated by hand to a wrong number when v3.1 grew them. That pinned a 35px dead band above the bar. Worse, test_boot ASSERTED the bug: it required 'body padding >= min-height + 24', which describes nothing real. Both now derive from --tabh (= --tab-h + border + insets) so they cannot drift or disagree, and the assertions test the relationship instead of two literals. Also made the Data > Screen fit card self-diagnosing: measured bar height vs CSS expectation, the bottom inset, and the SAVED adjBot slider (which survives updates and would look exactly like a regression), with a one-tap reset.
  cc29cb5 ship v4.5: v4.5 — three reported bugs fixed, Claude-app round trip on both tabs, kickoff times + pre-Sunday alerts, the app sleeps when backgrounded, network/caching sweep
  f38d578 ckpt 14: ship: v4.5 — three reported bugs fixed, Claude-app round trip on both tabs, kickoff times + pre-Sunday alerts, the app sleeps when backgrounded, network/caching sweep
  1c79298 ckpt 13: ship: v4.5 — three reported bugs fixed, Claude-app round trip on both tabs, kickoff times + pre-Sunday alerts, the app sleeps when backgrounded, network/caching sweep, and a boot-stopping ReferenceError caught before it shipped
```
