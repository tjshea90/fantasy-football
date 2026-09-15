/* stats.js — the Stats tab: search any player, browse a team's box score,
 * top players for the week. ES2018 only (no ?. no ?? no .at()).
 *
 * Follows the same render(host, ctx) delegation ui.js already uses for
 * Advice (see recommend.js) — this module owns its own UI state and reads
 * Gamelog/PlayerDB/Scoring directly; ctx only carries the DOM/UI helpers
 * (el, table, fmt, modal, toast, rerender) that ui.js already has.
 *
 * ALSO the target of long-press "View stats" anywhere else in the app
 * (ui.js wires that) — openPlayerModal() is the one code path both the
 * Stats tab's own search and every long-press menu use, so "just like in
 * the stats tab" (Tj's words) is true by construction, not by keeping two
 * renderers in sync by hand.
 */
(function (root) {
  'use strict';

  var mode = 'search';          /* 'search' | 'team' | 'top' */
  var searchQ = '', searchPos = 'ANY';
  var selPlayer = null;         /* {name, pos, nfl} */
  var playerLog = { key: '', loading: false, data: null, error: '' };
  var selTeamAbbr = null, selTeamWeek = null;
  var teamState = { key: '', loading: false, data: null, error: '' };
  var topState = { key: '', loading: false, data: null, error: '' };
  var _ctx = null;   /* last render's ctx, so refresh() (called from outside a render) still works */

  function n(v) { return (v === undefined || v === null) ? 0 : v; }
  function fgStr(l) {
    var fg = (l.kick && l.kick.fg) || [], made = 0, i;
    for (i = 0; i < fg.length; i++) if (fg[i].made) made++;
    return made + '/' + fg.length;
  }
  var POS_COLS = {
    QB: [['Cmp', function (l) { return n(l.pass.cmp); }],
         ['Yds', function (l) { return n(l.pass.yds); }],
         ['TD', function (l) { return n(l.pass.td); }],
         ['INT', function (l) { return n(l.pass.int); }],
         ['RuYd', function (l) { return n(l.rush.yds); }],
         ['RuTD', function (l) { return n(l.rush.td); }]],
    RB: [['RuYd', function (l) { return n(l.rush.yds); }],
         ['RuTD', function (l) { return n(l.rush.td); }],
         ['Rec', function (l) { return n(l.rec.rec); }],
         ['RcYd', function (l) { return n(l.rec.yds); }],
         ['RcTD', function (l) { return n(l.rec.td); }]],
    WR: [['Rec', function (l) { return n(l.rec.rec); }],
         ['RcYd', function (l) { return n(l.rec.yds); }],
         ['RcTD', function (l) { return n(l.rec.td); }],
         ['RuYd', function (l) { return n(l.rush.yds); }]],
    K:  [['FG', fgStr],
         ['XP', function (l) { return n(l.kick.xpMade) + '/' + n(l.kick.xpAtt); }]],
    DEF: [['Sack', function (l) { return n(l.dst.sacks); }],
          ['INT', function (l) { return n(l.dst.int); }],
          ['FR', function (l) { return n(l.dst.fr); }],
          ['TD', function (l) { return n(l.dst.defTD) + n(l.dst.retTD); }],
          ['Saf', function (l) { return n(l.dst.safety); }],
          ['PA', function (l) { return (l.dst.pointsAllowed === null || l.dst.pointsAllowed === undefined) ? '-' : n(l.dst.pointsAllowed); }]]
  };
  POS_COLS.TE = POS_COLS.WR;
  function colsFor(pos) { return POS_COLS[pos] || POS_COLS.WR; }

  /* one row per GAME, most recent first — Wk / Opp / this position's stat
   * columns / Pts. Used for both a single player's season log and (with one
   * row) a team roster's per-player line. */
  function gameLogTable(ctx, pos, rows) {
    var cols = colsFor(pos);
    var head = ['Wk', 'Opp'].concat(cols.map(function (c) { return c[0]; })).concat(['Pts']);
    var trows = rows.map(function (r) {
      var cells = [String(r.week), (r.home ? 'vs ' : '@ ') + (r.opp || '?') +
                   (r.state === 'in' ? ' (live)' : '')];
      cols.forEach(function (c) { cells.push(String(c[1](r.line))); });
      cells.push(ctx.fmt(r.pts));
      return { cells: cells };
    });
    var wrap = ctx.el('div', 'twrap');
    wrap.appendChild(ctx.table(head, trows));
    return wrap;
  }

  /* ---- the one shared "here is this player's stats" view -----------------
   * player: {name, pos, nfl}. Used by the Stats tab's own search AND every
   * long-press "View stats" menu elsewhere in the app. */
  function playerDetail(ctx, player, state, host) {
    host.appendChild(ctx.el('h2', null, player.name + '  ·  ' + player.pos + ' ' + (player.nfl || '')));
    if (state.loading) { host.appendChild(ctx.el('p', 'muted', 'Loading this season’s games…')); return; }
    if (state.error) {
      host.appendChild(ctx.el('p', 'warnText', 'Could not load: ' + state.error));
      return;
    }
    var rows = state.data || [];
    if (!rows.length) {
      host.appendChild(ctx.el('p', 'muted', 'No games with a stat line yet this season.'));
      return;
    }
    host.appendChild(gameLogTable(ctx, player.pos, rows));
    host.appendChild(ctx.el('p', 'hint',
      'Fantasy points are this league’s scoring only — not any other site’s projection or total.'));
  }

  function loadPlayerLog(ctx, player, force) {
    var key = player.pos + ':' + player.nfl + ':' + player.name;
    if (!force && playerLog.key === key && (playerLog.loading || playerLog.data || playerLog.error)) {
      return Promise.resolve();
    }
    playerLog = { key: key, loading: true, data: null, error: '' };
    var entry = { n: player.name, p: player.pos, t: player.nfl };
    var through = (root.Store && root.Store.get()) ? root.Store.get().settings.currentWeek : 1;
    return root.Gamelog.playerLog(entry, through, { force: !!force }).then(function (rows) {
      playerLog = { key: key, loading: false, data: rows, error: '' };
      ctx.rerender();
    }, function (e) {
      playerLog = { key: key, loading: false, data: null, error: (e && e.message) ? e.message : String(e) };
      ctx.rerender();
    });
  }

  /* Opens the same detail as the Stats tab's search, in a modal — the one
   * entry point long-press menus everywhere else in the app call. */
  function openPlayerModal(ctx, player) {
    selPlayer = player;
    var body = ctx.el('div');
    playerDetail(ctx, player, playerLog, body);
    var close = ctx.modal(player.name + ' — game log', null, body);
    loadPlayerLog(ctx, player).then(function () {
      /* the tab's own render() already repaints via ctx.rerender(); a modal
         opened from elsewhere needs its OWN body refreshed in place */
      body.innerHTML = '';
      playerDetail(ctx, player, playerLog, body);
    });
    return close;
  }

  /* ---- search mode --------------------------------------------------------
   * Same database and the same ranked search as everywhere else a player is
   * looked up in this app (PlayerDB.search) — not a second implementation. */
  function searchCard(ctx) {
    var c = ctx.el('div', 'card');
    c.appendChild(ctx.el('h2', null, 'Search any NFL player'));

    var posSel = ctx.el('select');
    posSel.appendChild(new Option('Any position', 'ANY'));
    ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].forEach(function (p) { posSel.appendChild(new Option(p, p)); });
    posSel.value = searchPos;

    var q = ctx.el('input'); q.type = 'text';
    q.setAttribute('autocomplete', 'off'); q.setAttribute('autocorrect', 'off');
    q.setAttribute('autocapitalize', 'none'); q.setAttribute('spellcheck', 'false');
    q.placeholder = 'Type a name or team — e.g. achane, kupp, chiefs';
    q.value = searchQ;

    var results = ctx.el('div');
    var hint = ctx.el('p', 'hint', '');

    function runSearch() {
      results.innerHTML = '';
      if (!searchQ.trim()) { hint.textContent = ''; return; }
      var hits = root.PlayerDB.search(searchQ, searchPos, 20);
      hint.textContent = hits.length ? (hits.length + ' match' + (hits.length === 1 ? '' : 'es')) : 'No match.';
      hits.forEach(function (p) {
        var row = ctx.el('div', 'res');
        row.appendChild(ctx.el('div', 'pos', p.p));
        var nm = ctx.el('div', 'nm');
        nm.appendChild(document.createTextNode(p.n));
        nm.appendChild(ctx.el('small', null, '  ' + (p.t || '?')));
        row.appendChild(nm);
        row.appendChild(ctx.el('div', 'add', '›'));
        row.addEventListener('click', function () {
          selPlayer = { name: p.n, pos: p.p, nfl: p.t };
          loadPlayerLog(ctx, selPlayer);
          ctx.rerender();
        });
        results.appendChild(row);
      });
    }
    q.addEventListener('input', function () { searchQ = q.value; runSearch(); });
    posSel.addEventListener('change', function () { searchPos = posSel.value; runSearch(); });
    runSearch();

    c.appendChild(ctx.el('label', 'f', 'Position')); c.appendChild(posSel);
    c.appendChild(ctx.el('label', 'f', 'Search')); c.appendChild(q);
    c.appendChild(hint);
    c.appendChild(results);
    return c;
  }

  function selectedPlayerCard(ctx) {
    var c = ctx.el('div', 'card');
    playerDetail(ctx, selPlayer, playerLog, c);
    return c;
  }

  /* ---- team mode -----------------------------------------------------------
   * "pick an NFL team and show me the full stats line for every player on
   * that team that played... sort by position... last game, with a drop
   * down... to view older games too." */
  function defTeamName(abbr) {
    var d = root.PlayerDB.get(), i;
    for (i = 0; i < d.players.length; i++) {
      if (d.players[i].p === 'DEF' && d.players[i].t === abbr) return d.players[i].n;
    }
    return abbr;
  }
  function loadTeamRoster(ctx, abbr, week, force) {
    var key = abbr + ':' + week;
    if (!force && teamState.key === key && (teamState.loading || teamState.data || teamState.error)) {
      return Promise.resolve();
    }
    teamState = { key: key, loading: true, data: null, error: '' };
    return root.Gamelog.teamRoster(abbr, week, { force: !!force }).then(function (r) {
      teamState = { key: key, loading: false, data: r, error: '' };
      ctx.rerender();
    }, function (e) {
      teamState = { key: key, loading: false, data: null, error: (e && e.message) ? e.message : String(e) };
      ctx.rerender();
    });
  }
  function teamPickerCard(ctx) {
    var c = ctx.el('div', 'card');
    c.appendChild(ctx.el('h2', null, 'Browse by team'));
    var chips = ctx.el('div', 'fchips');
    root.PlayerDB.TEAMS.forEach(function (ab) {
      var on = ab === selTeamAbbr;
      var b = ctx.el('button', 'fchip' + (on ? ' on' : ''), ab);
      b.addEventListener('click', function () {
        selTeamAbbr = ab; selTeamWeek = null;
        var through = root.Store.get().settings.currentWeek;
        var weeks = root.Gamelog.playedWeeks(ab, through);
        var target = weeks.length ? weeks[0] : through;
        loadTeamRoster(ctx, ab, target);
        ctx.rerender();
      });
      chips.appendChild(b);
    });
    c.appendChild(chips);
    return c;
  }
  function teamRosterCard(ctx) {
    var c = ctx.el('div', 'card');
    var through = root.Store.get().settings.currentWeek;
    var weeks = root.Gamelog.playedWeeks(selTeamAbbr, through);
    if (selTeamWeek === null) selTeamWeek = weeks.length ? weeks[0] : through;

    var head = ctx.el('div', 'hrow');
    head.appendChild(ctx.el('h2', null, defTeamName(selTeamAbbr)));
    if (weeks.length > 1) {
      var wsel = ctx.el('select');
      weeks.forEach(function (w) {
        var o = new Option('Week ' + w, String(w));
        if (w === selTeamWeek) o.selected = true;
        wsel.appendChild(o);
      });
      wsel.addEventListener('change', function () {
        selTeamWeek = Number(wsel.value);
        loadTeamRoster(ctx, selTeamAbbr, selTeamWeek);
        ctx.rerender();
      });
      head.appendChild(wsel);
    }
    c.appendChild(head);

    if (teamState.loading) { c.appendChild(ctx.el('p', 'muted', 'Loading week ' + selTeamWeek + '…')); return c; }
    if (teamState.error) { c.appendChild(ctx.el('p', 'warnText', 'Could not load: ' + teamState.error)); return c; }
    var r = teamState.data;
    if (!r) { c.appendChild(ctx.el('p', 'muted', 'This team has not played yet this week.')); return c; }

    c.appendChild(ctx.el('p', 'muted', (r.home ? 'vs ' : '@ ') + r.opp + '  ·  ' +
      r.teamScore + '-' + r.oppScore + (r.state === 'post' ? ' final' : r.state === 'in' ? ' (live)' : '')));

    var order = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4 };
    var byPos = {};
    r.rows.forEach(function (row) {
      var p = order[row.pos] !== undefined ? row.pos : 'OTHER';
      if (!byPos[p]) byPos[p] = [];
      byPos[p].push(row);
    });
    Object.keys(order).sort(function (a, b) { return order[a] - order[b]; }).forEach(function (pos) {
      if (!byPos[pos] || !byPos[pos].length) return;
      c.appendChild(ctx.el('h3', null, pos));
      c.appendChild(gameLogTable(ctx, pos, byPos[pos].map(function (row) {
        return { week: selTeamWeek, opp: r.opp, home: r.home, state: r.state, line: row.line, pts: row.pts };
      })));
    });
    if (r.dst) {
      c.appendChild(ctx.el('h3', null, 'DEF'));
      c.appendChild(gameLogTable(ctx, 'DEF', [{ week: selTeamWeek, opp: r.opp, home: r.home, state: r.state, line: r.dst.line, pts: r.dst.pts }]));
    }
    return c;
  }

  /* ---- top players mode -----------------------------------------------------
   * "top 10 highest fantasy points scored by position, including team
   * defenses, for the current (or just finished) NFL week." */
  var TOP_POS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  function loadTop(ctx, week, force) {
    var key = String(week);
    if (!force && topState.key === key && (topState.loading || topState.data || topState.error)) {
      return Promise.resolve();
    }
    topState = { key: key, loading: true, data: null, error: '' };
    return root.Gamelog.weekPositionTops(week, { force: !!force }).then(function (t) {
      topState = { key: key, loading: false, data: t, error: '' };
      ctx.rerender();
    }, function (e) {
      topState = { key: key, loading: false, data: null, error: (e && e.message) ? e.message : String(e) };
      ctx.rerender();
    });
  }
  function topCard(ctx) {
    var c = ctx.el('div', 'card');
    /* Tj: "it won't load week 1 for the top players at all even though I
     * have week 1 selected" — this used to remember whatever week it FIRST
     * rendered with (topWeek, set once) rather than following the app's one
     * global week (the header's < W1 > control every tab already shares),
     * so switching weeks via the header left this card stuck on the old
     * one. There is no separate week picker on this card — it must always
     * track ctx.week, the same way every other tab does. */
    var week = ctx.week;
    c.appendChild(ctx.el('h2', null, 'Top players — week ' + week));
    if (topState.key !== String(week) && !topState.loading) loadTop(ctx, week);
    if (topState.loading || topState.key !== String(week)) {
      c.appendChild(ctx.el('p', 'muted', 'Loading week ' + week + '…'));
      return c;
    }
    if (topState.error) { c.appendChild(ctx.el('p', 'warnText', 'Could not load: ' + topState.error)); return c; }
    var t = topState.data || {};
    TOP_POS.forEach(function (pos) {
      var list = t[pos] || [];
      c.appendChild(ctx.el('h3', null, pos));
      if (!list.length) { c.appendChild(ctx.el('p', 'muted', 'No games yet.')); return; }
      var rows = list.map(function (p, i) {
        return { cells: [String(i + 1), p.name + '  ' + p.team, ctx.fmt(p.pts)] };
      });
      var wrap = ctx.el('div', 'twrap');
      wrap.appendChild(ctx.table(['#', 'Player', 'Pts'], rows));
      c.appendChild(wrap);
    });
    return c;
  }

  /* ---- dispatch -------------------------------------------------------- */
  function modeChips(ctx) {
    var chips = ctx.el('div', 'fchips');
    [['search', 'Search'], ['team', 'By team'], ['top', 'Top players']].forEach(function (m) {
      var on = mode === m[0];
      var b = ctx.el('button', 'fchip' + (on ? ' on' : ''), m[1]);
      b.addEventListener('click', function () { mode = m[0]; ctx.rerender(); });
      chips.appendChild(b);
    });
    return chips;
  }
  function render(host, ctx) {
    _ctx = ctx;
    host.appendChild(modeChips(ctx));
    if (mode === 'search') {
      host.appendChild(searchCard(ctx));
      if (selPlayer) host.appendChild(selectedPlayerCard(ctx));
    } else if (mode === 'team') {
      host.appendChild(teamPickerCard(ctx));
      if (selTeamAbbr) host.appendChild(teamRosterCard(ctx));
    } else {
      host.appendChild(topCard(ctx));
    }
  }

  /* Pull-to-refresh, wired from ui.js's gestures config: force-refetches
   * whatever is currently on screen. Returns a promise so the pull spinner
   * knows when to stop. */
  function refresh() {
    if (!_ctx) return Promise.resolve();
    if (mode === 'search' && selPlayer) return loadPlayerLog(_ctx, selPlayer, true);
    if (mode === 'team' && selTeamAbbr) return loadTeamRoster(_ctx, selTeamAbbr, selTeamWeek, true);
    if (mode === 'top') return loadTop(_ctx, topWeek === null ? _ctx.week : topWeek, true);
    return Promise.resolve();
  }

  var API = { render: render, refresh: refresh, openPlayerModal: openPlayerModal };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.Stats = API;
})(typeof window !== 'undefined' ? window : this);
