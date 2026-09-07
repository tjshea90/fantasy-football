/* handoff.js — the offline Claude round trip (v4.3).
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
    lines.push('| player | pos | NFL | opponent | app projection | ESPN status |');
    lines.push('|---|---|---|---|---|---|');
    for (i = 0; i < ctx.players.length; i++) {
      var p = ctx.players[i];
      lines.push('| ' + p.name + ' | ' + p.pos + ' | ' + (p.nfl || '?') + ' | ' +
                 (p.opp || '—') + ' | ' +
                 (typeof p.proj === 'number' ? p.proj.toFixed(1) : '?') + ' | ' +
                 (p.feedStatus || 'no designation') + ' |');
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
  function buildWaivers(week, teamId, opp, season, today) {
    var ctx = root.Value.waiverContext(week, teamId, opp, season, today);
    var lines = [], k, i;

    lines.push(head({ title: 'week ' + week + ' waiver wire' }));
    lines.push('## What to do');
    lines.push('');
    lines.push('1. Read this week\'s waiver-wire and injury news for the players in the');
    lines.push('   **AVAILABLE** list below.');
    lines.push('2. Re-rank them **for this specific roster** and this specific scoring.');
    lines.push('3. Say plainly which of them, if any, beats a player currently being');
    lines.push('   started — naming the starter.');
    lines.push('4. Write the answer as the JSON file described at the end.');
    lines.push('');
    lines.push('Today is **' + ctx.today + '**. This is **NFL week ' + week +
               ' of the ' + ctx.season + ' season**.');
    lines.push('');
    lines.push('### The division of labour, so you do not redo work');
    lines.push('');
    lines.push('**The app has already done the part you cannot.** It is the only thing');
    lines.push('that knows who is genuinely unrostered in this particular ten-team');
    lines.push('league, and the only thing that prices a player in this particular');
    lines.push('scoring. Every name in the AVAILABLE list is confirmed free, and every');
    lines.push('number beside it is already in league points.');
    lines.push('');
    lines.push('**What you add is what a stat line cannot show**: the starter ahead of a');
    lines.push('backup got hurt on Sunday, a rookie just took the third-down role, a');
    lines.push('coach named a closer, a snap share moved. That is the whole job.');
    lines.push('');
    lines.push(scoringSection());
    lines.push('## My current starting lineup, as the app projects it');
    lines.push('');
    lines.push('| slot | player | pos | projection |');
    lines.push('|---|---|---|---|');
    for (i = 0; i < ctx.starters.length; i++) {
      var s = ctx.starters[i];
      lines.push('| ' + s.slot + ' | ' + s.name + ' | ' + s.pos + ' | ' +
                 (typeof s.proj === 'number' ? s.proj.toFixed(1) : '?') + ' |');
    }
    lines.push('');
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
    lines.push('`proj` is this week in league points. `vor` is points above the next');
    lines.push('best free agent at the same position, which is the honest way to compare');
    lines.push('across positions when a quarterback outscores a running back by default.');
    lines.push('');
    for (k in ctx.pool) {
      if (!Object.prototype.hasOwnProperty.call(ctx.pool, k)) continue;
      if (!ctx.pool[k].length) continue;
      lines.push('### ' + k);
      lines.push('');
      lines.push('| player | NFL | proj | vor | bye |');
      lines.push('|---|---|---|---|---|');
      for (i = 0; i < ctx.pool[k].length; i++) {
        var f = ctx.pool[k][i];
        lines.push('| ' + f.name + ' | ' + (f.nfl || '?') + ' | ' +
                   (typeof f.v === 'number' ? f.v.toFixed(1) : '?') + ' | ' +
                   (typeof f.vor === 'number' ? f.vor.toFixed(1) : '?') + ' | ' +
                   (f.bye || '—') + (f.onBye ? ' **ON BYE**' : '') + ' |');
      }
      lines.push('');
    }
    lines.push(contractSection(
      { filename: 'fftracker-waivers-reply.json',
        skeleton: {
          kind: KIND_WAIVER + '.reply', format: FORMAT,
          week: week, season: ctx.season,
          adds: [{
            name: '<exact name>', pos: 'QB|RB|WR|TE|K|DEF', nfl: '<team abbr>',
            rank: 1,
            overStarter: '<name of the starter he beats, or an empty string>',
            confidence: 'high | medium | low',
            why: '<the news or role reason, dated, with the outlet named>'
          }],
          needs: '<one sentence: where this roster is actually thin, and why>',
          summary: '<two sentences: what to do first>'
        } },
      [
        '`rank` — 1 is the best add overall. Also rank within each position by listing that position\'s players in order.',
        'Return the best few at **each** position that has a credible option, not one global list. A list of nothing but quarterbacks is useless here even though quarterbacks score most.',
        '`overStarter` — fill it in **only** when you actually believe he beats that named starter this week under this scoring. Empty string otherwise. Do not guess.',
        'Prefer players from the AVAILABLE list. You may name at most **2** who are not in it, if the news is strong — mark those `"confidence": "low"`. The app flags them as unverified and will not offer an Add button, because it cannot confirm they are free in this league.',
        'If a position has no credible add, omit it rather than padding the list.',
        'Never invent news. If you found nothing on a player, do not rank him.'
      ],
      {
        name: 'Example Back', pos: 'RB', nfl: 'CHI', rank: 1,
        overStarter: 'Example Starter', confidence: 'high',
        why: 'The starter ahead of him left Sunday\'s game with a hamstring injury ' +
             'and was placed on IR Tuesday (NFL.com, 2026-09-08). He took every ' +
             'first-team rep Wednesday and is the early-down and goal-line back.'
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
    if (k.indexOf(KIND_ADVICE) === 0) return 'advice';
    if (k.indexOf(KIND_WAIVER) === 0) return 'waivers';
    /* no kind field — fall back to shape, because a model that rewrote the
       skeleton by hand is still giving a usable answer */
    if (obj.players && obj.players.length !== undefined) return 'advice';
    if (obj.adds && obj.adds.length !== undefined) return 'waivers';
    return '';
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
        'It needs a "players" list (lineup advice) or an "adds" list (the ' +
        'waiver wire). It has: ' + Object.keys(obj).slice(0, 6).join(', ') + '.');
    }

    /* A reply for another week is the dangerous case: it parses, it applies,
       and it is silently wrong. Refuse it and say so. */
    var wk = opts.week;
    if (wk && obj.week && Number(obj.week) !== Number(wk)) {
      throw new Error('That reply is for week ' + obj.week +
        ', but the app is on week ' + wk + '. Nothing was changed. ' +
        'Switch weeks, or export a fresh request for week ' + wk + '.');
    }

    if (kind === 'advice') {
      var norm = root.Ai.normalizeAdvice(obj, { week: wk || obj.week || 0 },
                                         'Claude app (handoff)');
      if (!norm.count) {
        throw new Error('That reply has a "players" list, but no entry in it had ' +
          'a name. Nothing was changed.');
      }
      root.Recommend.mergeAi(wk || obj.week, {
        at: Date.now(), byName: norm.byName, summary: norm.summary,
        model: 'Claude app (handoff)', count: norm.count,
        truncated: norm.truncated
      }, { researched: norm.count, carried: 0, settled: 0 });
      return { kind: 'advice', applied: norm.count, truncated: norm.truncated,
               summary: norm.summary,
               detail: norm.count + ' player' + (norm.count === 1 ? '' : 's') +
                       ' updated from the Claude app' };
    }

    /* waivers */
    var pool = opts.pool || {};
    var res = root.Ai.normalizeWaivers(obj, root.Ai.poolIndex(pool));
    if (!res.adds.length) {
      throw new Error('That reply has an "adds" list, but no entry in it had a ' +
        'name. Nothing was changed.');
    }
    var unverified = 0, i;
    for (i = 0; i < res.adds.length; i++) if (!res.adds[i].verified) unverified++;
    var saved = {
      at: Date.now(), week: wk || obj.week, model: 'Claude app (handoff)',
      searchBudget: 0, adds: res.adds,
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
    importReply: importReply,
    detect: detect,
    KIND_ADVICE: KIND_ADVICE, KIND_WAIVER: KIND_WAIVER, FORMAT: FORMAT
  };
})(typeof window !== 'undefined' ? window : this);
