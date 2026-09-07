# SPEC — FF Season Tracker

## 1. WHAT IT IS
An offline-capable Android app (single universal APK) that tracks Tj's 10-team
fantasy league for the 2026 season. It pulls real NFL box scores from ESPN's
public JSON API, scores every rostered player under **this league's rules**,
tracks head-to-head matchups and standings, and recommends Tj's weekly lineup.

## 2. LEAGUE FACTS (from RULES_2026.md — ground truth)
- 10 teams, 17 players each. Starters: **QB, RB, RB, WR, WR, WR, TE, FLEX
  (WR/RB/TE only), K, DEF**. 7 bench.
- Regular season **weeks 1-14**. Playoffs W15 (top 2 bye, 3v6, 4v5), W16 semis,
  W17 final/3rd.
- Bye-week starter scores 0. No auto-sub. Blank slot = 0.
- Prizes: weekly most-points 1 book · SB 12 / RU 6 / 3rd 4 · **regular-season
  points champ 4**. So season points total matters independently of W/L.
- Team names: Ron, Dustin, Mo, Steve, JR, Mike/Jamie, Tugdude, My team,
  Jose/Brandon, Tim. ("My team" = Tj.)

### 2a. SCORING — implement exactly
**Passing:** completion +1 · 1 per 20 yds · TD +6 · 2PT +2 · INT −2 · fumble lost −2
**Rush/Rec:** 1 per 10 yds · reception +1 · TD +6 · 2PT +2 · fumble lost −2
**Kicking:** PAT +1 / miss −1 · FG 0-39 +3 / miss −3 · 40-49 +4 / miss −2 ·
50-59 +5 / miss −1 · 60+ +6 / miss 0
**D/ST:** INT +2 · sack +2 · **fumble RECOVERY +2 (forced fumbles are NOT scored)**
· def TD +6 · safety +4 · kick/punt return TD +6
**D/ST points allowed (per game):** 0 → 10 · 2-10 → 7 · 11-20 → 5 · 21-30 → 1 ·
31+ → 0. (1 point allowed is undefined in the rules; treat as the 2-10 tier.)
**Weekly bonuses:** +5 each to the single league-wide longest completion, longest
reception, and longest rush **of that NFL week**. Awarded to one player each.
Longest completion pays the QB; longest reception pays the receiver.

## 3. DATA SOURCE — ESPN public JSON (no key, verified 2026-09-01)
Base: `https://site.api.espn.com/apis/site/v2/sports/football/nfl`

| need | endpoint |
|---|---|
| week's games | `/scoreboard?dates=YYYYMMDD` or `?week=N&seasontype=2&dates=2026` |
| box score | `/summary?event={id}` |
| news / injuries | `/news` and `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{abbr}/injuries` |

### 3a. Verified schema — scoreboard
`events[].id` · `events[].week.number` · `events[].season.year` ·
`events[].season.type` · `events[].date` · `events[].status.type.state`
("pre"|"in"|"post") · `events[].competitions[].competitors[].team.abbreviation` ·
`events[].competitions[].competitors[].score` ·
`events[].competitions[].competitors[].homeAway`

### 3b. Verified schema — summary (box score)
Player groups: `boxscore.players[].statistics[]`, each with `name`, `labels[]`,
`keys[]`, `totals[]`, and `athletes[]`.
Athlete: `.athlete.id`, `.athlete.displayName`, `.stats[]` (strings, positional,
aligned to `labels`/`keys`).
`boxscore.players[].team.abbreviation` identifies the team of that group block.

Group names present: **passing, rushing, receiving, fumbles, defensive,
interceptions, kickReturns, puntReturns, kicking, punting**.

`passing` labels: `["C/ATT","YDS","AVG","TD","INT","SACKS","QBR","RTG"]`
→ completions = `stats[0].split("/")[0]`, yards `stats[1]`, TD `stats[3]`,
INT `stats[4]`.
Other groups: **read `labels`/`keys` at runtime and index by label name — never
hard-code positions except for passing's C/ATT split.** Labels differ by season.

Also used: `header.competitions[0].competitors[].score` (team score, for D/ST
points allowed), `scoringPlays[]` (2-pt conversions, defensive TDs, return TDs,
safeties — match on `type.abbreviation`/`text`), and `drives.previous[].plays[]`
(field-goal distances, including **misses**, which never appear in scoringPlays).

### 3c. Known data gaps — label them in the UI, never hide them
- **2-point conversions** are not in the box-score groups; parsed from
  `scoringPlays` text. If parsing fails the app shows a manual-adjust field.
- **FG distance** comes from play-by-play; if `drives` is absent for a game the
  app falls back to the box-score FG line and flags the week as `FG EST`.
- **Longest-play bonuses** need a league-wide sweep of every game that week, so
  they resolve only after all of that week's games are final.
- Every screen showing an inferred number carries a small `est` marker.

## 4. ARCHITECTURE
```
android/          Java shell: MainActivity (WebView) + Native bridge
  Native.httpGet(url)            -> String     (all network; avoids file:// CORS)
  Native.load(name) / save(name,s)             (durable app-private JSON)
  Native.export(name, s)                       (writes to Downloads for backup)
app/assets/       the entire UI + logic, plain ES2018 JS, no framework, no CDN
  index.html  app.css  store.js  scoring.js  espn.js  ui.js  recommend.js
  seed.json   (rosters + league config, generated from data_rosters.json)
```
**No native libraries → one ABI-independent APK → installs on armv7 Android 10
and arm64 Android 16 alike.** Build is manual (aapt2/javac/d8/apksigner), not
Gradle, to avoid AGP version drift; see `build.sh`.

## 5. FEATURES — the contract
**Required by Tj**
1. Auto-calculate fantasy points for all 10 teams from live/final NFL stats,
   strictly per §2a.
2. Enter matchups week by week; show who is winning, live.
3. Season running total per team; rank teams by points.
4. Add/remove players from any roster.
5. Set each team's starting lineup weekly via **per-slot dropdowns filtered to
   that team's roster and to slot-eligible positions**.
6. Separate **recommendation** section for Tj's lineup, updated from live news,
   injuries, byes and opponent defense, scored under §2a.
7. Persist all prior weeks and matchups; running W/L record and rank by W/L.

**Added from what comparable apps do (DraftSharks/FanStar/RotoWire feature scan)**
8. Live in-progress scoring with a "yet to play / in play / final" count per team.
9. Win-probability-ish read: current margin plus starters remaining.
10. Per-player game log and a season-long points-by-week table.
11. Bye-week and injury warnings on the lineup screen before a week locks.
12. Weekly high-score tracker (there is a book on it) and season points-champ race.
13. Transaction log for adds/drops.
14. Full JSON export/import for backup and for handing state back to Claude.
15. Manual stat override per player-week, for anything the feed gets wrong.
16. Playoff bracket view for W15-17 seeded per §2.

## 6. NON-GOALS
Not a draft tool. No login, no server, no accounts, no ads, no paid API.
