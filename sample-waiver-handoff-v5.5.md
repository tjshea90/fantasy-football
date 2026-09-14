# FF Tracker — week 1 waiver wire

**You have been handed this file with no other instructions, and that is
expected.** It was exported by a fantasy-football app on an Android phone.
Everything you need is in this file. Do the task in **What to do** below and
give the answer back as a file. There is nothing to ask about first.

The person who uploaded this is the owner of the team described below. He is
not going to explain anything, because he should not have to.

## What to do

1. Read **this week's** waiver-wire and injury news for the players in
   the **AVAILABLE** list below. Use only news dated this week — an article
   or ranking that reads like it describes an earlier week (a designation
   that would already have resolved, a page published before this week's
   injury news broke) is stale; search again rather than rely on it.
2. Re-rank them **for this specific roster** and this specific scoring.
   Weight a season-long role change (the starter ahead of him is out for
   multiple weeks, a permanent depth-chart move) above a one-week-only edge
   (a bye fill-in, a single good matchup) — see **priority** below.
3. Say plainly which of them, if any, beats a player currently being
   started — naming the starter — and, where it makes sense, which of MY
   OWN players at that position I should drop to make room (see **DROP
   CANDIDATES** below; never suggest a swap across positions).
4. For each player in **MY ROSTER — INJURIES** below who is not on a bye,
   research his rest-of-season outlook and report it in the `injuries`
   list, even if you conclude he does not need replacing.
5. Write the answer as the JSON file described at the end.

Today is **2026-09-14**. This is **NFL week 1 of the 2026 season**.

### The division of labour, so you do not redo work

**The app has already done the part you cannot.** It is the only thing
that knows who is genuinely unrostered in this particular ten-team
league, and the only thing that prices a player in this particular
scoring. Every name in the AVAILABLE list is confirmed free, and every
number beside it is already in league points.

**What you add is what a stat line cannot show**: the starter ahead of a
backup got hurt on Sunday, a rookie just took the third-down role, a
coach named a closer, a snap share moved. That is the whole job.

## This league does NOT use standard scoring

Read this before you judge a single player. It is the reason a public
ranking is not just imprecise here but actively wrong.

```
QB — passing (plus all rushing rows below)
  Completion: +1 each
  Passing yards: +1 per 20 yds (fractional: 1 yd = 0.05)
  Passing TD: +6
  Interception thrown: -2
  Passing 2-pt conversion: +2
  Fumble lost: -2
RB / WR / TE — rushing and receiving
  Reception: +1 each (full PPR)
  Rushing yards: +1 per 10 yds (fractional: 1 yd = 0.1)
  Receiving yards: +1 per 10 yds (fractional: 1 yd = 0.1)
  Rushing TD: +6
  Receiving TD: +6
  2-pt conversion (run or catch): +2
  Fumble lost: -2
  Kick/punt return TD by this player: 0 — the +6 goes to the D/ST, once
K — kicking
  FG 0-39 made: +3
  FG 0-39 MISSED: -3
  FG 40-49 made: +4
  FG 40-49 MISSED: -2
  FG 50-59 made: +5
  FG 50-59 MISSED: -1
  FG 60+ made: +6
  FG 60+ MISSED: 0
  PAT made: +1
  PAT missed: -1
DEF/ST
  Sack: +2
  Interception: +2
  Fumble RECOVERY: +2
  Forced fumble: 0 — this league does not score FF
  Defensive TD: +6
  Kickoff / punt return TD: +6
  Safety: +4
  Points allowed 0: +10
  Points allowed 1-10: +7
  Points allowed 11-20: +5
  Points allowed 21-30: +1
  Points allowed 31+: +0
League-wide weekly bonuses (one player each)
  Longest completion of the week: +5
  Longest reception of the week: +5
  Longest rush of the week: +5
```

**A completed pass is worth 1 point.** A starting quarterback throwing 25
completions banks 25 points before a single yard or touchdown, so volume
passers are worth roughly twice here what they are worth anywhere else, and
a rushing quarterback's legs matter comparatively less. Passing yards are 1
per 20 (not per 25), receptions are full PPR, missed field goals are
PENALISED on a distance ladder, and a forced fumble scores nothing — only a
recovery does.

Every projection you have ever seen on the internet is half-PPR standard.
**Do not import anyone else's "projected points" into your answer.** If you
find a projection, read the STAT LINE behind it and think about what that
line is worth under the table above.

## My current starting lineup, as the app projects it

