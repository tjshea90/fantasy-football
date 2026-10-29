# TASKS — the 2026-10-22 request, in Tj's words

> "Removing players from my team (and maybe other teams) removes them for prior weeks and deducts the points they made. If a week is already final, those players are locked in and their points stay for prior weeks. Adding and dropping players only affects the team after the added and dropped players."
> "Quick section (maybe Rosters tab): 'is this player available' — search player or team with the same logic as other searches; says if taken in the league and which team has them (incl. defenses)."
> "Add all 32 defenses to the app. Sometimes I have to type them in manually."
> "Quick export/import full data backup of ALL app data so my tablet (weeks behind my phone) can be cloned current."

- [x] 1. (test_history.js) Roster drop/add must not rewrite finalized past weeks (history-safe roster changes)
- [x] 2. (browser-checked, Rosters tab) "Is this player available?" search in Rosters tab (players + defenses, shows owning team)
- [x] 3. (test_history.js; root cause: refresh pruned DEF) All 32 NFL defenses present in the player pool
- [x] 4. (test_history.js) Full-data export / import backup (Data tab)
- [x] 5. (v9.1 released, asset verified) Tests for each, ckpt, ship

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

# TASKS — 2026-10-22b request (Tj)
> "Easy way to put my old players back into the prior weeks. Prior weeks show empty slots but they had players before I removed them. For completed weeks, put all the players my team (and other teams) used to have into the lineup drop-downs so I can restore historical matchups. Recalculate/restore each player's league fantasy points from their stats for the week open in the app."
- [x] 6a. Backfill S.released from past 'drop' transactions (pre-v9.1 drops)
- [x] 6b. Lineup drop-downs for completed weeks include that team's released players
- [x] 6c. (test_history.js) Points for released players: stat line, else league book row by name
- [x] 6d. (v9.2 released) Test + ship

## 2026-10-22 — refresh everything before any prompt to Claude (Tj)
> "whenever I press the button to ask Claude anything ... or any button to share any prompt with Claude, first refresh all data in the app ... injuries, updated rosters, NFL bye weeks, NFL full rosters from ESPN ... Do not make the prompt file until all updates and refreshes are complete."
- [x] `refreshForClaude` / `afterFreshRefresh` in ui.js: NFL rosters (PlayerDB), schedule+byes, injuries, week projections (all reuse windows bypassed via `syncAll(..,{fresh,skipClaude})`), box scores — file/API only after all finish; failed feeds ask "Use saved data?". Wired into all 3 file buttons, team-analysis + wire + advice API buttons, advice pull-to-refresh. Test: tools/test_claudeprep.js

# TASKS — 2026-10-29 request (Tj)

> "I lost my phone and all the data including scores and rosters. Find the best way for me to update the app with the attached up to date rosters, standings, and schedule so I don't need to manually enter them. Most team names in the html files are very close to the team names in the app but not exact matches. My team is Shea."

- [x] 1. (test_snapshot.js) tools/mkleaguesnap.py parses the 10 RTSports capsules + schedule PDF -> app/assets/leaguesnap.js (scores cross-checked between capsules; standings = Tj's screenshot)
- [x] 2. (test_snapshot.js) Store.applySnapshot: fuzzy team match (Shea=My team, Moe=Mo, Tugboat/Eric=Tugdude), rosters, 14-week schedule, final scores as manual scores, add/drop history -> released, week-8 lineups
- [x] 3. (browser-checked) first-launch offer + Data screen "Restore from the league site" + "Load past weeks' NFL stats"
- [ ] 4. ship v9.5, publish Release, send Tj the link
