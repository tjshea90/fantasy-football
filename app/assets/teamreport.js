/* teamreport.js — cross-league context for "how does my team stack up".
 * ES2018 only (no ?. no ?? no .at()).
 *
 * Tj, 2026-09-17b: "ask Claude its overall take on my team versus every
 * other team in the league and recommendations on how to improve my team."
 * That is a genuinely new SUBJECT — a season-long verdict against the whole
 * league, not a per-player one — but not a new kind of DATA. Everything a
 * prompt for it needs already exists somewhere else in this app:
 *
 *   - my own starters/bench/needs/pool/dropCandidates/injuries — exactly
 *     what Value.waiverContext already builds for the Wire tab
 *   - a rest-of-season per-game price for any named player — Value.perGame,
 *     the same function the free-agent board is priced with
 *   - who is hurt right now — Recommend.health, the same injury-feed lookup
 *     the Rosters/Live/Advice tabs already tag every player with
 *   - who is winning and by how much — Store.standings, the League tab's
 *     own numbers
 *
 * This file's only job is putting those side by side into one object, the
 * same way recommend.js's rosterContext() and value.js's waiverContext()
 * assemble their own domains for a prompt. No new scoring math lives here —
 * a second implementation of "what is this player worth" would drift from
 * the real one the first time either changed, silently, on whichever path
 * nobody was looking at.
 */
(function (root) {
  'use strict';

  function r1(x) { return Math.round(x * 10) / 10; }

  function rosterRow(p, week) {
    var pg = root.Value.perGame(p.name, p.pos, week);
    var h = root.Recommend.health(p);
    var onBye = Number(p.bye) === Number(week);
    return {
      name: p.name, pos: p.pos, nfl: p.nfl || '',
      ros: onBye ? 0 : r1(pg.v),
      onBye: onBye,
      health: h.label || ''
    };
  }

  var POS_ORDER = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };
  function teamRoster(t, week) {
    return t.players.slice().sort(function (a, b) {
      if (POS_ORDER[a.pos] !== POS_ORDER[b.pos]) return POS_ORDER[a.pos] - POS_ORDER[b.pos];
      return a.name.localeCompare(b.name);
    }).map(function (p) { return rosterRow(p, week); });
  }

  /* week, teamId, opponents, season, today — the same parameter shape
   * Value.waiverContext already takes, so a caller building one can build
   * the other with the same arguments in hand. */
  function context(week, teamId, opponents, season, today) {
    var S2 = root.Store.get();
    var wc = root.Value.waiverContext(week, teamId, opponents, season, today);
    var st = root.Store.standings();
    var byId = {}, i;
    for (i = 0; i < st.byRecord.length; i++) byId[st.byRecord[i].id] = st.byRecord[i];
    var me = root.Store.team(teamId);
    var rosters = S2.teams.map(function (t) {
      var row = byId[t.id];
      return {
        id: t.id, name: t.name, mine: t.id === teamId,
        w: row ? row.w : 0, l: row ? row.l : 0, t: row ? row.t : 0,
        pts: row ? row.pts : 0,
        rankWL: row ? row.rankWL : 0, rankPts: row ? row.rankPts : 0,
        players: teamRoster(t, week)
      };
    });
    rosters.sort(function (a, b) { return (a.rankWL || 99) - (b.rankWL || 99); });
    return {
      week: week, season: season || S2.settings.season,
      today: today || new Date().toISOString().slice(0, 10),
      teamName: me ? me.name : '',
      standingsWL: st.byRecord, standingsPts: st.byPoints,
      rosters: rosters,
      starters: wc.starters, bench: wc.bench, needs: wc.needs,
      pool: wc.pool, dropCandidates: wc.dropCandidates, injuries: wc.injuries
    };
  }

  /* ---- the saved report — same load/save shape as Value.waiverLoad/Save,
   * its own key so it neither grows the main state blob (see store.js's own
   * "the archive" comment on why that matters) nor collides with the
   * advice/waiver caches this is deliberately NOT one of. This is a report:
   * nothing here mutates a lineup or a roster, so there is no "apply" step
   * to gate on a matching week the way importReply's advice/waiver branches
   * do — it is shown as-is, with its own week/date so a stale one is
   * visibly stale rather than silently wrong. */
  var TAKEY = 'fftracker_teamanalysis_v1';
  function load() {
    try {
      var s = (root.Native && root.Native.load) ? root.Native.load(TAKEY)
              : (root.localStorage ? root.localStorage.getItem(TAKEY) : null);
      if (s) { var o = JSON.parse(s); if (o && o.overall) return o; }
    } catch (e) { /* the cache is optional */ }
    return null;
  }
  function save(v) {
    try {
      var s = JSON.stringify(v);
      if (root.Native && root.Native.save) root.Native.save(TAKEY, s);
      else if (root.localStorage) root.localStorage.setItem(TAKEY, s);
    } catch (e) { /* the cache is optional */ }
  }

  root.TeamReport = { context: context, load: load, save: save };
})(typeof window !== 'undefined' ? window : this);