| slot | player | pos | projection |
|---|---|---|---|
| QB | Matthew Stafford | QB | 43.9 |
| RB1 | Jonathan Taylor | RB | 18.0 |
| RB2 | D'Andre Swift | RB | 13.4 |
| WR1 | Chris Olave | WR | 15.3 |
| WR2 | Davante Adams | WR | 12.3 |
| WR3 | Wan'Dale Robinson | WR | 10.3 |
| TE | Trey McBride | TE | 14.4 |
| FLEX | Jaylen Warren | FLEX | 11.5 |
| K | Ka'imi Fairbairn | K | 9.4 |
| DEF | Seattle Seahawks | DEF | 12.6 |

## Kicker / defense — do I actually need one?

A streamed kicker or D/ST for one good matchup is exactly the kind of
small weekly change that matters least in this league — see **priority**
below. Only rank a K or DEF add when the matching line here says NEEDED;
otherwise omit K and DEF from your answer entirely.

- K: not needed — my kicker is available
- DEF: not needed — my defense is available

## Drop candidates — my own weakest player at each position

Ranked by rest-of-season value, worst first. A `dropCandidate` on an add
**must** be chosen from the matching position's list here, or left an
empty string — never a name at a different position, and never one you
invented.

- **QB**: Bo Nix (ROS value 261.9)
- **RB**: Tyrone Tracy Jr. (ROS value -13.2), Kenneth Gainwell (ROS value 37.8)
- **WR**: Jauan Jennings (ROS value -8.3), Deebo Samuel Sr. (ROS value 26.0), Michael Wilson (ROS value 49.4)
- **TE**: Dalton Schultz (ROS value 42.1)
- **K**: Ka'imi Fairbairn (ROS value 63.0)
- **DEF**: Seattle Seahawks (ROS value 84.1)

**Where this roster is thinnest** (a starter within 4 points of the best
free agent at his own position — i.e. barely better than replacement):

- **WR** — Wan'Dale Robinson (10.3) is only 3.7 better than the wire

Spend most of your effort on those positions.

## AVAILABLE — nobody in this list is on any of the ten rosters

`proj` is this week in league points. `vor` is points above the next
best free agent at the same position, which is the honest way to compare
across positions when a quarterback outscores a running back by default.

### QB

| player | NFL | proj | vor | bye |
|---|---|---|---|---|
| Aaron Rodgers | PIT | 24.2 | 0.0 | 9 |
| Adrian Martinez | SF | 24.2 | 0.0 | 8 |
| Aidan O'Connell | LV | 24.2 | 0.0 | 13 |
| Andy Dalton | CAR | 24.2 | 0.0 | 5 |
| Anthony Richardson Sr. | IND | 24.2 | 0.0 | 13 |
| Brady Cook | NYJ | 24.2 | 0.0 | 13 |

### RB

| player | NFL | proj | vor | bye |
|---|---|---|---|---|
| AJ Dillon | PHI | 7.2 | 0.0 | 10 |
| Adam Prentice | DEN | 7.2 | 0.0 | 10 |
| Adam Randall | BAL | 7.2 | 0.0 | 13 |
| Alec Ingold | MIA | 7.2 | 0.0 | 6 |
| Alexander Mattison | MIA | 7.2 | 0.0 | 6 |
| Alvin Kamara | NO | 7.2 | 0.0 | 8 |

### WR

| player | NFL | proj | vor | bye |
|---|---|---|---|---|
| Adam Thielen | PIT | 6.6 | 0.0 | 9 |
| Adonai Mitchell | NYJ | 6.6 | 0.0 | 13 |
| Alex Bachman | LV | 6.6 | 0.0 | 13 |
| Allen Lazard | NYJ | 6.6 | 0.0 | 13 |
| Andre Baccellia | ARI | 6.6 | 0.0 | 14 |
| Andrei Iosivas | CIN | 6.6 | 0.0 | 6 |

### TE

| player | NFL | proj | vor | bye |
|---|---|---|---|---|
| AJ Barner | SEA | 5.5 | 0.0 | 11 |
| Adam Trautman | DEN | 5.5 | 0.0 | 10 |
| Albert Okwuegbunam Jr. | LV | 5.5 | 0.0 | 13 |
| Andrew DePaola | MIN | 5.5 | 0.0 | 6 |
| Anthony Firkser | DET | 5.5 | 0.0 | 6 |
| Austin Hooper | NE | 5.5 | 0.0 | 11 |

### K

| player | NFL | proj | vor | bye |
|---|---|---|---|---|
| Andre Szmyt | CLE | 5.0 | 0.0 | 11 |
| Andy Borregales | NE | 5.0 | 0.0 | 11 |
| Ben Sauls | NYG | 5.0 | 0.0 | 8 |
| Blake Grupe | IND | 5.0 | 0.0 | 13 |
| Brandon McManus | GB | 5.0 | 0.0 | 11 |
| Cairo Santos | CHI | 5.0 | 0.0 | 10 |

