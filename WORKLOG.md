# WORKLOG — findings as they happen (tools/note.sh)

One line per finding, newest last: causes found, where the code is, decisions,
dead ends ruled out. Written so a session cut off mid-analysis leaves what it
learned on GitHub. resume.sh prints the tail. When a job is archived to
LADDER.md, its lines here go with it.
- 2026-09-27T18:09Z · claude/resume-interrupted-session-h4zx1w — checkpoint-system fix: 2a diagnosis — prior session's last push was ckpt 52 at 17:21:24Z; nothing after reached GitHub (likely read-only analysis, which autosave never saved). Fixes: WORKLOG/note.sh, SESSIONLOG via sessionlog.py, autosave worktrees + main ff, resume.sh stranded branches.
- 2026-10-25T03:59Z · ccr-6a828d91-nmqeuv — 2026-10-25 Tj screenshot 'NFL rosters' failed prompt = v9.3 bug (r.failed array always truthy), already fixed in v9.4; v9.4 release download_count=0 so phone not updated yet. No code change.
- 2026-10-29T00:44Z · claude/bulk-roster-standings-import-w8q7qp — Import plan: capsules(RTSports mhtml)+schedule PDF -> parse via py to snapshot JSON; apply as manualScores+matchups+rosters+released(from Team Activity). CAUTION: weekMeta synced+allFinal makes doSync skip the week (ui.js ~1529) so past-week stats never fetch; mark imported weeks specially
- 2026-10-29T00:46Z · claude/bulk-roster-standings-import-w8q7qp — tools/mkleaguesnap.py parses capsules+PDF -> app/assets/leaguesnap.js; standings match screenshot exactly, scores cross-validated. NEXT: Store.applySnapshot + Data tab button + test_snapshot.js + load leaguesnap.js in index.html
- 2026-10-30T02:23Z · claude/bulk-roster-standings-import-w8q7qp — Bug: roster row ⋯ dialog (ui.js rosterRowMenu->dialog) invisible on Roster tab, visible after switching to Stats. Reproducing in Chromium; suspect z-index/stacking. Also asked: phone/tablet mirror sync advice + 3 research Qs (no repo changes)
