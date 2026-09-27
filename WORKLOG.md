# WORKLOG — findings as they happen (tools/note.sh)

One line per finding, newest last: causes found, where the code is, decisions,
dead ends ruled out. Written so a session cut off mid-analysis leaves what it
learned on GitHub. resume.sh prints the tail. When a job is archived to
LADDER.md, its lines here go with it.
- 2026-09-27T18:09Z · claude/resume-interrupted-session-h4zx1w — checkpoint-system fix: 2a diagnosis — prior session's last push was ckpt 52 at 17:21:24Z; nothing after reached GitHub (likely read-only analysis, which autosave never saved). Fixes: WORKLOG/note.sh, SESSIONLOG via sessionlog.py, autosave worktrees + main ff, resume.sh stranded branches.