### DEF

| player | NFL | proj | vor | bye |
|---|---|---|---|---|
| Arizona Cardinals | ARI | 6.6 | 0.0 | 14 |
| Atlanta Falcons | ATL | 6.6 | 0.0 | 11 |
| Buffalo Bills | BUF | 6.6 | 0.0 | 7 |
| Carolina Panthers | CAR | 6.6 | 0.0 | 5 |
| Chicago Bears | CHI | 6.6 | 0.0 | 10 |
| Cincinnati Bengals | CIN | 6.6 | 0.0 | 6 |

## The file to give back

Write a file named `fftracker-waivers-reply.json` containing **JSON only** — no
prose outside it, no commentary, no markdown around it. The app reads this
file directly.

```json
{
  "kind": "fftracker.waivers.reply",
  "format": 1,
  "week": 1,
  "season": 2026,
  "adds": [
    {
      "name": "<exact name>",
      "pos": "QB|RB|WR|TE|K|DEF",
      "nfl": "<team abbr>",
      "rank": 1,
      "overStarter": "<name of the starter he beats, or an empty string>",
      "priority": "season | week",
      "recentStat": "<his exact stat line from his most recent game, dated>",
      "dropCandidate": "<exact name from the matching position in DROP CANDIDATES, or an empty string>",
      "confidence": "high | medium | low",
      "why": "<the news or role reason, dated, with the outlet named>"
    }
  ],
  "injuries": [
    {
      "name": "<exact name from My roster — injuries>",
      "extent": "<severity, body part, how it happened>",
      "timeline": "<expected return / rest-of-season outlook, dated and cited>",
      "replace": true
    }
  ],
  "needs": "<one sentence: where this roster is actually thin, and why>",
  "summary": "<two sentences: what to do first>"
}
```

### Field rules
- `rank` — 1 is the best add overall. Also rank within each position by listing that position's players in order.
- Return the best few at **each** position that has a credible option, not one global list. A list of nothing but quarterbacks is useless here even though quarterbacks score most.
- `overStarter` — fill it in **only** when you actually believe he beats that named starter this week under this scoring. Empty string otherwise. Do not guess.
- `priority` — `"season"` when the opportunity should last (an injury/benching ahead of him that will keep him out multiple weeks, a permanent role change); `"week"` for a one-off (bye fill-in, single-week matchup). Rank season-priority adds ahead of week-only ones within the same position.
- `recentStat` — his exact stat line from his most recent game, dated (e.g. "3 rec, 34 yds vs DAL (Wk 2)"). Empty string if you found no box score.
- `dropCandidate` — **only** a name copied exactly from that position's entry in **Drop candidates** above, or an empty string if there is no fair swap (e.g. an open bench spot). Never a name at a different position, never one you invented — the app discards anything else.
- Kickers and defenses — only include a K or DEF add when **Kicker / defense — do I actually need one?** above says NEEDED for that position. Otherwise leave K and DEF out of `adds` entirely.
- Prefer players from the AVAILABLE list. You may name at most **2** who are not in it, if the news is strong — mark those `"confidence": "low"`. The app flags them as unverified and will not offer an Add button, because it cannot confirm they are free in this league.
- If a position has no credible add, omit it rather than padding the list.
- `injuries` — one entry per name in **My roster — injuries** that is not on a bye. If you found nothing beyond the app's own designation, say so plainly in `timeline` rather than inventing a timetable.
- Never invent news. If you found nothing on a player, do not rank him.

### A worked example of one entry

```json
{
  "name": "Example Back",
  "pos": "RB",
  "nfl": "CHI",
  "rank": 1,
  "overStarter": "Example Starter",
  "priority": "season",
  "recentStat": "3 rec, 34 yds vs DAL (Wk 2)",
  "dropCandidate": "Example Bench Back",
  "confidence": "high",
  "why": "The new starter after Example Starter's hamstring injury Sunday and IR placement Tuesday (NFL.com, 2026-09-08); took every first-team rep Wednesday and is the early-down and goal-line back going forward."
}
```

If you cannot find anything current on someone, say exactly that in the
reason, set the confidence low and leave the multiplier at 1.0. **Never
invent news.** An honest "nothing found" is useful; a plausible invention is
worse than silence, because the app will act on it.

---

## Machine-readable copy of this request

```json
{
  "kind": "fftracker.waivers",
  "format": 1,
  "week": 1,
  "season": 2026,
  "today": "2026-09-14"
}
```
