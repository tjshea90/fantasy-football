# RULES_2026.md — AUTHORITATIVE
Source: IMG_20260822_163544710.jpg (rules) + IMG_20260822_163557295.jpg (points).
Images are ground truth. Transcribed 2026-08-26.
Checkpoint v3.4 §2 was cross-checked line by line: **NO DISAGREEMENT.**

## SCORING

### Passing
| Item | Pts |
|---|---|
| Completion | +1 each |
| Passing yards | +1 per 20 yds |
| Passing TD | +6 |
| 2-pt conversion | +2 |
| Interception | −2 |
| Fumble lost | −2 |

### Rushing / Receiving
| Item | Pts |
|---|---|
| Yards | +1 per 10 yds |
| Reception | +1 each |
| TD | +6 |
| 2-pt conversion | +2 |
| Fumble lost | −2 |

### Defense / ST
| Item | Pts |
|---|---|
| Interception | +2 |
| Sack | +2 |
| Fumble RECOVERY | +2 |
| Defensive TD | +6 |
| Safety | +4 |
| Kickoff/Punt return TD | +6 |

Points allowed (per game): 0 → 10 | 2–10 → 7 | 11–20 → 5 | 21–30 → 1 | 31+ → 0
NOTE: the tier list has no entry for exactly 1 point allowed. Treat 1 as the 2–10
tier (7 pts); it is a near-impossible score and cannot move any ranking.

**FORCED FUMBLES ARE NOT SCORED.** The CSV has an FF column. It must be ignored.
Only FR (fumble recovery) counts.

### Kicking
| Made | Pts | | Missed | Pts |
|---|---|---|---|---|
| PAT | +1 | | PAT | −1 |
| FG 0–39 | +3 | | FG 0–39 | −3 |
| FG 40–49 | +4 | | FG 40–49 | −2 |
| FG 50–59 | +5 | | FG 50–59 | −1 |
| FG 60+ | +6 | | FG 60+ | 0 |

### Weekly bonuses — NOT MODELED
Longest completion / longest reception / longest rush of the week: +5 each.
Awarded to one player league-wide per week. Cannot be derived from season CSVs.
Expected value per player is small and concentrated in deep-ball QBs/WRs and
home-run backs. Flag as unmodeled; do not silently fold into totals.

## ROSTER
**10 starting slots:** QB, RB, RB, WR, WR, WR, TE, FLEX (WR/RB/TE only), K, DEF/ST
Literal image text: "QB, 2 RB, 3 WR, TE, Flex (WR, RB, TE ONLY), K, DEF/ST".
Confirmed 2026-08-26 against the engine's `SLOTS` array — they match.
17 players per team, 170 players total, 10 teams.

## LEAGUE STRUCTURE
- Regular season weeks 1–14. Playoffs W15 (top 2 bye, 3v6, 4v5), semis W16,
  SB/3rd place W17.
- Draft: Saturday August 29, back room, after 4pm count. Continuation Sunday
  Aug 30 after night recall.
- Entry fee 4 books (40 total). Weekly most-points winner: 1 book.
  SB champ 12 / runner-up 6 / 3rd place 4 / **regular season points champ 4**.
- Bye-week starter = 0 pts, no auto-sub. Blank slot = 0.
- Scores and stats provided by RTSports.

## VERIFICATION — 2026-09-02 (v1.8)
The engine was audited line by line against this file for **every roster
position**, and the audit now runs on the phone (Data -> Scoring rules) rather
than living only in a chat. `tools/test_scoring.js` 33/33 plus
`Scoring.selfAudit()` 11/11 full-line cases: QB with the completion bonus, RB
with a lost fumble, WR with a 2-pt catch, TE, K across every distance band made
AND missed, D/ST across the whole points-allowed ladder including the undefined
"1 point" case and a shutout with a safety and a return TD. **No disagreement
with this file at any position.**

Yardage is FRACTIONAL and Tj confirmed it: 177 passing yards is 8.85, not 8.
The Scoring rules screen states this explicitly so it never has to be
re-derived.

Two feed-side defects were found and fixed in the same pass — both scoring
errors, neither a rules error:
1. **A pick-six was paid twice.** ESPN reports a defensive touchdown in BOTH
   the `defensive` group's TD column and the `interceptions` group's, and the
   parser summed them: 12 points for one score. Defensive and special-teams
   touchdowns and safeties now come from `scoringPlays`, one row per score,
   with the group totals kept only as a de-duplicated fallback.
2. **Two-point conversions scored 0 for everyone.** Nothing ever populated
   `twoPt`, so a +2 was silently lost. They are now parsed out of the scoring
   play's parenthetical and credited to the passer and the receiver, or to the
   runner.

ONE GENUINE AMBIGUITY remains in the rules image and is now a setting rather
than a silent assumption: "Kickoff/Punt return TD +6" is printed under
Defense/ST, so by default it pays the D/ST and not the individual returner.
Data -> Scoring rules can switch it. Return touchdowns are recorded on the
player's line either way, so flipping it never needs a re-sync.

## IMPLICATIONS FOR VALUATION
- Weekly high-score prize + season points title ⇒ raw weekly ceiling has real
  cash value, not just H2H win probability.
- Regular season is 14 weeks; byes inside W1–14 matter more than usual.
