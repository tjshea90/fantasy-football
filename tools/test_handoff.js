/* test_handoff.js — the offline Claude round trip, driven end to end.
 *
 * Tj's requirement was specific: export a file, upload it to a Claude chat
 * WITH NO EXPLANATION, get a file back, import it, and the app is filled in.
 * "No explanation" is the part a test has to take seriously — so the first
 * section asserts that the exported briefing carries everything a reader who
 * has been told nothing would need, and the rest actually completes the loop:
 * build the export, answer it the way the Claude app would, import the answer,
 * and read the app's own state back to prove it landed.
 *
 * The reply shapes below are not tidied. They are what actually comes back
 * from a chat: a fenced block, a bare file, a whole message with prose around
 * it, a reply for last week, a reply with a name spelled the other way.
 */
'use strict';
var fs = require('fs'), path = require('path'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }
function throws(fn, re, m) {
  var e = null;
  try { fn(); } catch (err) { e = err; }
  ok(e && re.test(e.message), m + (e ? '  [' + e.message.slice(0, 80).replace(/\n/g, ' ') + ']' : '  [did not throw]'));
}

/* ---- boot the whole app, index.html order ------------------------------- */
var W = { window: null };
W.window = W;
W.setTimeout = setTimeout; W.clearTimeout = clearTimeout;
W.localStorage = (function () {
  var d = {};
  return { getItem: function (k) { return d[k] === undefined ? null : d[k]; },
           setItem: function (k, v) { d[k] = String(v); },
           removeItem: function (k) { delete d[k]; } };
}());
var disk = {};
W.Native = {
  save: function (k, v) { disk[k] = v; return true; },
  load: function (k) { return disk[k] === undefined ? null : disk[k]; }
};
function load(f) {
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets', f), 'utf8'))(W);
}
['seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js', 'store.js', 'playerdb.js',
 'projections.js', 'usage.js', 'ai.js', 'recommend.js', 'sim.js', 'ros.js', 'value.js', 'teamreport.js',
 'recap.js', 'handoff.js'].forEach(load);
ok(!!W.SEED, 'the seed loaded');
W.Store.init(W.SEED);
W.PlayerDB.init();
var S = W.Store.get();
var me = S.league.me;
var WEEK = 1;

/* ---- 1. the exported briefing explains itself ---------------------------- */
console.log('\n-- the advice briefing, read by someone told nothing --');
var adv = W.Handoff.buildAdvice(WEEK, me, null);
var A = adv.text;

ok(/\.md$/.test(adv.filename) && adv.filename.indexOf('wk' + WEEK) > 0,
   'the file is named for what it is: ' + adv.filename);
ok(/handed this file with no other instructions/i.test(A),
   'it opens by saying no other instructions are coming  <-- Tj\'s actual requirement');
