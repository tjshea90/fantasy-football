/* handoff.js — the offline Claude round trip (v4.5).
 *
 * WHAT TJ ASKED FOR, IN HIS WORDS
 * -------------------------------
 * "the app should be able to make a file that I can upload in a chat in the
 *  Claude app which Claude fully understands with no explanation from me that
 *  gets all the data for the advice in the app and outputs a file which I can
 *  import back into the fantasy tracker app and it fills in all relevant
 *  advice in the app."
 *
 * So: export → attach in a Claude chat → say nothing → get a file back →
 * import → the app is filled in. Twice over: the weekly advice, and the
 * waiver wire.
 *
 * WHY THIS IS WORTH HAVING AT ALL
 * -------------------------------
 * The in-app API path costs real money per sync and its whole design is
 * shaped by that: the TRIAGE in recommend.js exists to avoid paying for
 * searches whose answer cannot move, `max_uses` is rationed, and the prompt is
 * split in half so the fixed part can be cached at a tenth of the price.
 * Through his own Claude subscription none of that arithmetic applies, so the
 * handoff deliberately asks about EVERY player rather than the triaged subset
 * (`rosterContext(..., {everyone:true})`). Same code, different economics.
 *
 * THE ONE RULE THIS FILE OBEYS
 * ----------------------------
 * It owns the FILE FORMAT and nothing else. Understanding what a reply MEANS
 * belongs to ai.js — `Ai.parseAnswer` finds the JSON, `Ai.normalizeAdvice` and
 * `Ai.normalizeWaivers` turn it into records, `Recommend.mergeAi` and
 * `Value.waiverSave` store it. Every one of those is the same function the
 * live API path calls. If this file re-implemented any of them, the two paths
 * would drift the first time either changed and nothing would notice, because
 * each is exercised separately.
 */
