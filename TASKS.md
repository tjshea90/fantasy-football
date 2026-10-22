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