ok(/## What to do/.test(A), 'it states the task under a heading');
ok(/completed pass is worth 1 point/.test(A),
   'it carries the one scoring fact that makes every public ranking wrong here');
ok(/Do not import anyone else's "projected points"/.test(A),
   'it forbids importing outside projected points, which is the trap this league sets');
ok(/QB · RB · RB · WR · WR · WR · TE · FLEX/.test(A), 'it lists the starting slots');
ok(/## The roster/.test(A) && /\| player \| pos \| NFL \| opponent \| kickoff \|/.test(A),
   'the roster is a readable table, not a JSON blob, and it carries the kickoff');
ok(/fftracker-advice-reply\.json/.test(A), 'it names the file to write back');
ok(/### A worked example of one entry/.test(A),
   'it shows a filled-in example, not just a skeleton');
/* whitespace-tolerant: the briefing is hard-wrapped for readability, so the
   phrase can land across a line break */
ok(/Never\*{0,2}\s+invent news/i.test(A),
   'it forbids inventing news, which is the failure mode that matters most');
ok(A.indexOf('"kind": "fftracker.advice"') > 0,
   'it embeds a machine-readable copy of the request for the app to check against');
ok(adv.players > 0, 'the briefing carries real players (' + adv.players + ')');

/* every rostered player who is not settled must appear by name */
(function () {
  var missing = [], i, t = W.Store.team(me);
  for (i = 0; i < t.players.length; i++) {
    if (A.indexOf(t.players[i].name) < 0) missing.push(t.players[i].name);
  }
  ok(!missing.length, 'every rostered player appears in the briefing' +
     (missing.length ? ' — missing: ' + missing.join(', ') : ''));
}());

/* the handoff asks about EVERYONE, unlike the cost-rationed API path */
(function () {
  var triaged = W.Recommend.rosterContext(WEEK, me, null);
  var all = W.Recommend.rosterContext(WEEK, me, null, { everyone: true });
  ok(all.players.length >= triaged.players.length,
     'the handoff asks about every player (' + all.players.length +
     '), not the cost-triaged subset (' + triaged.players.length +
     ') — a search costs nothing on his own subscription');
}());

/* ---- 2. the waiver briefing ---------------------------------------------- */
console.log('\n-- the waiver briefing --');
var wav = W.Handoff.buildWaivers(WEEK, me, null, 2026, '2026-09-07');
var V = wav.text;
ok(/handed this file with no other instructions/i.test(V), 'same self-explaining opening');
ok(/## AVAILABLE — nobody in this list is on any of the ten rosters/.test(V),
   'it asserts availability so no effort is spent rediscovering it');
ok(/division of labour/.test(V),
   'it explains what the app already did, so the answer adds news rather than repeating maths');
ok(/fftracker-waivers-reply\.json/.test(V), 'it names the reply file');
ok(/at most \*\*2\*\*/.test(V), 'it caps unverifiable suggestions at two');
ok(V.length > 2000 && V.length < 200000,
   'the briefing is a sane size (' + V.length + ' chars)');
ok(/Kicker \/ defense — do I actually need one\?/.test(V),
   'the K/DEF need section is included, so the offline path gates it too');
ok(/priority/.test(V) && /season/.test(V) && /"week"|`"week"`/.test(V),
   'the season/week priority contract field is documented');
ok(/recentStat/.test(V), 'the recentStat contract field is documented');
ok(/dropCandidate/.test(V) && /DROP CANDIDATES|Drop candidates/.test(V),
   'the dropCandidate contract field and its source list are documented');
(function () {
  var wc = W.Value.waiverContext(WEEK, me, null, 2026, '2026-09-07');
  if (wc.injuries.length) {
    ok(/My roster — injuries/.test(V),
       'the injuries section appears in the briefing when the roster actually has one');
  } else {
    ok(true, '(this roster has no injuries this week — section correctly omitted)');
  }
}());

/* ---- 2b. the team analysis briefing (2026-09-17b) ------------------------ */
console.log('\n-- the team analysis briefing --');
var taExp = W.Handoff.buildTeamAnalysis(WEEK, me, null, 2026, '2026-09-07');
var TA = taExp.text;
ok(/handed this file with no other instructions/i.test(TA), 'same self-explaining opening');
ok(/team analysis — week 1 vs\. the whole league/.test(TA),
   'the title says what this file is, distinct from the advice/waiver briefings');
ok(/## Standings/.test(TA) && /\| rank \| team \| record \| points \|/.test(TA),
   'the standings table is included');
ok(/## Every roster in the league/.test(TA), 'every roster in the league is included, not just mine');
ok(taExp.ctx.rosters.length === W.Store.get().teams.length,
   'the briefing context carries every team (' + taExp.ctx.rosters.length + ')');
(function () {
  var missingTeams = [], i;
  for (i = 0; i < W.Store.get().teams.length; i++) {
    var nm = W.Store.get().teams[i].name;
    if (TA.indexOf('### ' + nm) < 0 && TA.indexOf('### ' + nm + ' (you)') < 0) missingTeams.push(nm);
  }
  ok(!missingTeams.length,
     'every team\'s roster heading actually appears in the file' +
     (missingTeams.length ? ' — missing: ' + missingTeams.join(', ') : ''));
}());
ok(/## AVAILABLE — nobody in this list is on any of the \d+ rosters/.test(TA),
   'the free-agent shortlist is included, grounding waiver-type recommendations');
ok(/Never invent a player or a team/.test(TA), 'inventing a player or a team is explicitly forbidden');
ok(/fftracker-teamanalysis-reply\.json/.test(TA), 'it names the reply file');
ok(TA.indexOf('"kind": "fftracker.teamanalysis"') > 0,
   'it embeds a machine-readable copy of the request for the app to check against');
ok(TA.length > 2000 && TA.length < 300000,
   'the briefing is a sane size (' + TA.length + ' chars)');

/* ---- 3. the round trip actually completes -------------------------------- */
console.log('\n-- the loop: export, answer, import, read the app back --');
var ctxAll = W.Recommend.rosterContext(WEEK, me, null, { everyone: true });
var first = ctxAll.players[0], second = ctxAll.players[1];

/* what the Claude app hands back: a fenced block inside a chat message */
var reply = '```json\n' + JSON.stringify({
  kind: 'fftracker.advice.reply', format: 1, week: WEEK, season: 2026,
  players: [
    { name: first.name, status: 'questionable', willPlay: true, adjust: 0.82,
      confidence: 'medium',
      reason: 'Left Thursday practice with an abdominal issue (ESPN, 2026-09-05). ' +
              'Expected to play but the workload is the thing at risk here.' },
    { name: second.name, status: 'clear', willPlay: true, adjust: 1.0,
      confidence: 'high', reason: 'Full participant all week. No designation.' }
  ],
  summary: 'One real question mark, everyone else is clean.'
}, null, 2) + '\n```';

var r1 = W.Handoff.importReply(reply, { week: WEEK });
ok(r1.kind === 'advice', 'a fenced advice reply is recognised as advice');
ok(r1.applied === 2, 'both players were applied (' + r1.applied + ')');

/* THE POINT OF THE WHOLE FEATURE: is the app actually filled in? */
(function () {
  var cache = W.Recommend.aiCache();
  var key = W.Names.canon(first.name);
  var v = cache.byName[key];
  ok(!!v, 'the verdict is in the app\'s own advice cache, under the canonical name');
  ok(v && v.adjust === 0.82, 'the multiplier survived the round trip');
  ok(v && v.status === 'questionable', 'the status survived');
  ok(v && /abdominal issue/.test(v.reason), 'the reasoning survived, in full');
  ok(v && v.model === 'Claude app (handoff)',
     'the verdict says where it came from, so the UI never implies an API call');
  ok(cache.summary === 'One real question mark, everyone else is clean.',
     'the summary landed');
  ok(cache.week === WEEK, 'it is filed against the right week');
}());

/* and it must reach the advice the screen actually renders */
(function () {
  var res = W.Recommend.projectAll(WEEK, me, null);
  var row = null, i;
  for (i = 0; i < res.length; i++) if (res[i].p && res[i].p.name === first.name) row = res[i];
  ok(!!row, 'the player is still in the projection list');
  var txt = JSON.stringify(row);
  ok(/abdominal issue/.test(txt),
     'the imported reasoning reaches the advice row the Advice tab renders  <-- the feature works');
}());

/* ---- 4. the shapes a real reply arrives in ------------------------------- */
console.log('\n-- the wrapper is tolerated, the content is not --');

var bare = JSON.stringify({ kind: 'fftracker.advice.reply', week: WEEK,
  players: [{ name: second.name, status: 'clear', willPlay: true, adjust: 1.1,
              confidence: 'high', reason: 'Cleared Friday.' }] });
ok(W.Handoff.importReply(bare, { week: WEEK }).applied === 1,
   'a bare .json file imports');

var chatty = 'Here is the file you asked for.\n\nI checked all of them and found ' +
  'one note worth flagging {see below}.\n\n```json\n' + bare + '\n```\n\n' +
  'Let me know if you want more detail.';
ok(W.Handoff.importReply(chatty, { week: WEEK }).applied === 1,
   'a whole chat message pasted in, prose and stray braces and all, imports');

/* no "kind" at all — a model that rewrote the skeleton by hand */
var noKind = JSON.stringify({ players: [{ name: second.name, adjust: 1.0,
  status: 'clear', confidence: 'low', reason: 'x' }] });
ok(W.Handoff.importReply(noKind, { week: WEEK }).applied === 1,
   'a reply with no "kind" field is still recognised by its shape');

/* ---- 5. refusals: it must never half-apply ------------------------------- */
console.log('\n-- refusals --');

/* THE BUG TJ ACTUALLY HIT (2026-09-17): the Rosters tab showed his own
 * app's literal template text back at him — "Rank 1 of 10. <a few honest
 * sentences: where this team really stands and why>" — because
 * jsonOf/parseAnswer takes the WIDEST valid JSON object in whatever text it
 * is handed, and the unfilled skeleton embedded in "## The file to give
 * back" is a bigger, equally shape-valid object than a short real answer.
 * Feeding an export straight back into importReply (the exact shape of
 * pasting the file MADE FOR Claude instead of what Claude sent BACK)
 * reproduces it for every one of the three kinds, not just team analysis —
 * this bug predates the feature Tj was reporting it on. */
console.log('\n-- the unfilled-template bug Tj actually hit --');
/* the advice skeleton, hand-built rather than parsed out of the exported
   text: that export's own "machine-readable copy of this request" block
   (real player names, no placeholders) happens to be textually WIDER than
   the one-example advice skeleton, so jsonOf's widest-span-first scan picks
   THAT block instead when fed the whole file — a different, already-safe
   refusal ("no entry had a name"), not a silent misimport either way, but
   not this specific defence. This tests the skeleton shape directly, the
   same way it genuinely arrives when Claude's own reply echoes it. */
throws(function () {
  W.Handoff.importReply(JSON.stringify({
    kind: 'fftracker.advice.reply', format: 1, week: WEEK, season: 2026,
    players: [{ name: '<copy the name EXACTLY as it appears in the roster table>',
      status: 'clear | questionable | limited | out', willPlay: true, adjust: 1.0,
      confidence: 'high | medium | low',
      reason: '<what you found, with the outlet named and the date>' }],
    summary: '<two sentences on the lineup as a whole>'
  }), { week: WEEK });
}, /still has the template's own placeholder text/,
   'the ADVICE skeleton, unfilled, is refused rather than silently accepted');
throws(function () {
  var wexp = W.Handoff.buildWaivers(WEEK, me, null, 2026, '2026-09-07');
  var wc = W.Value.waiverContext(WEEK, me, null, 2026, '2026-09-07');
  W.Handoff.importReply(wexp.text, { week: WEEK, pool: wc.pool,
    dropCandidates: wc.dropCandidates, kdefNeed: wc.kdefNeed, injuries: wc.injuries });
}, /still has the template's own placeholder text/,
   'same for the WAIVERS export  <-- reproduced exactly as Tj described it, just a ' +
   'different tab');
throws(function () {
  var texp = W.Handoff.buildTeamAnalysis(WEEK, me, null, 2026, '2026-09-07');
  var tctx0 = W.TeamReport.context(WEEK, me, null, 2026, '2026-09-07');
  W.Handoff.importReply(texp.text, { week: WEEK, ctx: tctx0 });
}, /still has the template's own placeholder text/,
   'same for the TEAM ANALYSIS export  <-- the exact screen Tj screenshotted');
/* a placeholder nested inside an array element, not just a top-level field */
throws(function () {
  W.Handoff.importReply(JSON.stringify({ overall: { verdict: 'a real verdict here' },
    recommendations: [{ action: '<one short imperative sentence>', why: 'x' }] }),
    { week: WEEK, ctx: W.TeamReport.context(WEEK, me, null, 2026, '2026-09-07') });
}, /still has the template's own placeholder text/,
   'a placeholder nested inside an array element is caught too, not just a top-level field');
/* a legitimate reply must never be mistaken for the template */
(function () {
  var legit = JSON.stringify({ overall: { rank: 2, of: 10, verdict: 'A real, honest verdict.' },
    recommendations: [{ type: 'lineup', action: 'Start the flex play this week.', why: 'Real reasoning.' }],
    summary: 'Real summary.' });
  var r = W.Handoff.importReply(legit, { week: WEEK,
    ctx: W.TeamReport.context(WEEK, me, null, 2026, '2026-09-07') });
  ok(r.kind === 'teamanalysis' && r.applied === 1,
     'a genuinely real reply — no angle-bracket-wrapped field anywhere — still imports fine');
}());

throws(function () { W.Handoff.importReply('', { week: WEEK }); },
       /empty/i, 'an empty file is refused');
throws(function () { W.Handoff.importReply('just some notes I wrote', { week: WEEK }); },
       /does not look like a reply/i, 'prose with no JSON is refused');
throws(function () { W.Handoff.importReply('{"totally":"different"}', { week: WEEK }); },
       /not a reply this app understands/i,
       'JSON of an unrelated shape is refused, and says what it needed');

/* the dangerous one: right shape, WRONG WEEK. It parses and would apply. */
var lastWeek = JSON.stringify({ kind: 'fftracker.advice.reply', week: WEEK + 3,
  players: [{ name: second.name, adjust: 0.1, status: 'out', willPlay: false,
              confidence: 'high', reason: 'stale' }] });
throws(function () { W.Handoff.importReply(lastWeek, { week: WEEK }); },
       /for week \d+, but the app is on week/,
       'a reply for a DIFFERENT week is refused  <-- it would parse and be silently wrong');
(function () {
  var v = W.Recommend.aiCache().byName[W.Names.canon(second.name)];
  ok(v && v.adjust !== 0.1 && v.status !== 'out',
     'and the refused reply changed nothing — no half-application');
}());

throws(function () {
  W.Handoff.importReply('{"kind":"fftracker.advice.reply","week":' + WEEK + ',"players":[]}',
                        { week: WEEK });
}, /no entry in it had a name/, 'an empty players list is refused rather than wiping the cache');

/* a STRING has a .length, so a truthy-length check would accept this and then
   apply nothing at all — worse than refusing, because it looks like it worked */
throws(function () {
  W.Handoff.importReply('{"players":"none found this week"}', { week: WEEK });
}, /not a reply this app understands/,
   '"players" as a string is refused, not treated as an empty list');

/* filed under an undefined week, a verdict is stored and then never shown,
   because the UI only displays a summary whose week matches the screen */
throws(function () {
  W.Handoff.importReply('{"players":[{"name":"x","adjust":1}]}', {});
}, /does not say which week/,
   'a reply with no week, imported with no week, is refused rather than filed nowhere');

/* ---- 6. names: the Kenny/Kenneth problem, in the reply ------------------- */
console.log('\n-- identity --');
(function () {
  /* a model will write the name it found in the news, not the one in the app */
  var t = W.Store.team(me), target = null, i;
  for (i = 0; i < t.players.length; i++) {
    if (/^Kenneth |^Kenny /.test(t.players[i].name)) target = t.players[i];
  }
  if (!target) { console.log('  --   no nickname case on this roster, skipped'); return; }
  var other = /^Kenneth /.test(target.name)
            ? target.name.replace(/^Kenneth /, 'Kenny ')
            : target.name.replace(/^Kenny /, 'Kenneth ');
  ok(other !== target.name, 'the test really is using the OTHER spelling (' + other + ')');
  var rr = JSON.stringify({ kind: 'fftracker.advice.reply', week: WEEK,
    players: [{ name: other, status: 'clear', willPlay: true, adjust: 1.23,
                confidence: 'high', reason: 'via the other spelling' }] });
  W.Handoff.importReply(rr, { week: WEEK });
  var v = W.Recommend.aiCache().byName[W.Names.canon(target.name)];
  ok(v && v.adjust === 1.23,
     'a verdict written as "' + other + '" lands on "' + target.name + '"');
}());

/* ---- 7. the waiver round trip -------------------------------------------- */
console.log('\n-- the waiver loop --');
(function () {
  var wctx = W.Value.waiverContext(WEEK, me, null, 2026, '2026-09-07');
  var pk = Object.keys(wctx.pool).filter(function (k) { return wctx.pool[k].length; });
  ok(pk.length > 0, 'there is a pool to answer about');
  /* RB/WR specifically, not QB — this test is about the generic offline
     round-trip plumbing (verified/proj/priority/recentStat/dropCandidate),
     not position-specific gating, and 2026-09-18 gave a QB free agent a
     real-measured-production bar this synthetic pool entry has no reason
     to clear (see test_waiver.js's own suite for QB-specific coverage). */
  var realPos = ['RB', 'WR'].concat(pk).filter(function (p) { return pk.indexOf(p) >= 0; })[0];
  var real = wctx.pool[realPos][0];
  /* a real, position-matched drop candidate and a real roster injury, when
     this seed roster happens to have one — proves the new fields survive the
     OFFLINE round trip exactly as they do the live API one */
  var dropList = wctx.dropCandidates[real.pos] || [];
  var dropName = dropList.length ? dropList[0].name : '';
  var injName = wctx.injuries.length ? wctx.injuries[0].name : '';

  var replyObj = {
    kind: 'fftracker.waivers.reply', format: 1, week: WEEK, season: 2026,
    adds: [
      { name: real.name, pos: real.pos, nfl: real.nfl, rank: 1,
        overStarter: '', priority: 'season', recentStat: '3 rec, 34 yds (Wk 2)',
        dropCandidate: dropName, confidence: 'high',
        why: 'Took every first-team rep Wednesday (NFL.com, 2026-09-06).' },
      { name: 'Nobody Whoisnotreal', pos: 'RB', nfl: 'CHI', rank: 2,
        overStarter: '', confidence: 'low', why: 'A name the app has never heard of.' }
    ],
    injuries: injName
      ? [{ name: injName, extent: 'test extent', timeline: 'test timeline (2026-09-06)',
           replace: true }]
      : [],
    needs: 'Thin at running back.', summary: 'Claim the first one.'
  };
  var wreply = '```json\n' + JSON.stringify(replyObj, null, 2) + '\n```';
  var r = W.Handoff.importReply(wreply, { week: WEEK, pool: wctx.pool,
    dropCandidates: wctx.dropCandidates, kdefNeed: wctx.kdefNeed, injuries: wctx.injuries });
  ok(r.kind === 'waivers', 'a waiver reply is recognised as waivers');
  ok(r.applied === 2, 'both adds were applied');
  ok(r.unverified === 1,
     'the player who was NOT in the pool we sent is counted as unverified  <-- the safety property');
  ok(r.result.adds[0].verified === true && r.result.adds[1].verified === false,
     'and the flag is per-player, so the UI can withhold the Add button');
  ok(r.result.adds[0].proj !== null,
     'a verified add carries the app\'s own projection, not the model\'s guess');
  ok(r.result.adds[0].priority === 'season', 'priority survives the offline round trip too');
  ok(r.result.adds[0].recentStat === '3 rec, 34 yds (Wk 2)',
     'recentStat survives the offline round trip too');
  if (dropName) {
    ok(r.result.adds[0].dropCandidate === dropName,
       'a valid same-position dropCandidate survives the offline round trip too');
  }
  if (injName) {
    ok(r.result.injuries.length === 1 && r.result.injuries[0].name === injName,
       'Claude\'s season-outlook read on a real roster injury survives the offline round trip too');
  }
  var back = W.Value.waiverLoad();
  ok(back && back.adds && back.adds.length === 2,
     'the wire result is in the app\'s own cache, where the Rosters tab reads it');
  ok(back.model === 'Claude app (handoff)', 'and it says it came from the handoff');
}());

/* ---- 7c. the team analysis round trip (2026-09-17b) ---------------------- */
console.log('\n-- the team analysis loop --');
(function () {
  /* a FRESH context, not the one the export built — same reasoning as the
     waiver pool rebuild above: a player traded or signed since the export
     must not read as still-verified */
  var tctx = W.TeamReport.context(WEEK, me, null, 2026, '2026-09-07');
  var otherTeam = tctx.rosters.filter(function (r) { return !r.mine; })[0];
  var otherPlayer = otherTeam.players[0];
  var myPlayer = tctx.rosters.filter(function (r) { return r.mine; })[0].players[0];

  var replyObj = {
    kind: 'fftracker.teamanalysis.reply', format: 1, week: WEEK, season: 2026,
    overall: { rank: 3, of: tctx.rosters.length, verdict: 'Solid, thin at one spot.' },
    teamComparisons: [
      { team: otherTeam.name, note: 'They have the deeper bench.' },
      { team: 'Team That Does Not Exist', note: 'should be dropped' }
    ],
    strengths: ['Quarterback play'], weaknesses: ['Depth at one position'],
    recommendations: [
      { type: 'trade', action: 'Trade for ' + otherPlayer.name, targetPlayer: otherPlayer.name,
        fromTeam: otherTeam.name, giveUp: myPlayer.name, why: 'a fair depth swap' },
      { type: 'trade', action: 'An invented deal', targetPlayer: 'Nobody Real',
        fromTeam: 'Nowhere', why: 'should end up unverified' }
    ],
    summary: 'Make the trade first.'
  };
  var treply = '```json\n' + JSON.stringify(replyObj, null, 2) + '\n```';
  var tr = W.Handoff.importReply(treply, { week: WEEK, ctx: tctx });
  ok(tr.kind === 'teamanalysis', 'a team-analysis reply is recognised as teamanalysis');
  ok(tr.applied === 2, 'both recommendations were applied (' + tr.applied + ')');
  ok(tr.unverified === 1,
     'the recommendation naming an invented player is counted as unverified');
  ok(tr.result.overall.rank === 3 && tr.result.overall.of === tctx.rosters.length,
     'the overall rank/of survive the round trip');
  ok(tr.result.teamComparisons.length === 1 && tr.result.teamComparisons[0].team === otherTeam.name,
     'the invented team comparison is dropped; the real one survives  <-- the closed-set safety property');
  ok(tr.result.recommendations[0].fromTeam === otherTeam.name,
     'a real trade partner team name survives the round trip');
  ok(tr.result.recommendations[0].giveUp === myPlayer.name,
     'giveUp naming a player genuinely on my own roster survives');
  ok(tr.result.recommendations[1].fromTeam === '',
     'an invented fromTeam is blanked, not shown as if real');

  var tback = W.TeamReport.load();
  ok(tback && tback.overall && tback.overall.rank === 3,
     'the team-analysis result is in its own cache, where the Rosters tab reads it');
  ok(tback.model === 'Claude app (handoff)', 'and it says it came from the handoff');
  ok(tback.week === WEEK, 'it is filed against the right week');

  /* the same refusal properties advice/waivers already get */
  throws(function () {
    W.Handoff.importReply(
      '{"kind":"fftracker.teamanalysis.reply","week":' + (WEEK + 3) + ',"overall":{"verdict":"stale"}}',
      { week: WEEK, ctx: tctx });
  }, /for week \d+, but the app is on week/,
     'a team-analysis reply for a DIFFERENT week is refused, same as advice/waivers');
  throws(function () {
    W.Handoff.importReply('{"kind":"fftracker.teamanalysis.reply","week":' + WEEK + ',"overall":{}}',
      { week: WEEK, ctx: tctx });
  }, /no verdict, no recommendations and no summary/,
     'a reply with nothing usable at all is refused rather than filed as an empty report');
  throws(function () {
    W.Handoff.importReply('{"kind":"fftracker.teamanalysis.reply","week":' + WEEK + ',"overall":{"verdict":"x"}}',
      { week: WEEK });
  }, /no league context to check this reply against/,
     'importing without a fresh ctx to verify against is refused, not silently trusted');

  /* no "kind" at all, shape fallback via "overall" */
  var noKindTA = JSON.stringify({ overall: { verdict: 'shape fallback works' } });
  var trNoKind = W.Handoff.importReply(noKindTA, { week: WEEK, ctx: tctx });
  ok(trNoKind.kind === 'teamanalysis',
     'a reply with no "kind" field is still recognised by its "overall" shape');
}());

/* ---- 7b. detect() matches exactly, not by prefix (2026-09-15e sweep) -----
 * Used to be k.indexOf(KIND_ADVICE) === 0 — a prefix match that would accept
 * anything merely STARTING WITH "fftracker.advice", including a plausible
 * model typo or hallucinated variant, directly contradicting this function's
 * own "must never be half-applied" comment. Tightened to exact-match the two
 * real literal kinds this app ever emits (the request's own kind, and the
 * reply skeleton's kind + '.reply'). */
(function () {
  var H = W.Handoff;
  ok(H.detect({ kind: H.KIND_ADVICE, players: [] }) === 'advice',
     'the plain request-echo kind is still recognised as advice');
  ok(H.detect({ kind: H.KIND_ADVICE + '.reply', players: [] }) === 'advice',
     'the .reply skeleton kind is still recognised as advice');
  ok(H.detect({ kind: H.KIND_WAIVER, adds: [] }) === 'waivers',
     'the plain request-echo kind is still recognised as waivers');
  ok(H.detect({ kind: H.KIND_WAIVER + '.reply', adds: [] }) === 'waivers',
     'the .reply skeleton kind is still recognised as waivers');
  ok(H.detect({ kind: H.KIND_TEAM, overall: {} }) === 'teamanalysis',
     'the plain request-echo kind is still recognised as teamanalysis');
  ok(H.detect({ kind: H.KIND_TEAM + '.reply', overall: {} }) === 'teamanalysis',
     'the .reply skeleton kind is still recognised as teamanalysis');
  /* no `players`/`adds` array here on purpose — detect() falls back to
     shape when the kind does not match anything real (see its own comment),
     so including one would pass via that fallback regardless of the kind
     check this is actually testing. */
  ok(H.detect({ kind: H.KIND_ADVICE + '-final' }) === '',
     'a kind that merely STARTS WITH the real one, but is not it, is no longer accepted');
  ok(H.detect({ kind: H.KIND_ADVICE + 'x' }) === '',
     'same for a trailing-character typo on the request kind');
  ok(H.detect({ kind: H.KIND_TEAM + '-final' }) === '',
     'same prefix-typo protection for the new teamanalysis kind');
  ok(H.detect({ overall: [1, 2, 3] }) === '',
     '"overall" as an ARRAY (not the reply\'s object shape) does not fall back to teamanalysis');
}());

/* ---- 8. no drift: the handoff must not re-implement the API path --------- */
console.log('\n-- one implementation, not two --');
(function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'app/assets/handoff.js'), 'utf8');
  var code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  ok(/Ai\.normalizeAdvice/.test(code) && /Ai\.normalizeWaivers/.test(code),
     'the importer uses ai.js\'s normalisers rather than its own');
  ok(/Ai\.normalizeInjuries/.test(code) && /Ai\.dropCandidateIndex/.test(code),
     'and the two new v5.5 normalisers — the injury outlook and the drop-candidate ' +
     'position guard are not reimplemented here either');
  ok(/Ai\.normalizeTeamAnalysis/.test(code),
     'the new team-analysis kind is normalised by ai.js too, not reimplemented here');
  ok(/Ai\.parseAnswer/.test(code), 'and ai.js\'s tolerant JSON finder');
  ok(/Recommend\.mergeAi/.test(code) && /Value\.waiverSave/.test(code),
     'and the same storage path a live sync uses');
  ok(/TeamReport\.context/.test(code) && /TeamReport\.save/.test(code),
     'and the team-analysis context/storage come from teamreport.js, not built here');
  ok(!/JSON\.parse\s*\(\s*raw/.test(code),
     'it does not parse the reply itself — that would be a second implementation to drift');
  ok(!/canon\s*\(/.test(code) || /Names\.canon/.test(code),
     'it does not roll its own name folding');
}());

console.log(fails ? ('\n  ' + fails + ' handoff check(s) FAILED') : '\n  handoff checks pass');
process.exit(fails ? 1 : 0);
