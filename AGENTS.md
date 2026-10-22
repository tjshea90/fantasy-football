# AGENTS.md

<!-- handoff:learnings:begin -->
## Session Learnings (auto-updated by handoff)

### Key Decisions
- Decision: park dropped players in S.released, resolve via playerById, exclude from allPlayers — Reason: past weeks keep points, ownership logic unchanged
- Decision: drop effective this week or next if week final; player who already played keeps current week — Reason: Tj rule, points locked once earned
- Decision: refresh never prunes DEF, init restores missing DEF from bundle — Reason: DEF absent from ESPN rosters, refresh was deleting them
- Decision: exportAll wraps state + cache keys; importJSON accepts both, returns full — Reason: clone tablet from phone

<!-- handoff:learnings:end -->