(function (root) {
  'use strict';

  var KIND_ADVICE = 'fftracker.advice';
  var KIND_WAIVER = 'fftracker.waivers';
  var KIND_TEAM = 'fftracker.teamanalysis';
  var FORMAT = 1;

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }
  function j(o) { return JSON.stringify(o, null, 2); }

  /* ---- the shared head of both briefings ---------------------------------
   * Written to a Claude that has been handed a file and told NOTHING. That is
   * the actual requirement, so the first paragraph has to answer "what is this
   * and what do you want" before anything else, and the output contract has to
   * be unambiguous enough that no clarifying question is needed. */
  function head(what) {
    return [
      '# FF Tracker — ' + what.title,
      '',
      '**You have been handed this file with no other instructions, and that is',
      'expected.** It was exported by a fantasy-football app on an Android phone.',
      'Everything you need is in this file. Do the task in **What to do** below and',
      'give the answer back as a file. There is nothing to ask about first.',
      '',
      'The person who uploaded this is the owner of the team described below. He is',
      'not going to explain anything, because he should not have to.',
      ''
    ].join('\n');
  }

  function scoringSection() {
    var rules = (root.Ai && root.Ai.rulesText) ? root.Ai.rulesText() : '';
    return [
      '## This league does NOT use standard scoring',
      '',
      'Read this before you judge a single player. It is the reason a public',
      'ranking is not just imprecise here but actively wrong.',
      '',
      '```',
      rules,
      '```',
      '',
      '**A completed pass is worth 1 point.** A starting quarterback throwing 25',
      'completions banks 25 points before a single yard or touchdown, so volume',
      'passers are worth roughly twice here what they are worth anywhere else, and',
      'a rushing quarterback\'s legs matter comparatively less. Passing yards are 1',
      'per 20 (not per 25), receptions are full PPR, missed field goals are',
      'PENALISED on a distance ladder, and a forced fumble scores nothing — only a',
      'recovery does.',
      '',
      'Every projection you have ever seen on the internet is half-PPR standard.',
      '**Do not import anyone else\'s "projected points" into your answer.** If you',
      'find a projection, read the STAT LINE behind it and think about what that',
      'line is worth under the table above.',
      ''
    ].join('\n');
  }

  function contractSection(shape, rules, example) {
    return [
      '## The file to give back',
      '',
      'Write a file named `' + shape.filename + '` containing **JSON only** — no',
      'prose outside it, no commentary, no markdown around it. The app reads this',
      'file directly.',
      '',
      '```json',
      j(shape.skeleton),
      '```',
      '',
      '### Field rules',
      rules.map(function (r) { return '- ' + r; }).join('\n'),
      '',
      '### A worked example of one entry',
      '',
      '```json',
      j(example),
      '```',
      '',
      'If you cannot find anything current on someone, say exactly that in the',
      'reason, set the confidence low and leave the multiplier at 1.0. **Never',
      'invent news.** An honest "nothing found" is useful; a plausible invention is',
      'worse than silence, because the app will act on it.',
      ''
    ].join('\n');
  }

  /* ================= ADVICE ============================================== */
  function buildAdvice(week, teamId, opp) {
    var ctx = root.Recommend.rosterContext(week, teamId, opp, { everyone: true });
    var i, lines = [];

    lines.push(head({ title: 'week ' + week + ' lineup advice' }));
    lines.push('## What to do');
    lines.push('');
    lines.push('1. For **every player in the roster table below**, search the web for');
    lines.push('   current news: this week\'s practice participation, injury');
    lines.push('   designations, suspensions, snap or touch restrictions, depth-chart');
    lines.push('   changes, weather, and anything else that would change whether he');
    lines.push('   plays a normal workload. Prefer sources from the last 7 days.');
    lines.push('2. Judge the matchup he is actually facing, under the scoring below.');
    lines.push('3. Write the answer as the JSON file described at the end.');
    lines.push('');
    lines.push('Today is **' + ctx.today + '**. This is **NFL week ' + week +
               ' of the ' + ctx.season + ' season**.');
    lines.push('');
    lines.push(scoringSection());
    lines.push('## Starting slots');
    lines.push('');
    lines.push('`QB · RB · RB · WR · WR · WR · TE · FLEX (RB/WR/TE only) · K · DEF/ST`');
    lines.push('');
    lines.push('A player on a bye scores exactly 0 and is **never** substituted');
    lines.push('automatically — this league has no auto-substitution, so a wrong bye is');
    lines.push('a zero that nobody notices until Monday.');
    lines.push('');
    lines.push('## The roster — every one of these needs an entry in your answer');
    lines.push('');
    lines.push('| player | pos | NFL | opponent | kickoff | app projection | ESPN status |');
    lines.push('|---|---|---|---|---|---|---|');
    var anyEarly = false;
    for (i = 0; i < ctx.players.length; i++) {
      var p = ctx.players[i];
      /* The kickoff is included because it changes what an answer is worth: a
         Thursday player's practice report is already final, while a Sunday
         player may still have Friday news to come — and it tells the reader
         which of these decisions has a deadline. */
      var kick = '—';
      if (root.Schedule) {
        try {
          var b = root.Schedule.badge(p.nfl, week);
          if (b) { kick = b.text + (b.early ? ' **(before Sunday)**' : ''); }
          if (b && b.early) anyEarly = true;
        } catch (e) { kick = '—'; }
      }
      lines.push('| ' + p.name + ' | ' + p.pos + ' | ' + (p.nfl || '?') + ' | ' +
                 (p.opp || '—') + ' | ' + kick + ' | ' +
                 (typeof p.proj === 'number' ? p.proj.toFixed(1) : '?') + ' | ' +
                 (p.feedStatus || 'no designation') + ' |');
    }
    if (anyEarly) {
      lines.push('');
      lines.push('**Some of these play before Sunday** (marked in the kickoff column).');
      lines.push('Those decisions are due first, so if anything in your answer deserves');
      lines.push('extra care it is those players.');
    }
    lines.push('');
    lines.push('"App projection" is this league\'s own number, already in this');
    lines.push('league\'s points. Treat it as the baseline you are adjusting, not as');
    lines.push('something to replace.');
    lines.push('');
    if (ctx.settled.length) {
      lines.push('### Already settled — do NOT research these');
      lines.push('');
      lines.push('The app already knows these with certainty and excludes them from every');
      lines.push('slot. Searching them cannot improve on that. Include them in your answer');
      lines.push('with `"willPlay": false`, `"adjust": 0` and the reason given here.');
      lines.push('');
      for (i = 0; i < ctx.settled.length; i++) {
        lines.push('- **' + ctx.settled[i].name + '** — ' + ctx.settled[i].why);
      }
      lines.push('');
    }
    lines.push(contractSection(
      { filename: 'fftracker-advice-reply.json',
        skeleton: {
          kind: KIND_ADVICE + '.reply', format: FORMAT,
          week: week, season: ctx.season,
          players: [{
            name: '<copy the name EXACTLY as it appears in the roster table>',
            status: 'clear | questionable | limited | out',
            willPlay: true,
            adjust: 1.0,
            confidence: 'high | medium | low',
            reason: '<what you found, with the outlet named and the date>'
          }],
          summary: '<two sentences on the lineup as a whole>'
        } },
      [
        '`name` — copy it **exactly** as written in the roster table. The app matches on it.',
        '`adjust` multiplies the app\'s projection. Stay inside 0.6–1.4 unless something specific and cited justifies more. 1.0 means "the projection is right" — use it freely rather than inventing small edges.',
        '`status: "out"` for ruled out, suspended, IR, or on a bye. Set `willPlay` false and `adjust` 0. The app will refuse to start him.',
        '`status: "limited"` for anyone expected to play with a real restriction (snap count, touch count, returning from injury). Name the restriction in the reason.',
        '`reason` — name the outlet and the date, and say what it means for his points **under this scoring**. Two or three sentences where there is news, one short sentence where there is not.',
        'Include **every** player from the roster table exactly once, and nobody else.'
      ],
      {
        name: 'Example Player',
        status: 'limited',
        willPlay: true,
        adjust: 0.85,
        confidence: 'medium',
        reason: 'Limited in practice Wednesday and Thursday with an ankle issue ' +
                '(ESPN, 2026-09-05); the beat writer expects a snap cap around 70%. ' +
                'He should still start, but the volume that drives his scoring here ' +
                'is the exact thing at risk.'
      }));
    lines.push('---');
    lines.push('');
    lines.push('## Machine-readable copy of this request');
    lines.push('');
    lines.push('The app wrote this block and will check it against your reply. Do not');
    lines.push('change it, and do not copy it into your answer.');
    lines.push('');
    lines.push('```json');
    lines.push(j({ kind: KIND_ADVICE, format: FORMAT, week: week,
                   season: ctx.season, today: ctx.today,
                   team: ctx.teamName,
                   names: ctx.players.map(function (p) { return p.name; }),
                   settled: ctx.settled.map(function (s) { return s.name; }) }));
    lines.push('```');
    return {
      filename: 'fftracker-advice-wk' + week + '-' + stamp() + '.md',
      text: lines.join('\n') + '\n',
      players: ctx.players.length,
      settled: ctx.settled.length,
      ctx: ctx
    };
  }

  /* ================= WAIVER WIRE ========================================= */
  /* ---- the sections the waiver file is built from (2026-09-18) -----------
   * Pulled out of buildWaivers so each one is a thing with a name rather
   * than another fifty lines of push() in an already long function. */

  /* MY WHOLE ROSTER, priced the same way the wire is — which is the point.
     Rule 4 asks for one-for-one pairs, and a pair needs both halves in the
     same currency or the "expected point edge" is a comparison of two
     different questions. Every number here comes from ros.js, exactly as the
     AVAILABLE table below does. */
  function rosterSection(ctx) {
    var lines = [], i;
    lines.push('## MY ROSTER — every player, in rest-of-season points');
    lines.push('');
    lines.push('This is the other half of every swap. `ROS` is expected points from now to');
    lines.push('the end of the regular season in this league\'s scoring; `gms` is games left');
    lines.push('after his bye. Starters are marked. Anybody here may be dropped.');
    lines.push('');
    lines.push('| player | pos | NFL | ROS | per gm | gms | role | basis |');
    lines.push('|---|---|---|---|---|---|---|---|');
    var rows = (ctx.roster || []).slice();
    rows.sort(function (a, b) {
      if (a.pos !== b.pos) return a.pos < b.pos ? -1 : 1;
      return b.ros - a.ros;
    });
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      lines.push('| ' + r.name + ' | ' + r.pos + ' | ' + (r.nfl || '?') + ' | ' +
                 r.ros.toFixed(0) + ' | ' + r.perGame.toFixed(1) + ' | ' + r.games + ' | ' +
                 (r.outForSeason ? '**OUT FOR SEASON**' : (r.bench ? 'bench' : 'starter')) +
                 ' | ' + (r.src || '?') + ' |');
    }
    lines.push('');
    return lines.join('\n');
  }

  /* Rule 6's override, stated as a fact rather than left for Claude to infer
     from an injury table: these men are finished for the year, so replacing
     them is not an optional upgrade and is not subject to the low-priority
     rule for their positions. */
  function mandatedSection(ctx) {
    var lines = [], k, i, any = false;
    if (ctx.mandated) {
      for (k in ctx.mandated) {
        if (Object.prototype.hasOwnProperty.call(ctx.mandated, k) &&
            ctx.mandated[k].length) { any = true; break; }
      }
    }
    if (!any) return '';
    lines.push('## MUST BE REPLACED — done for the season');
    lines.push('');
    lines.push('These players on my roster are out for the year, so they are worth zero');
    lines.push('from here on and the roster spot is dead. **Pair each of them with the best');
    lines.push('available replacement AT HIS OWN POSITION** (rule 7) — cross positions only');
    lines.push('when the man coming in is clearly far better than anything available at the');
    lines.push('position being emptied, and never when it leaves a starting slot unfillable.');
    lines.push('Rule 6\'s low-priority rule for QB, K and DEF does not apply to a forced');
    lines.push('replacement. Each man below is ONE pair — he can only be dropped once.');
    lines.push('');
    for (k in ctx.mandated) {
      if (!Object.prototype.hasOwnProperty.call(ctx.mandated, k)) continue;
      for (i = 0; i < ctx.mandated[k].length; i++) {
        var m = ctx.mandated[k][i];
        lines.push('- **' + m.name + '** (' + m.pos + ') — ' + (m.outWhy || 'out for the season'));
      }
    }
    lines.push('');
    return lines.join('\n');
  }

  /* The app's own deterministic answer, handed over so Claude does not spend
     its effort re-deriving arithmetic it has already been given — and so a
     disagreement is visible rather than silent. It is explicitly NOT binding:
     the whole reason for asking is that news beats a projection. */
  function swapsSection(ctx) {
    var lines = [], i;
    lines.push('## The app\'s own answer, before any news');
    lines.push('');
    if (!ctx.swaps || !ctx.swaps.length) {
      lines.push('The app finds **no swap worth making** on the numbers alone — nobody');
      lines.push('available clears a meaningful rest-of-season margin over anybody on my');
      lines.push('roster. That is a real answer, not an empty one: if the news does not');
      lines.push('change it, say so and recommend nothing.');
      lines.push('');
      return lines.join('\n');
    }
    lines.push('Pure arithmetic, no news in it at all — that is what you are adding.');
    lines.push('Confirm, reorder or overrule these, and add any the numbers could not see');
    lines.push('(a player whose role changed this week will not show up here yet).');
    lines.push('');
    lines.push('| drop | add | pos | season edge | why the app thinks so |');
    lines.push('|---|---|---|---|---|');
    for (i = 0; i < ctx.swaps.length; i++) {
      var sw = ctx.swaps[i];
      lines.push('| ' + sw.drop.name + ' | ' + sw.fa.name + ' | ' + sw.fa.pos + ' | +' +
                 sw.gain.toFixed(0) + ' pts' + (sw.mandated ? ' **(forced)**' : '') +
                 ' | ' + sw.why.replace(/\|/g, '/') + ' |');
    }
    lines.push('');
    return lines.join('\n');
  }

  /* EVERY player owned in this league (Tj, 2026-09-18, rule 5: the prompt
     "should be able to see all taken players in the league so it doesn't
     recommend them"). This is the single thing the app knows that no source
     on the internet does, and handing over the whole map is what turns "do
     not recommend a rostered player" from a hope into something checkable. */
  function takenSection(ctx) {
    var lines = [], i, j2;
    if (!ctx.taken || !ctx.taken.length) return '';
    lines.push('## OWNED — every player already on a roster in this league');
    lines.push('');
    lines.push('All ten teams, mine included. **Nobody in this list can be added.** It is');
    lines.push('here so you can rule them out without guessing, and so you can see what the');
    lines.push('rest of the league is holding.');
    lines.push('');
    for (i = 0; i < ctx.taken.length; i++) {
      var t = ctx.taken[i];
      var men = [];
      for (j2 = 0; j2 < t.players.length; j2++) {
        men.push(t.players[j2].name + ' (' + t.players[j2].pos + ')');
      }
      lines.push('- **' + t.name + '**: ' + (men.length ? men.join(', ') : '(empty)'));
    }
    lines.push('');
    return lines.join('\n');
  }

  function buildWaivers(week, teamId, opp, season, today) {
    var ctx = root.Value.waiverContext(week, teamId, opp, season, today);
    var lines = [], k, i;

    lines.push(head({ title: 'week ' + week + ' waiver wire' }));
    lines.push('## What I want back');
    lines.push('');
    lines.push('**Specific one-for-one drop/add pairs for my roster, ranked, each with the');
    lines.push('reasoning and the expected rest-of-season point edge in this league\'s');
    lines.push('scoring** — or, if nothing on the wire is a meaningful season-long upgrade,');
    lines.push('a plain statement that I should stand pat.');
    lines.push('');
    lines.push('Today is **' + ctx.today + '**. This is **NFL week ' + week +
               ' of the ' + ctx.season + ' season**, with **' + ctx.weeksLeft +
               ' week' + (ctx.weeksLeft === 1 ? '' : 's') + ' left** in the regular season.');
    lines.push('');
    lines.push(root.Ai && root.Ai.waiverCriteriaText ? root.Ai.waiverCriteriaText() : '');
    lines.push('');
    lines.push('### What the app has already worked out, and what it has not');
    lines.push('');
    lines.push('**Settled fact, not opinion:** who is unrostered in this ten-team league,');
    lines.push('and what every player is worth in this scoring. No public list knows either.');
    lines.push('Every REST-OF-SEASON number below is expected points from now to the end of');
    lines.push('the regular season, computed from full-season projections (ESPN and Sleeper,');
    lines.push('re-scored under the table below), blended with this season\'s measured games,');
    lines.push('and multiplied by the games each man actually has left after his bye.');
    lines.push('');
    lines.push('**Open to you, and the reason you are being asked at all:** whether those');
    lines.push('numbers still describe reality. A depth chart moved, a starter tore an ACL,');
    lines.push('a rookie took the third-down role, a coach named a closer — none of that is');
    lines.push('in a projection yet. Move a player up or down, and say why.');
    lines.push('');
    lines.push(scoringSection());
    lines.push(rosterSection(ctx));
    if (ctx.injuries && ctx.injuries.length) {
      lines.push('## My roster — injuries and byes');
      lines.push('');
      lines.push('For each of these NOT on a bye, research the rest-of-season outlook —');
      lines.push('severity, body part, expected timeline — and report it in the `injuries`');
      lines.push('list at the end even if he does not need replacing. **If any of them is out');
      lines.push('for the season, that is a mandated replacement under rule 6: pair him with');
      lines.push('the best available player at his position regardless of how low a priority');
      lines.push('that position normally is.** The bye ones need no research.');
      lines.push('');
      for (i = 0; i < ctx.injuries.length; i++) {
        var inj = ctx.injuries[i];
        lines.push('- **' + inj.name + '** (' + inj.pos + ', ' + inj.nfl + ') — ' +
                   inj.status + (inj.note ? ': ' + inj.note : ''));
      }
      lines.push('');
    }
    lines.push(mandatedSection(ctx));
    lines.push('## Kicker / defense / quarterback — the low-priority positions');
    lines.push('');
    lines.push('Rule 6 above governs these. For reference, the app\'s own read of whether my');
    lines.push('kicker and defense are even available this week:');
    lines.push('');
    lines.push('- K: ' + ((ctx.kdefNeed && ctx.kdefNeed.K)
                 ? '**mine is on bye or ruled out this week**'
                 : 'mine is available'));
    lines.push('- DEF: ' + ((ctx.kdefNeed && ctx.kdefNeed.DEF)
                 ? '**mine is on bye or ruled out this week**'
                 : 'mine is available'));
    lines.push('');
    /* Same text ai.js's live-API waiver call uses (Ai.qbSkepticismText) —
       shared rather than duplicated so the two Claude paths can never
       quietly drift apart (Tj, 2026-09-18: this rule has to apply "also"
       to this offline round trip, not just the paid API call). */
    lines.push('### Quarterback, specifically');
    lines.push('');
    lines.push(root.Ai && root.Ai.qbSkepticismText ? root.Ai.qbSkepticismText() : '');
    lines.push('');
    lines.push(swapsSection(ctx));
    var anyDrop = false;
    if (ctx.dropCandidates) {
      for (k in ctx.dropCandidates) {
        if (Object.prototype.hasOwnProperty.call(ctx.dropCandidates, k) &&
            ctx.dropCandidates[k].length) { anyDrop = true; break; }
      }
    }
    if (anyDrop) {
      lines.push('## Easiest players to drop, by position');
      lines.push('');
      lines.push('My own weakest at each position by rest-of-season value, worst first.');
      lines.push('These are the natural `drop` half of a pair — but they are a shortlist,');
      lines.push('not a fence: anybody on my roster above may be dropped if you can show');
      lines.push('the swap is a clear season-long gain.');
      lines.push('');
      for (k in ctx.dropCandidates) {
        if (!Object.prototype.hasOwnProperty.call(ctx.dropCandidates, k)) continue;
        if (!ctx.dropCandidates[k].length) continue;
        lines.push('- **' + k + '**: ' + ctx.dropCandidates[k].map(function (d) {
          return d.name + ' (' + d.ros.toFixed(0) + ' pts rest-of-season' +
                 (d.outForSeason ? ', **OUT FOR THE SEASON**' : '') + ')';
        }).join(', '));
      }
      lines.push('');
    }
    if (ctx.needs && ctx.needs.length) {
      lines.push('**Where this roster is thinnest** (a starter within 4 points of the best');
      lines.push('free agent at his own position — i.e. barely better than replacement):');
      lines.push('');
      for (i = 0; i < ctx.needs.length; i++) {
        var n = ctx.needs[i];
        lines.push('- **' + n.pos + '** — ' + n.name + ' (' +
                   (typeof n.proj === 'number' ? n.proj.toFixed(1) : '?') +
                   ') is only ' + (typeof n.gap === 'number' ? n.gap.toFixed(1) : '?') +
                   ' better than the wire');
      }
      lines.push('');
      lines.push('Spend most of your effort on those positions.');
      lines.push('');
    }
    lines.push('## AVAILABLE — nobody in this list is on any of the ten rosters');
    lines.push('');
    lines.push('`ROS` is expected points for the rest of the season in this league\'s');
    lines.push('scoring — the number to rank on. `per gm` is that rate per game and `gms`');
    lines.push('is how many he has left after his bye. `vor` is his ROS above the next best');
    lines.push('free agent at the same position, which is the honest way to compare across');
    lines.push('positions when a quarterback outscores a running back by default. `basis`');
    lines.push('says what the number is built from, so you can see where it is thin.');
    lines.push('');
    for (k in ctx.pool) {
      if (!Object.prototype.hasOwnProperty.call(ctx.pool, k)) continue;
      if (!ctx.pool[k].length) continue;
      lines.push('### ' + k);
      lines.push('');
      lines.push('| player | NFL | ROS | per gm | gms | vor | basis |');
      lines.push('|---|---|---|---|---|---|---|');
      for (i = 0; i < ctx.pool[k].length; i++) {
        var f = ctx.pool[k][i];
        lines.push('| ' + f.name + ' | ' + (f.nfl || '?') + ' | ' +
                   (typeof f.ros === 'number' ? f.ros.toFixed(0) : '?') + ' | ' +
                   (typeof f.raw === 'number' ? f.raw.toFixed(1) : '?') + ' | ' +
                   (f.games === undefined ? '?' : f.games) + ' | ' +
                   (typeof f.vor === 'number' ? f.vor.toFixed(0) : '0') + ' | ' +
                   (f.src || '?') + (f.onBye ? ' **(on bye this week)**' : '') + ' |');
      }
      lines.push('');
    }
    lines.push(takenSection(ctx));
    lines.push(contractSection(
      { filename: 'fftracker-waivers-reply.json',
        skeleton: {
          kind: KIND_WAIVER + '.reply', format: FORMAT,
          week: week, season: ctx.season,
          swaps: [{
            drop: '<exact name of ONE player on MY roster>',
            add: '<exact name of ONE player from AVAILABLE>',
            pos: 'QB|RB|WR|TE|K|DEF',
            nfl: '<team abbr of the player being added>',
            rank: 1,
            edge: 0,
            mandated: false,
            confidence: 'high | medium | low',
            why: '<why this exact swap, for the rest of the season>'
          }],
          adds: [{
            name: '<exact name>', pos: 'QB|RB|WR|TE|K|DEF', nfl: '<team abbr>',
            rank: 1,
            overStarter: '<name of the starter he beats, or an empty string>',
            priority: 'season | week',
            recentStat: '<his exact stat line from his most recent game, dated>',
            dropCandidate: '<exact name of the player on my roster to drop for him>',
            confidence: 'high | medium | low',
            why: '<the news or role reason, dated, with the outlet named>'
          }],
          injuries: [{
            name: '<exact name from My roster — injuries>',
            extent: '<severity, body part, how it happened>',
            timeline: '<expected return / rest-of-season outlook, dated and cited>',
            replace: true
          }],
          needs: '<one sentence: where this roster is actually thin, and why>',
          summary: '<two sentences: what to do first>'
        } },
      [
        '`swaps` is the answer. Each entry is ONE player off my roster and ONE off the AVAILABLE list, both named exactly as spelled above.',
        '`edge` — the expected REST-OF-SEASON point difference in this league\'s scoring, `add` minus `drop`, as a number. Tj\'s example reads "expected to produce 54 more fantasy points over the season", so that would be `54`. Be honest: if it is 8 points, write 8 — and then ask yourself whether it is worth recommending at all.',
        '`why` — the reasoning in his words\' shape: why this man is better than that man for the rest of the season, what changed (role, injury ahead of him, usage), dated, with the outlet named. Two or three sentences.',
        '`mandated` — `true` only when the drop is forced (season-ending injury, indefinite suspension, permanently lost the job), which is also what lets a QB/K/DEF swap through rule 6.',
        '`rank` — 1 is the move to make first. Rank mandated replacements above optional upgrades.',
        'Return NO swap rather than a weak one. An empty `swaps` list with a `summary` explaining that my roster is already better than the wire is a correct and useful answer.',
        'Never propose adding anybody in the OWNED list — they are not available, at any price.',
        '`adds` is optional and secondary: use it only for a player worth watching who is not part of a swap you are recommending yet. The app reads `swaps` first.',
        'Prefer players from the AVAILABLE list. You may name at most **2** who are not in it, if the news is strong — mark those `"confidence": "low"`. The app flags them as unverified and will not offer an Add button, because it cannot confirm they are free in this league.',
        '`injuries` — one entry per name in **My roster — injuries** that is not on a bye. If you found nothing beyond the app\'s own designation, say so plainly in `timeline` rather than inventing a timetable.',
        'Never invent news, a stat line, or a point edge. If you found nothing on a player, do not recommend him.'
      ],
      {
        drop: 'Example Bench Back', add: 'Example Back', pos: 'RB', nfl: 'CHI',
        rank: 1, edge: 54, mandated: false, confidence: 'high',
        why: 'Example Back is the new starter after Example Starter\'s hamstring injury ' +
             'Sunday and IR placement Tuesday (NFL.com, 2026-09-08); he took every ' +
             'first-team rep Wednesday and is the early-down and goal-line back the rest ' +
             'of the way. Example Bench Back is the fourth back on his own depth chart ' +
             'and has had six touches all season, so the roster spot is doing nothing.'
      }));
    lines.push('---');
    lines.push('');
    lines.push('## Machine-readable copy of this request');
    lines.push('');
    lines.push('```json');
    lines.push(j({ kind: KIND_WAIVER, format: FORMAT, week: week,
                   season: ctx.season, today: ctx.today }));
    lines.push('```');
    return {
      filename: 'fftracker-waivers-wk' + week + '-' + stamp() + '.md',
      text: lines.join('\n') + '\n',
      ctx: ctx
    };
  }

  /* ================= TEAM ANALYSIS (2026-09-17b) =========================
   * Tj: "ask Claude its overall take on my team versus every other team in
   * the league and recommendations on how to improve my team... similar to
   * other sections of this app where I can export and import Claude
   * replies." Same shape as buildAdvice/buildWaivers above — the context
   * comes from TeamReport.context(), which is itself composed entirely from
   * Value.waiverContext/perGame, Recommend.health and Store.standings (see
   * teamreport.js's own header) — no scoring math lives in this file either.
   *
   * Deliberately no web-search instructions here, matching ai.js's own
   * askTeamAnalysis: every number in this file (a price, a health tag, a
   * record) is already fresh from the app's own feeds, so there is nothing
   * for a search to improve — the ask is judgment over given facts. */
  function buildTeamAnalysis(week, teamId, opponents, season, today) {
    var ctx = root.TeamReport.context(week, teamId, opponents, season, today);
    var lines = [], i, k;

    lines.push(head({ title: 'team analysis — week ' + week + ' vs. the whole league' }));
    lines.push('## What to do');
    lines.push('');
    lines.push('1. Read the standings and every roster in this league, below.');
    lines.push('2. Form an honest overall verdict: where this team genuinely ranks in');
    lines.push('   this specific league, and why — strengths, weaknesses, roster');
    lines.push('   construction, not just the win/loss record (a team can be lucky or');
    lines.push('   unlucky so far).');
    lines.push('3. Compare it to each other team, briefly — one sentence per team naming');
    lines.push('   the actual matchup, not a generic compliment.');
    lines.push('4. Give concrete recommendations to improve it: a realistic trade to');
    lines.push('   explore (naming a specific player on a specific other roster, and');
    lines.push('   what to offer for him), a waiver add worth pursuing, or a lineup/');
    lines.push('   roster-construction fix — whichever actually applies. Ground every');
    lines.push('   player you name in the rosters or the AVAILABLE list below. Never');
    lines.push('   invent a player or a team, and never claim to know what another owner');
    lines.push('   would actually accept — frame a trade as worth OFFERING, never as');
    lines.push('   something that will happen.');
    lines.push('5. Write the answer as the JSON file described at the end.');
    lines.push('');
    lines.push('Today is **' + ctx.today + '**. This is **NFL week ' + week +
               ' of the ' + ctx.season + ' season**.');
    lines.push('');
    lines.push(scoringSection());
    lines.push('## Standings');
    lines.push('');
    lines.push('| rank | team | record | points |');
    lines.push('|---|---|---|---|');
    for (i = 0; i < ctx.rosters.length; i++) {
      var s = ctx.rosters[i];
      lines.push('| ' + s.rankWL + ' | ' + s.name + (s.mine ? ' **(you)**' : '') + ' | ' +
                 s.w + '-' + s.l + (s.t ? '-' + s.t : '') + ' | ' + s.pts.toFixed(1) + ' |');
    }
    lines.push('');
    lines.push('## Every roster in the league');
    lines.push('');
    lines.push('"pts/gm" is a rest-of-season per-game price, already converted to this');
    lines.push('league\'s scoring — judge every player by this number, not by reputation.');
    lines.push('"status" is a current injury/inactive designation from the app\'s own feed;');
    lines.push('"—" means clear.');
    lines.push('');
    for (i = 0; i < ctx.rosters.length; i++) {
      var t = ctx.rosters[i];
      lines.push('### ' + t.name + (t.mine ? ' (you)' : '') + ' — ' +
                 t.w + '-' + t.l + (t.t ? '-' + t.t : '') + ', ' + t.pts.toFixed(1) +
                 ' pts, rank ' + t.rankWL + ' of ' + ctx.rosters.length);
      lines.push('');
      lines.push('| player | pos | NFL | pts/gm | status |');
      lines.push('|---|---|---|---|---|');
      for (k = 0; k < t.players.length; k++) {
        var p = t.players[k];
        lines.push('| ' + p.name + ' | ' + p.pos + ' | ' + (p.nfl || '?') + ' | ' +
                   p.ros.toFixed(1) + ' | ' +
                   (p.onBye ? 'bye wk ' + week : (p.health || '—')) + ' |');
      }
      lines.push('');
    }
    lines.push('**Your bench:** ' + (ctx.bench.length ? ctx.bench.join(', ') : '(empty)'));
    lines.push('');
    if (ctx.injuries && ctx.injuries.length) {
      lines.push('### Your roster — injuries');
      lines.push('');
      for (i = 0; i < ctx.injuries.length; i++) {
        var inj = ctx.injuries[i];
        lines.push('- **' + inj.name + '** (' + inj.pos + ', ' + inj.nfl + ') — ' +
                   inj.status + (inj.note ? ': ' + inj.note : ''));
      }
      lines.push('');
    }
    var anyDrop = false;
    if (ctx.dropCandidates) {
      for (k in ctx.dropCandidates) {
        if (Object.prototype.hasOwnProperty.call(ctx.dropCandidates, k) &&
            ctx.dropCandidates[k].length) { anyDrop = true; break; }
      }
    }
    if (anyDrop) {
      lines.push('### Your drop candidates — weakest player at each position');
      lines.push('');
      lines.push('A waiver recommendation\'s `dropCandidate` **must** be chosen from here,');
      lines.push('or left an empty string.');
      lines.push('');
      for (k in ctx.dropCandidates) {
        if (!Object.prototype.hasOwnProperty.call(ctx.dropCandidates, k)) continue;
        if (!ctx.dropCandidates[k].length) continue;
        lines.push('- **' + k + '**: ' + ctx.dropCandidates[k].map(function (d) {
          return d.name + ' (ROS value ' + d.ros.toFixed(1) + ')';
        }).join(', '));
      }
      lines.push('');
    }
    if (ctx.needs && ctx.needs.length) {
      lines.push('**Where your roster is thinnest**, weakest first:');
      lines.push('');
      for (i = 0; i < ctx.needs.length; i++) {
        var n = ctx.needs[i];
        lines.push('- **' + n.pos + '** — ' + n.name + ' (' +
                   (typeof n.proj === 'number' ? n.proj.toFixed(1) : '?') + ')' +
                   (n.note ? ' — ' + n.note : ''));
      }
      lines.push('');
    }
    lines.push('## AVAILABLE — nobody in this list is on any of the ' +
               ctx.rosters.length + ' rosters');
    lines.push('');
    lines.push('A waiver-type recommendation\'s `targetPlayer` may come from here.');
    lines.push('');
    for (k in ctx.pool) {
      if (!Object.prototype.hasOwnProperty.call(ctx.pool, k)) continue;
      if (!ctx.pool[k].length) continue;
      lines.push('### ' + k);
      lines.push('');
      lines.push('| player | NFL | pts/gm |');
      lines.push('|---|---|---|');
      for (i = 0; i < ctx.pool[k].length; i++) {
        var f = ctx.pool[k][i];
        lines.push('| ' + f.name + ' | ' + (f.nfl || '?') + ' | ' +
                   (typeof f.v === 'number' ? f.v.toFixed(1) : '?') + ' |');
      }
      lines.push('');
    }
    lines.push(contractSection(
      { filename: 'fftracker-teamanalysis-reply.json',
        skeleton: {
          kind: KIND_TEAM + '.reply', format: FORMAT,
          week: week, season: ctx.season,
          overall: { rank: 1, of: ctx.rosters.length,
                     verdict: '<a few honest sentences: where this team really stands and why>' },
          teamComparisons: [{
            team: '<exact team name from the standings table>',
            note: '<one or two sentences on that specific matchup>'
          }],
          strengths: ['<short phrase>'],
          weaknesses: ['<short phrase>'],
          recommendations: [{
            type: 'trade | waiver | lineup | general',
            action: '<one short imperative sentence>',
            targetPlayer: '<exact name from a roster or AVAILABLE, or an empty string>',
            fromTeam: '<exact team name, only when targetPlayer is a trade target on ' +
                      'another roster, else an empty string>',
            giveUp: '<exact name from YOUR OWN roster to offer, trade only, else an empty string>',
            dropCandidate: '<exact name from your drop candidates, waiver only, else an empty string>',
            why: '<the reasoning, one or two sentences>'
          }],
          summary: '<two or three sentences: the bottom line, what to do first>'
        } },
      [
        '`rank`/`of` — your honest read of where this team truly stands among all the ' +
        'teams in the league, 1 = best. Weigh roster strength and depth as given, not ' +
        'only the standings.',
        '`team` in `teamComparisons` — copy the name EXACTLY as given in the standings ' +
        'table. Cover every other team once.',
        '`targetPlayer`/`fromTeam`/`giveUp`/`dropCandidate` — copy names EXACTLY as ' +
        'given. Never invent a player or a team; leave a field an empty string rather ' +
        'than guess.',
        'A trade recommendation needs both `targetPlayer` and `fromTeam`. A waiver ' +
        'recommendation should set `dropCandidate` when there is a fair swap at the ' +
        'same position.',
        'Do not pad the list — 3 to 6 real recommendations beat 10 padded ones.'
      ],
      {
        type: 'trade', action: 'Trade for Example Star',
        targetPlayer: 'Example Star', fromTeam: 'Example Other Team',
        giveUp: 'Example Bench Piece',
        dropCandidate: '',
        why: 'Their RB2 is stuck behind a healthy starter while your RB2 slot is your ' +
             'clearest weakness — a fair change-of-scenery deal for both sides.'
      }));
    lines.push('---');
    lines.push('');
    lines.push('## Machine-readable copy of this request');
    lines.push('');
    lines.push('```json');
    lines.push(j({ kind: KIND_TEAM, format: FORMAT, week: week,
                   season: ctx.season, today: ctx.today, team: ctx.teamName }));
    lines.push('```');
    return {
      filename: 'fftracker-teamanalysis-wk' + week + '-' + stamp() + '.md',
      text: lines.join('\n') + '\n',
      ctx: ctx
    };
  }

  /* ================= IMPORT ==============================================
   * Tolerant about the WRAPPER, strict about the CONTENT.
   *
   * Tolerant because Tj is going to hand this whatever the Claude app gave
   * him: a downloaded .json, a .md with a fenced block, or the whole reply
   * pasted in with prose around it. Refusing those would make the feature
   * useless in exactly the situation it exists for. The finding is delegated
   * to `Ai.parseAnswer`, which is the same string-aware scanner the live API
   * path uses — it already copes with fences, narration and truncation, and
   * it is tested against real model output.
   *
   * Strict because a reply for the wrong week, or the wrong kind of reply
   * entirely, must never be half-applied. Everything is validated before
   * anything is written, and a refusal says which check failed. */
  function detect(obj) {
    if (!obj || typeof obj !== 'object') return '';
    var k = String(obj.kind || '');
    /* 2026-09-15e sweep: this used to be k.indexOf(KIND_ADVICE) === 0, a
     * PREFIX match — today harmless only because the app itself only ever
     * emits exactly two literal strings per kind (the request's own
     * KIND_ADVICE, and the reply skeleton's KIND_ADVICE + '.reply'), so an
     * exact check on those two catches the same real cases. A prefix match
     * would also have silently accepted anything merely starting with
     * "fftracker.advice" — a plausible model typo or hallucinated variant —
     * as a fully valid advice reply, directly contradicting this function's
     * own comment above ("Strict because... the wrong kind of reply
     * entirely must never be half-applied"). */
    if (k === KIND_ADVICE || k === KIND_ADVICE + '.reply') return 'advice';
    if (k === KIND_WAIVER || k === KIND_WAIVER + '.reply') return 'waivers';
    if (k === KIND_TEAM || k === KIND_TEAM + '.reply') return 'teamanalysis';
    /* no kind field — fall back to shape, because a model that rewrote the
       skeleton by hand is still giving a usable answer */
    /* Array.isArray, not a truthy `.length` — a STRING has a length, so
       {"players":"none found"} would otherwise be accepted as an advice reply
       and then quietly apply nothing. */
    if (Array.isArray(obj.players)) return 'advice';
    if (Array.isArray(obj.adds) || Array.isArray(obj.swaps)) return 'waivers';
    /* teamanalysis's own shape check comes last and is deliberately narrower
       than a single field name: "recommendations" alone is too generic a
       word to trust on its own, but paired with "overall" (an object, not
       a list — Array.isArray would wrongly reject it) it is specific enough
       to this reply's contract that a hand-rewritten skeleton still matches. */
    if (obj.overall && typeof obj.overall === 'object' && !Array.isArray(obj.overall)) {
      return 'teamanalysis';
    }
    return '';
  }

  /* Every skeleton in contractSection() above wraps its placeholder text in
   * a single pair of angle brackets, start to end — `'<copy the name EXACTLY
   * ...>'`, `'<one short imperative sentence>'`, and so on — and NOTHING
   * ELSE in this app writes a string shaped that way. That makes it a safe,
   * specific signal for a real defect this file did not use to guard
   * against: `Ai.parseAnswer`'s scanner takes the WIDEST valid JSON object
   * in the text it is given (see jsonOf's own comment), and the skeleton
   * embedded in "## The file to give back" is a bigger, equally-valid JSON
   * object than a short real answer would be — so pasting the WHOLE
   * exported file back in (the file made for Claude, not what Claude sent
   * back) parses cleanly, matches the shape check, and gets happily
   * "imported" as if it were a real, filled-in answer. Confirmed
   * reproducible end to end (2026-09-17): Tj reported the team-analysis
   * screen showing his own app's literal template text back at him
   * ("Rank 1 of 10. <a few honest sentences...>"); feeding
   * buildTeamAnalysis()'s own export straight back into importReply()
   * reproduces it exactly, and the same is true of the older waiver
   * handoff — this bug predates the team-analysis feature, it was just the
   * report that surfaced it. Checked recursively so it also catches a
   * placeholder nested inside an array (a `recommendations[].action`, a
   * `players[].reason`), not just a top-level field. */
  function findPlaceholder(v) {
    if (typeof v === 'string') {
      var s = v.trim();
      return (/^<[\s\S]*>$/.test(s) && s.length < 400) ? s : null;
    }
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) {
        var hit = findPlaceholder(v[i]);
        if (hit) return hit;
      }
      return null;
    }
    if (v && typeof v === 'object') {
      for (var k in v) {
        if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
        var hit2 = findPlaceholder(v[k]);
        if (hit2) return hit2;
      }
    }
    return null;
  }

  function importReply(text, opts) {
    opts = opts || {};
    var raw = String(text || '').trim();
    if (!raw) throw new Error('That file is empty.');

    var obj;
    try {
      obj = root.Ai.parseAnswer(raw, {});
    } catch (e) {
      throw new Error('That does not look like a reply from Claude. ' +
        (e && e.message ? e.message : '') +
        '\n\nExpected the JSON file Claude was asked to write — or the reply ' +
        'pasted in, fenced block and all.');
    }

    var kind = detect(obj);
    if (!kind) {
      throw new Error('That is JSON, but not a reply this app understands. ' +
        'It needs a "players" list (lineup advice), an "adds" list (the ' +
        'waiver wire), or an "overall" verdict (the team analysis). It has: ' +
        Object.keys(obj).slice(0, 6).join(', ') + '.');
    }

    /* THE DANGEROUS CASE THIS CATCHES: it parses, it matches the shape, and
       it would otherwise apply — but it is the unfilled TEMPLATE, not an
       answer. See findPlaceholder's own comment for exactly how this
       happens and how it was confirmed. */
    var placeholder = findPlaceholder(obj);
    if (placeholder) {
      throw new Error('That still has the template\'s own placeholder text in it ' +
        '("' + placeholder.slice(0, 70) + (placeholder.length > 70 ? '…' : '') + '"), ' +
        'not a real answer. Nothing was changed.\n\nThis usually means the file that ' +
        'was pasted or loaded is the one exported FOR Claude, not the one Claude sent ' +
        'BACK. Send the exported file to a Claude chat with no message, then load or ' +
        'paste what Claude replies with — not the file you just made.');
    }

    /* A reply for another week is the dangerous case: it parses, it applies,
       and it is silently wrong. Refuse it and say so. */
    var wk = opts.week;
    if (wk && obj.week && Number(obj.week) !== Number(wk)) {
      throw new Error('That reply is for week ' + obj.week +
        ', but the app is on week ' + wk + '. Nothing was changed. ' +
        'Switch weeks, or export a fresh request for week ' + wk + '.');
    }

    /* Everything downstream files verdicts against a week, and the UI only
       shows a summary when aiCache.week matches the week on screen. A reply
       with no week and no caller week would be stored under `undefined` and
       then silently never displayed — a worse outcome than refusing. */
    var useWeek = wk || obj.week;
    if (!useWeek) {
      throw new Error('That reply does not say which week it is for, and the app ' +
        'was not told either. Nothing was changed.');
    }

    if (kind === 'advice') {
      var norm = root.Ai.normalizeAdvice(obj, { week: useWeek },
                                         'Claude app (handoff)');
      if (!norm.count) {
        throw new Error('That reply has a "players" list, but no entry in it had ' +
          'a name. Nothing was changed.');
      }
      root.Recommend.mergeAi(useWeek, {
        at: Date.now(), byName: norm.byName, summary: norm.summary,
        model: 'Claude app (handoff)', count: norm.count,
        truncated: norm.truncated
      }, { researched: norm.count, carried: 0, settled: 0 });
      return { kind: 'advice', applied: norm.count, truncated: norm.truncated,
               summary: norm.summary,
               detail: norm.count + ' player' + (norm.count === 1 ? '' : 's') +
                       ' updated from the Claude app' };
    }

    if (kind === 'teamanalysis') {
      /* Verified against a FRESH context, not whatever the export built —
         same reasoning as the waiver pool rebuild just below: a player
         traded or signed since the export must not read as still-verified,
         and this is a report, not something that mutates a roster, so
         there is no lineup/add to apply either way. */
      var ctxT = opts.ctx;
      if (!ctxT) {
        throw new Error('Internal error: no league context to check this reply ' +
          'against. Nothing was changed.');
      }
      var normT = root.Ai.normalizeTeamAnalysis(obj, ctxT);
      if (!normT.overall.verdict && !normT.recommendations.length && !normT.summary) {
        throw new Error('That reply has no verdict, no recommendations and no ' +
          'summary. Nothing was changed.');
      }
      var savedT = {
        at: Date.now(), week: useWeek, season: ctxT.season,
        model: 'Claude app (handoff)',
        overall: normT.overall, teamComparisons: normT.teamComparisons,
        strengths: normT.strengths, weaknesses: normT.weaknesses,
        recommendations: normT.recommendations, summary: normT.summary,
        usage: null, spent: null
      };
      root.TeamReport.save(savedT);
      var unverifiedT = 0, ri;
      for (ri = 0; ri < normT.recommendations.length; ri++) {
        if (!normT.recommendations[ri].verified) unverifiedT++;
      }
      return {
        kind: 'teamanalysis', applied: normT.recommendations.length,
        unverified: unverifiedT, summary: normT.summary, result: savedT,
        detail: 'Team analysis updated from the Claude app' +
          (normT.recommendations.length
            ? ' — ' + normT.recommendations.length + ' recommendation' +
              (normT.recommendations.length === 1 ? '' : 's')
            : '') +
          (unverifiedT ? ' (' + unverifiedT + ' naming a player not in the lists sent)' : '')
      };
    }

    /* waivers */
    var pool = opts.pool || {};
    var res = root.Ai.normalizeWaivers(obj, root.Ai.poolIndex(pool),
                                        root.Ai.rosterIndex(opts.roster),
                                        opts.kdefNeed, opts.mandated);
    if (!res.adds.length) {
      throw new Error('That reply has a "swaps" or "adds" list, but no entry in it ' +
        'named a player. Nothing was changed.');
    }
    var unverified = 0, i;
    for (i = 0; i < res.adds.length; i++) if (!res.adds[i].verified) unverified++;
    var saved = {
      at: Date.now(), week: useWeek, model: 'Claude app (handoff)',
      searchBudget: 0, adds: res.adds,
      injuries: root.Ai.normalizeInjuries(obj, opts.injuries),
      needs: String(obj.needs || ''), summary: String(obj.summary || ''),
      usage: null, spent: null
    };
    root.Value.waiverSave(saved);
    return { kind: 'waivers', applied: res.adds.length, unverified: unverified,
             summary: saved.summary, result: saved,
             detail: res.adds.length + ' add' + (res.adds.length === 1 ? '' : 's') +
                     ' from the Claude app' +
                     (unverified ? ', ' + unverified + ' of them not in the app\'s pool'
                                 : '') };
  }

  root.Handoff = {
    buildAdvice: buildAdvice,
    buildWaivers: buildWaivers,
    buildTeamAnalysis: buildTeamAnalysis,
    importReply: importReply,
    detect: detect,
    KIND_ADVICE: KIND_ADVICE, KIND_WAIVER: KIND_WAIVER, KIND_TEAM: KIND_TEAM, FORMAT: FORMAT
  };
})(typeof window !== 'undefined' ? window : this);
