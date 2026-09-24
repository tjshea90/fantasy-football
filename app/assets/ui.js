/* ui.js — all screens. ES2018 only (no ?. no ?? no .at()). */
(function () {
  'use strict';
  var S, seed, view = 'live', week = 1, busy = false;
  /* Which group of Data-tab cards is showing (2026-09-15g: Tj: "organize
     the data tab with sub navigation that is smart and easy to
     understand" — the tab had grown to 13-14 cards in one long scroll).
     In-memory only, like `view` itself: it survives switching to another
     tab and back within this session, but resets to 'league' on a fresh
     boot, the same as every other view function's own scroll position. */
  var dataSubView = 'league';
  /* Lineups tab sub-view: 'set' (the lineup editors) or 'advice' (what used
     to be the Advice tab — see viewLineupsTab). */
  var lineSub = 'set';
  /* live polling: a handle plus the last result, so every screen can say how
     fresh the numbers are without each one owning a timer */
  var live = { timer: null, at: 0, inProgress: 0, err: '', next: 0, fails: 0 };
  /* declared up here with `live` because scheduleLive() reads it and is defined
     above the sleep block; `var` hoisting makes that safe either way, but a
     reader should not have to know that to trust it */
  var asleep = false;
  /* Parsed box scores for the week being watched. A final game never changes,
     so a live poll refetches only what is still moving. Memory only, and reset
     whenever the season or week changes — see doSync. */
  var gcache = { season: 0, week: 0, byId: {} };
  /* Long-running work lives HERE, not inside a screen, so switching tabs never
     cancels it and never loses the progress display. Any screen can read it. */
  var job = { name: null, text: '', pct: 0 };
  var scrollMem = {};
  /* ---- scroll and focus continuity across a re-render -------------------
   * render() rebuilds the whole view with innerHTML = ''. That is fine for a
   * tab switch and wrong for everything else: picking a player from a <select>
   * calls render(), and the old code then restored `scrollMem[view]`, which is
   * only ever written by the TAB HANDLER. So the position it restored was
   * wherever the tab was when it was last opened — the top — and the screen
   * jumped away from the dropdown he had just used. Every select in the app
   * did this, not only Lineups.
   *
   * The rule now: a re-render of the SAME view keeps exactly where you are; a
   * switch to a DIFFERENT view restores that view's remembered position. */
  var lastView = null;      /* which view the last completed render painted */
  var keepScroll = null;    /* explicit override for one render, else null */
  var focusKey = null;      /* data-fk of the control that had focus */
  function curScroll() {
    return window.pageYOffset || document.documentElement.scrollTop ||
           document.body.scrollTop || 0;
  }
  function applyScroll(y) {
    if (Math.abs(curScroll() - y) < 2) return;   /* already there — no jump */
    window.scrollTo(0, y);
    /* The rebuilt view can be a few pixels shorter for a frame, which clamps
       the scroll. Re-assert once after layout; if the first call landed, this
       is a no-op and nothing moves. */
    var again = function () { if (Math.abs(curScroll() - y) >= 2) window.scrollTo(0, y); };
    if (window.requestAnimationFrame) window.requestAnimationFrame(again);
    else window.setTimeout(again, 0);
  }
  function grabFocus() {
    var a = document.activeElement;
    focusKey = (a && a.getAttribute) ? a.getAttribute('data-fk') : null;
  }
  function restoreFocus() {
    if (!focusKey) return;
    /* data-fk values are built from team ids and slot keys, so they are ours —
       but a selector assembled by string concatenation is one imported roster
       away from being a syntax error that throws in the middle of a render.
       A WHITELIST rather than an escape: every key this app produces looks
       like `ln|myteam|RB1`, and anything that does not simply fails to match,
       which costs a restored focus and nothing else. */
    var safeKey = String(focusKey).replace(/[^A-Za-z0-9_|.:-]/g, '');
    var n = null;
    try { n = document.querySelector('[data-fk="' + safeKey + '"]'); }
    catch (e) { n = null; }
    focusKey = null;
    if (!n) return;
    try { n.focus({ preventScroll: true }); } catch (e) { /* older WebView */ }
  }

  function jobStart(name, text) { job = { name: name, text: text, pct: 0 }; paintJob(); }
  function jobStep(text, pct) { job.text = text; if (pct !== undefined) job.pct = pct; paintJob(); }
  function jobEnd() { job = { name: null, text: '', pct: 0 }; paintJob(); }
  function jobRunning(name) { return job.name === name; }
  function paintJob() {
    var box = $('job');
    if (!box) return;
    if (!job.name) { box.hidden = true; return; }
    box.hidden = false;
    $('jobText').textContent = job.text;
    $('jobBar').style.width = Math.max(2, Math.min(100, job.pct)) + '%';
  }

  /* ---- one bad card must not blank a whole tab (v2.9) --------------------
   * Every screen is rebuilt from scratch on every render, so an exception
   * inside one card used to take the entire tab down to the global error
   * handler and leave a stack trace where the app should be. Each card is now
   * built inside this: a failure becomes one visible red card naming what
   * broke, and everything else on the screen still renders. */
  function safeCard(name, fn) {
    try {
      var node = fn();
      return node || null;
    } catch (e) {
      var c = el('div', 'card warn');
      c.appendChild(el('h2', null, name + ' could not be drawn'));
      c.appendChild(el('p', null, (e && e.message) ? e.message : String(e)));
      c.appendChild(el('p', 'muted', 'The rest of this screen is unaffected. ' +
        'If this keeps happening, Data → App → Export backup and say what it says here.'));
      return c;
    }
  }
  function addSafe(root, name, fn) {
    var n = safeCard(name, fn);
    if (n) root.appendChild(n);
  }

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = String(txt);
    return e;
  }
  /* This was `return String(s)` — named as a guard and doing nothing, while
     its one caller builds the transactions list through innerHTML from
     free-text player names. Ampersand and angle brackets are all that is
     needed: the value lands in element TEXT, never inside an attribute, so
     quotes cannot break out. (Numeric entities are avoided on purpose — the
     ES2018 checker reads `&#39;` as a private class field.) */
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function fmt(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  /* whole points — a rest-of-season total is a two- or three-digit number and
     a decimal on it is false precision, not detail (2026-09-18) */
  function fmt0(n) { return String(Math.round(Number(n) || 0)); }
  /* data-player="name|pos|nfl" — the long-press "View stats" target (v6.0).
     Every place a real NFL player's name/position/team is shown carries
     this, so the one globally-wired long-press handler can identify him
     without each call site wiring its own listener. */
  function markPlayer(node, name, pos, nfl) {
    if (node && name) node.setAttribute('data-player', String(name) + '|' + String(pos || '') + '|' + String(nfl || ''));
    return node;
  }
  /* Shared freshness text, so every cache-backed card says how old its data
     is the same way. Cheap insurance against the exact gap that let a v5.5
     card show week-old injury notes with nothing on screen admitting it. */
  function agoText(t) {
    if (!t) return 'never';
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    if (m < 60 * 36) return Math.round(m / 60) + ' h ago';
    return Math.round(m / 1440) + ' d ago';
  }
  /* alert() renders as 'The page at "file://" says', which looks broken.
     Everything user-facing goes through this instead. */
  /* ---- real dialogs (v3.7) ----------------------------------------------
   * confirm() and prompt() render as bare file:// dialogs on Android — the
   * same reason alert() was banned here long ago. Worse, prompt()'s default
   * value is a single-line field: it truncates and is not reliably
   * selectable, and TWO of the six call sites were the manual backup and
   * restore path. A mid-season export is tens of KB, so "Copy this backup"
   * was handing back an unusable string and "Paste a backup JSON" could not
   * take one. These replace all six. */
  /* ONE MODAL STACK (v4.7). There were two implementations of a modal in this
     file — dialog() and modal() — with their own backdrop, their own close and
     their own click-outside. Neither could be dismissed with the Android BACK
     button, which is the reflex, because back exited the whole app; neither
     moved focus into itself; neither closed on Escape; and the swipe handler
     added in this version needs to know when one is open. All of that wants a
     single list of what is currently open, so modal() is now built on
     dialog(), and this is the list. */
  var modalStack = [];
  function modalOpen() { return modalStack.length > 0; }
  function closeTopModal() {
    if (!modalStack.length) return false;
    var top = modalStack[modalStack.length - 1];
    top();
    return true;
  }
  function dialog(title, bodyText, build) {
    var back = el('div');
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.66);z-index:60;' +
      'display:flex;align-items:center;justify-content:center;padding:18px';
    /* Screen readers need to know this is a dialog and that the page behind it
       is inert; `data-nogesture` tells gestures.js the same thing. */
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    back.setAttribute('data-nogesture', '');
    var box = el('div', 'card');
    box.style.cssText = 'max-width:560px;width:100%;max-height:82vh;overflow:auto;margin:0';
    var h = el('h2', null, title);
    h.id = 'mdl' + (++modalSeq);
    back.setAttribute('aria-labelledby', h.id);
    box.appendChild(h);
    if (bodyText) {
      var pre = el('pre');
      pre.style.cssText = 'white-space:pre-wrap;font-size:13px;margin:0 0 12px;' +
        'font-family:inherit;line-height:1.5';
      pre.textContent = bodyText;
      box.appendChild(pre);
    }
    var prevFocus = document.activeElement;
    var closed = false;
    var close = function () {
      if (closed) return;
      closed = true;
      var i = modalStack.indexOf(close);
      if (i >= 0) modalStack.splice(i, 1);
      if (back.parentNode) document.body.removeChild(back);
      /* hand focus back where it came from, or the page has none at all */
      try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); }
      catch (e) { /* older WebView */ }
    };
    var row = el('div', 'dbrow');
    row.style.marginTop = '12px';
    build(box, row, close);
    box.appendChild(row);
    back.appendChild(box);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    /* Escape closes the top one — a hardware keyboard, or a phone with one. */
    back.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) { e.stopPropagation(); close(); }
    });
    document.body.appendChild(back);
    modalStack.push(close);
    /* Focus lands INSIDE the dialog, so the next tab press stays in it and a
       screen reader announces the dialog rather than the page behind it. */
    window.setTimeout(function () {
      var f = box.querySelector('textarea, input, button');
      try { if (f && f.focus) f.focus({ preventScroll: true }); } catch (e2) { }
    }, 20);
    return close;
  }
  var modalSeq = 0;
  /* A yes/no. `danger` paints the confirm button red — used for the two
     destructive ones so they do not look like every other button. */
  function confirmModal(title, bodyText, okLabel, onOk, danger) {
    dialog(title, bodyText, function (box, row, close) {
      var no = el('button', 'btn', 'Cancel');
      no.addEventListener('click', close);
      var yes = el('button', 'btn ' + (danger ? 'dan' : 'pri'), okLabel || 'OK');
      yes.addEventListener('click', function () { close(); onOk(); });
      row.appendChild(no); row.appendChild(yes);
    });
  }
  /* A multi-line text box. `initial` prefills it and is pre-selected, which is
     what makes copy-out work; onOk receives the current value. */
  function textModal(title, bodyText, initial, okLabel, onOk) {
    dialog(title, bodyText, function (box, row, close) {
      var ta = el('textarea');
      ta.value = initial || '';
      ta.setAttribute('spellcheck', 'false');
      ta.setAttribute('autocapitalize', 'none');
      ta.style.cssText = 'width:100%;min-height:180px;background:var(--panel2);' +
        'color:var(--fg);border:1px solid var(--line);border-radius:9px;padding:9px;' +
        'font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace;resize:vertical';
      box.appendChild(ta);
      var no = el('button', 'btn', 'Cancel');
      no.addEventListener('click', close);
      var yes = el('button', 'btn pri', okLabel || 'OK');
      yes.addEventListener('click', function () { var v = ta.value; close(); onOk(v); });
      row.appendChild(no); row.appendChild(yes);
      window.setTimeout(function () {
        ta.focus();
        if (initial) { try { ta.setSelectionRange(0, ta.value.length); } catch (e) { } }
      }, 30);
    });
  }
  /* A read-only panel with a Close button. This was a SECOND full modal
     implementation with its own backdrop and its own close — so it silently
     missed everything dialog() gained (the stack, back-button dismissal,
     Escape, focus handling, the ARIA roles). One implementation now. */
  function modal(title, body, extra) {
    return dialog(title, body, function (box, row, close) {
      if (extra) box.appendChild(extra);
      var ok = el('button', 'btn pri', 'Close');
      ok.addEventListener('click', close);
      row.appendChild(ok);
    });
  }
  /* ---------- THE CLAUDE-APP ROUND TRIP (v4.5) --------------------------
   * Tj: "I should be able to export a file from the app, upload it to a Claude
   * chat with no explanation, and Claude creates a file which I can import back
   * into the football app which fills in all relevant information in the app."
   *
   * One card, built once, used by BOTH the Advice tab and the waiver wire. The
   * two differ only in which briefing is built and what the reply fills in, so
   * a second copy of this would be two places for the file-picking, the paste
   * fallback and the error wording to drift apart.
   *
   * WHY THERE IS A PASTE FALLBACK AS WELL AS A PICKER. The picker is the nicer
   * path and it is what Tj asked for. But it depends on the phone having a
   * document provider, on the Claude app having actually saved a file rather
   * than shown a code block, and on him finding it. Paste always works and
   * costs one extra tap, and the importer does not care which arrived — it
   * finds the JSON either way. A feature whose only path can fail silently on
   * a Sunday morning is not a feature.
   */
  var pickWaiting = null;
  window.__filePicked = function (text, err) {
    var cb = pickWaiting; pickWaiting = null;
    if (!cb) return;
    cb(text, err);
  };

  /* ---------- game-time badges and the pre-Sunday alert (v4.5) ----------
   * Tj wanted the day and time each player plays sitting next to his name,
   * everywhere a player is listed, and an alert he cannot miss for the ones
   * playing before Sunday.
   *
   * `gameBadge` returns a <small> to append to any name. It is deliberately
   * tiny and deliberately colour-coded rather than wordy: on a roster of
   * seventeen the only thing that must jump out is "this one is not on
   * Sunday". */
  function gameBadge(nfl, wk) {
    if (!window.Schedule) return null;
    var b = null;
    try { b = Schedule.badge(nfl, wk === undefined ? week : wk); } catch (e) { return null; }
    if (!b) return null;
    var s = el('small', b.early ? 'gEarly' : (b.live ? 'gLive' : (b.done ? 'gDone' : 'gWhen')));
    s.textContent = '  ' + b.text;
    s.title = b.opp;
    return s;
  }

  /* ---------- injury/questionable tags, everywhere a roster is listed (v5.8)
   * Tj, 2026-09-14: "in the advice section, roster section, lineup section,
   * and live section and anywhere else my players on my roster are listed,
   * clearly show updated information on if any player is injured or
   * questionable. Update this information smartly when needed. It must be
   * updated frequently so I know which of my players is injured."
   *
   * The Advice tab already had this (recommend.js's own `x.flags`, built by
   * Recommend.projectOne from the same ESPN injury feed) — this is that same
   * flag list, reused rather than reinvented, so a player never reads as
   * healthy on one screen and hurt on another. One projectAll() per team per
   * render; defenseProfile() inside it is already memoised on (week, store
   * generation), so calling this from a few more cards costs nothing extra.
   *
   * See liveTick() for how the underlying injury feed itself stays current —
   * it rides the same poll that already runs every 45s-10min while the app
   * is open, gated by loadNews's own 10-minute freshness cache so it is a
   * real network fetch roughly every 10 minutes, not every tick. */
  function healthFlags(teamId, opp) {
    var byId = {};
    if (!window.Recommend || !Recommend.projectAll) return byId;
    try {
      Recommend.projectAll(week, teamId, opp).forEach(function (x) {
        if (x.flags && x.flags.length) byId[x.p.id] = x.flags;
      });
    } catch (e) { /* the advice engine failing must never blank a roster list */ }
    return byId;
  }
  function appendHealthTags(host, flags) {
    if (!flags) return;
    flags.forEach(function (f) {
      host.appendChild(el('span', f.kind === 'out' ? 'tag out' : 'tag warn',
                          f.text.split(' — ')[0].split(':')[0]));
    });
  }
  function weekOpponents() {
    return (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
  }

  /* The alert card. Shown at the top of Lineups (called directly below) and
     Advice (via ctx.earlyGameCard, see viewAdvice and recommend.js's own
     render()) — the two screens he is actually on when he thinks about his
     lineup — and only when there is something to act on. NOT Live: found in
     the 2026-09-15e sweep that this comment used to claim all three, but no
     call site for Live ever existed. It leads with the ACTIONABLE case
     (someone benched who ought to be starting) because "you have players on
     Thursday" is a reminder and "two of them are on your bench" is the thing
     that saves a week. */
  function earlyGameCard() {
    if (!window.Schedule) return null;
    var a = null;
    try {
      var opp = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
      a = Schedule.earlyAlert(week, S.league.me, opp);
    } catch (e) { return null; }
    if (!a) return null;

    var urgent = a.shouldStart.length > 0;
    var c = el('div', 'card ' + (urgent ? 'alertBad' : 'alertWarn'));
    var when = a.rows[0].when;
    c.appendChild(el('h2', null, urgent
      ? '⚠  Set your lineup — ' + a.shouldStart.length + ' recommended player' +
        (a.shouldStart.length === 1 ? ' is' : 's are') + ' on your bench'
      : '⏰  You have ' + a.rows.length + ' player' + (a.rows.length === 1 ? '' : 's') +
        ' playing before Sunday'));

    c.appendChild(el('p', null,
      'First kickoff is ' + when + (a.hoursLeft <= 48
        ? '  ·  in about ' + (a.hoursLeft < 1 ? 'under an hour'
            : a.hoursLeft + ' hour' + (a.hoursLeft === 1 ? '' : 's'))
        : '') + '. Lineups for these players are due before then.'));

    if (urgent) {
      c.appendChild(el('div', 'subhd', 'Recommended, but not in your lineup'));
      a.shouldStart.forEach(function (r) {
        var row = el('div', 'row');
        markPlayer(row, r.name, r.pos, r.nfl);
        row.appendChild(el('div', 'slot', r.pos));
        var nm = el('div', 'nm');
        nm.appendChild(document.createTextNode(r.name));
        nm.appendChild(el('small', null, '  ' + r.nfl + ' ' + r.opp));
        row.appendChild(nm);
        row.appendChild(el('b', 'gEarly', r.when));
        c.appendChild(row);
      });
      var fix = el('button', 'btn pri', 'Use the recommended lineup');
      fix.style.marginTop = '8px';
      fix.addEventListener('click', function () {
        confirmModal('Use the recommended lineup?',
          'This fills your week ' + week + ' lineup with the best projected legal ' +
          'lineup, replacing any slots you picked yourself.',
          'Do it', function () {
            Store.clearManual(week, S.league.me);
            var was = S.settings.autoFill; S.settings.autoFill = true;
            var n = autoFillWeek(week);
            S.settings.autoFill = was;
            if (window.Sim) Sim.invalidate();
            render();
            toast(n ? n + ' slot' + (n === 1 ? '' : 's') + ' updated' : 'Already set');
          });
      });
      c.appendChild(fix);
    }

    if (a.starting.length) {
      c.appendChild(el('div', 'subhd', 'Already starting, playing early'));
      a.starting.forEach(function (r) {
        var row = el('div', 'row');
        markPlayer(row, r.name, r.pos, r.nfl);
        row.appendChild(el('div', 'slot', r.slot || r.pos));
        var nm = el('div', 'nm');
        nm.appendChild(document.createTextNode(r.name));
        nm.appendChild(el('small', null, '  ' + r.nfl + ' ' + r.opp));
        row.appendChild(nm);
        row.appendChild(el('b', 'gEarly', r.when));
        c.appendChild(row);
      });
    }
    var others = [];
    a.benched.forEach(function (r) { if (!r.recommended) others.push(r.name); });
    if (others.length) {
      c.appendChild(el('p', 'hint', 'Also on your bench and playing early: ' +
        others.join(', ') + '. The app is not recommending them this week.'));
    }
    return c;
  }

  function handoffCard(opts) {
    /* opts: { title, blurb, build(), apply(text), status() } */
    var c = el('div', 'card');
    c.appendChild(el('h2', null, opts.title));
    /* The how-it-works paragraph is clamped to three lines, tap to read it
       all (2026-09-23). This same box appears on Roster, Wire and Advice,
       and after the first use its five-line explanation was the tallest
       thing between him and the two buttons he actually came for. */
    var blurb = el('p', 'hint clamp', opts.blurb);
    blurb.addEventListener('click', function () { blurb.classList.toggle('open'); });
    c.appendChild(blurb);

    var step1 = el('button', 'btn pri', '1 · Make the file for Claude');
    step1.style.marginTop = '4px';
    step1.addEventListener('click', function () {
      var f;
      try { f = opts.build(); }
      catch (e) {
        modal('Could not build the file', (e && e.message) ? e.message : String(e));
        return;
      }
      var shared = false;
      if (window.Native && Native.exportShare) {
        try { shared = Native.exportShare(f.filename, f.text, 'text/markdown'); }
        catch (e) { shared = false; }
      }
      if (shared) {
        toast('Saved to Downloads — pick Claude in the share sheet', 4200);
        return;
      }
      /* no share sheet: still write it, and say exactly where it went */
      var wrote = false;
      if (window.Native && Native.exportFile) {
        try { wrote = Native.exportFile(f.filename, f.text, 'text/markdown'); }
        catch (e) { wrote = false; }
      }
      if (wrote) {
        modal('File ready',
          'Saved to your Downloads folder as:\n\n  ' + f.filename +
          '\n\nOpen the Claude app, start a chat, attach that file and send it ' +
          'with no message. Everything Claude needs is inside the file.\n\n' +
          'When Claude gives you a file back, come here and tap ' +
          '"2 · Load Claude\'s reply".');
        return;
      }
      /* nothing could write a file — hand him the text so the path still works */
      textModal('Copy this to Claude',
        'The app could not write a file on this phone, so here is the whole ' +
        'briefing (' + f.text.length + ' characters). Select all, copy, and ' +
        'paste it into a Claude chat.',
        f.text, 'Done', function () { });
    });
    c.appendChild(step1);

    function applyText(txt) {
      var res;
      try { res = opts.apply(txt); }
      catch (e) {
        modal('Nothing was imported', (e && e.message) ? e.message : String(e));
        return;
      }
      modal('Imported', res.detail +
        (res.truncated
          ? '\n\nNOTE: Claude\'s answer looks like it was cut off before the end. ' +
            'What did arrive was kept; anyone missing simply was not updated.'
          : '') +
        (res.summary ? '\n\n' + res.summary : ''));
      render();
    }

    var step2 = el('button', 'btn', '2 · Load Claude\'s reply');
    step2.style.marginTop = '8px';
    step2.addEventListener('click', function () {
      function paste() {
        textModal('Paste Claude\'s reply',
          'Paste the file Claude gave you, or just paste its whole message — ' +
          'the app finds the JSON inside either way.',
          '', 'Import', function (v) { if (v && v.trim()) applyText(v); });
      }
      if (window.Native && Native.pickFile) {
        pickWaiting = function (text, err) {
          if (err) { modal('Could not read that file', err + '\n\nYou can paste it instead.'); return; }
          if (text === null || text === undefined) { paste(); return; }   /* cancelled */
          applyText(text);
        };
        var started = false;
        try { started = Native.pickFile(); } catch (e) { started = false; }
        if (started) return;
        pickWaiting = null;
      }
      paste();
    });
    c.appendChild(step2);

    var st = opts.status ? opts.status() : '';
    if (st) c.appendChild(el('p', 'hint', st));
    return c;
  }

  function toast(msg, ms) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, ms || 2600);
  }

  /* ---------- boot ---------- */
  function fatal(msg) {
    var v = $('view');
    if (!v) {
      /* textContent, not innerHTML: `msg` can carry an HTTP error body (see
         index.html's onerror for the same fix). */
      document.body.innerHTML = '';
      var fp = document.createElement('pre');
      fp.style.cssText = 'padding:16px;color:#f85149;white-space:pre-wrap';
      fp.textContent = String(msg);
      document.body.appendChild(fp);
      return;
    }
    v.innerHTML = '';
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Something went wrong'));
    var p = el('pre'); p.style.whiteSpace = 'pre-wrap'; p.style.fontSize = '12px';
    p.style.color = '#f85149'; p.textContent = msg;
    c.appendChild(p);
    c.appendChild(el('p', 'muted', 'Send this text to Claude and it can be fixed.'));
    v.appendChild(c);
  }
  function boot() {
    try {
      /* Data is a <script>, not a fetch: a file:// page on Android WebView
         cannot XHR a sibling file, which is exactly what broke v1.0. */
      seed = window.SEED;
      if (!seed || !seed.teams || !seed.teams.length) {
        fatal('seed.js did not load (window.SEED is ' + (typeof window.SEED) + ').\n' +
              'The app data file is missing from the APK.');
        return;
      }
      S = Store.init(seed);
      week = S.settings.currentWeek || 1;
      /* Tj: "if I switch apps then go back to the fantasy app it
       * automatically goes back to what I was already looking at last.
       * Right now it always jumps back to the live tab if I switch apps
       * then go back to it." Android does not reliably keep this Activity
       * alive in the background — under normal memory pressure the OS can
       * kill the process outright, and the next "resume" Tj sees is
       * actually this boot() running again from scratch (onPause/onResume
       * alone, when the process DOES survive, touch none of this — view
       * is still whatever it was, in memory). So the one thing that can
       * make a real cold relaunch look like a resume is restoring from
       * disk what tab was open last, the same way `week` just did above. */
      /* The Advice tab became Lineups -> Advice (2026-09-23b). A phone last
         closed on it comes back to exactly that screen, not to Live. */
      if (S.settings.lastTab === 'advice') { view = 'lineups'; lineSub = 'advice'; }
      else if (S.settings.lastTab && tabList().indexOf(S.settings.lastTab) >= 0) {
        view = S.settings.lastTab;
      }
      if (S.settings.lineSub === 'advice' && view === 'lineups') lineSub = 'advice';
    } catch (e) {
      fatal('Startup failed:\n' + (e && e.stack ? e.stack : e));
      return;
    }
    /* TAB NAVIGATION MUST NEVER DEPEND ON WHAT COMES AFTER THIS LINE.
     * (2026-09-16, Tj: "sometimes when I open the app it is on the live tab
     * and it won't let me press another tab like waiver wire.") `wire()` is
     * the ONLY place that ever attaches click listeners to the bottom tab
     * bar (see its own comment above). Before this fix it ran only after
     * applyAdjust()/Recommend.loadCaches()/autoFillWeek() succeeded, all
     * four sharing ONE try/catch with everything above — so if any one of
     * those three threw (a corrupted local save recovering from an
     * interrupted session is the most plausible real trigger; CLAUDE.md's
     * own "INTERRUPTED MID-CHANGE" warning is exactly this class of state),
     * `wire()` never ran and the tab bar was permanently inert for the rest
     * of the session, with no recovery except force-closing and
     * relaunching. Every step below is now individually guarded so a
     * failure anywhere in startup can cost only that one piece of
     * functionality, never the ability to switch tabs at all. */
    wire();
    try {
      applyAdjust();
      if (window.Recommend && Recommend.loadCaches) Recommend.loadCaches();
      autoFillWeek(week);
    } catch (e) { /* the tab bar and render() below must still work */ }
    render();
    try {
      startLive();
      freshenSchedule();
      refreshPlayerDBIfStale();
      /* local first: no network, cannot fail, cannot be blocked by a stale
         cache — see the NFL WEEK AUTO-ADVANCE comment above */
      localAutoAdvance();
      syncCurrentWeek();
    } catch (e) { /* the app is already usable; these are all background refreshes */ }
  }

  /* Kickoff times, when the live poll is not going to supply them.
   *
   * On a Sunday the poll fetches the scoreboard anyway and `Schedule.ingest`
   * takes the times off that response for free. But on a Tuesday — which is
   * exactly when the Thursday alert matters most — the poll is on its slow
   * ten-minute cadence or stopped entirely because the week is final, so
   * something has to ask. `Schedule.refresh` is a no-op unless the stored copy
   * is more than three hours old, so calling it on every boot, week change and
   * resume is a handful of requests a day, not a poll. */
  /* Same "quiet, only if actually stale" shape as freshenSchedule() below,
   * for the player database instead of the week's kickoff schedule. Never
   * awaited by a caller — it runs in the background and re-renders whenever
   * an attempt actually ran (success OR failure — same as freshenSchedule's
   * own re-render below), never when ensureFresh() short-circuited without
   * touching the network. See playerdb.js's own ensureFresh() for the
   * staleness rule (2 days), the retry cooldown that keeps a failed attempt
   * from re-triggering itself through this very re-render forever, and why
   * a fully-failed attempt no longer masks itself from being retried. */
  function refreshPlayerDBIfStale() {
    if (!window.PlayerDB || !PlayerDB.ensureFresh) return;
    try {
      var p = PlayerDB.ensureFresh();
      if (p && p.then) p.then(function (r) { if (r) render(); })['catch'](function () { /* offline is fine */ });
    } catch (e) { /* never block startup, resume or a tab render for a background refresh */ }
  }
  /* THE SEASON PROJECTIONS THE WIRE IS NOW RANKED ON (2026-09-18).
   *
   * Same quiet, only-if-stale shape as refreshPlayerDBIfStale above, and it
   * exists for the same reason: the Wire tab is where this data is READ, so
   * the Wire tab has to be able to fetch it. Before this, the only thing that
   * ever called Projections.refreshSeason was the Advice tab's full sync — so
   * a phone that opened the Wire tab without running that sync first had an
   * empty season cache, every free agent fell back to a weekly line or a
   * positional floor, and the board would have looked broken in a brand new
   * way rather than the old one. Twelve-hour freshness (projections.js's
   * SEASON_FRESH_MS) means this is at most two fetches a day, not a poll.
   *
   * Deliberately never awaited and never fatal: the board renders immediately
   * from whatever is on disk and re-renders when this lands, exactly as the
   * player database and injury feed already do. */
  function refreshSeasonProjIfStale() {
    if (!window.Projections || !Projections.refreshSeason) return;
    try {
      if (Projections.seasonFresh && Projections.seasonFresh(S.settings.season)) return;
      var p = Projections.refreshSeason(S.settings.season);
      if (p && p.then) {
        p.then(function () { render(); })['catch'](function () { /* offline is fine */ });
      }
    } catch (e) { /* never block a tab render for a background refresh */ }
  }
  function freshenSchedule() {
    if (!window.Schedule) return;
    /* The live poll fetches this exact scoreboard (Espn.weekGames for the
       same week) and hands it to Schedule.ingest for free. When a tick is due
       within seconds — every boot, week change and resume arms one first —
       refreshing here too fetched the same ~150 KB twice, four seconds apart
       (full test 2026-09-23c, seen in the request log of a stale boot). */
    if (live.timer && live.next && live.next - Date.now() <= 15000) return;
    try {
      var p = Schedule.refresh(week);
      if (p && p.then) {
        p.then(function () { render(); })['catch'](function () { /* offline is fine */ });
      }
    } catch (e) { /* never block startup for a badge */ }
  }
  /* The tab order the bottom bar is in, read from the DOM so the two can never
     disagree — a swipe moves through exactly the buttons he can see. */
  function tabList() {
    var t = document.querySelectorAll('#tabs .tab'), out = [], i;
    for (i = 0; i < t.length; i++) out.push(t[i].getAttribute('data-v'));
    return out;
  }
  /* Every tab actually visited, in order, so BACK can return to wherever he
     came from instead of jumping straight to Live — see __onBack below.
     `fromBack` marks a pop so returning to a tab never re-records it: without
     that guard, Live -> Lineups -> back -> Lineups -> back would push
     Lineups right back onto the stack it was just popped from and back would
     never actually leave Lineups. */
  var navHistory = [];
  /* The one place the tab bar's HIGHLIGHT is painted, whether that is a real
   * tap (goTab) or just boot() restoring lastTab before the first tap of the
   * session. (2026-09-18, Tj: "I press the waiver wire tab...it doesn't go to
   * the waiver wire tab. It is stuck on the live tab...after that the waiver
   * wire tab works normally.") ROOT CAUSE: boot() restores `view` from
   * S.settings.lastTab (a few lines below) whenever a cold relaunch — which
   * Android forces far more often than Tj realises, see CLAUDE.md — last
   * closed on a tab other than Live. wire() used to fix up `aria-selected`
   * for that restored tab but never the `.on` CLASS, which is the one
   * app.css actually paints (see .tab.on). So if Tj last left the app on
   * Wire, a cold relaunch put `view` at 'wire' and rendered Wire's content,
   * while the tab bar kept showing Live highlighted (the static HTML's
   * default). His next tap on Wire then hit goTab's `name === view` guard —
   * a real no-op, since he actually was already on Wire — so nothing visibly
   * happened except the native `.tab:active` press flash. Tapping any OTHER
   * tab had a genuinely different name, so it went through goTab for real and
   * synced the class for the first time that boot, which is why every tab
   * after that behaved. Two call sites painting the same highlight from two
   * different, DRIFTING implementations is exactly how this happened; now
   * there is one. */
  function paintTabBar(name) {
    var t = document.querySelectorAll('#tabs .tab'), k;
    for (k = 0; k < t.length; k++) {
      var on = t[k].getAttribute('data-v') === name;
      t[k].classList.toggle('on', on);
      t[k].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }
  /* The one place a tab change happens, whether it came from a tap or a swipe. */
  function goTab(name, fromBack) {
    /* the old Advice tab is Lineups -> Advice now (2026-09-23b); anything
       still asking for it by name lands there instead of on a blank screen */
    if (name === 'advice') { lineSub = 'advice'; name = 'lineups'; if (view === 'lineups') { render(); return; } }
    if (!name || name === view) return;
    if (!fromBack) navHistory.push(view);
    scrollMem[view] = curScroll();
    view = name;
    /* so a cold relaunch (see boot()) can restore this instead of always
       landing on Live — cheap: this only runs on an actual tab CHANGE,
       never per-render, matching how every other settings write here works */
    if (S && S.settings) {
      S.settings.lastTab = name;
      /* deferred and coalesced — see Store.saveSoon for why a tab tap must
         not pay a synchronous disk flush; __appPause flushes it */
      if (Store.saveSoon) Store.saveSoon(); else Store.save();
    }
    paintTabBar(name);
    render();
  }
  function wire() {
    var tabs = document.querySelectorAll('#tabs .tab'), i;
    for (i = 0; i < tabs.length; i++) {
      tabs[i].setAttribute('role', 'tab');
      tabs[i].addEventListener('click', function () {
        goTab(this.getAttribute('data-v'));
      });
    }
    /* Sync the highlight to whatever boot() decided `view` is — the default
       'live' the vast majority of the time, but see paintTabBar's own
       comment for why this must never be skipped or done half (aria-selected
       only) again. */
    paintTabBar(view);
    var nav = $('tabs'); if (nav) nav.setAttribute('role', 'tablist');
    $('wkPrev').addEventListener('click', function () { if (week > 1) { week--; commitWeek(); } });
    /* 17, not 18. The league's season is weeks 1-14 plus playoffs 15-17
       (RULES_2026.md §LEAGUE STRUCTURE); week 18 has no matchups, no lineups
       and nothing to show, and it was reachable purely because the guard was
       written against the NFL calendar rather than this league's. */
    $('wkNext').addEventListener('click', function () { if (week < LAST_WEEK) { week++; commitWeek(); } });
    $('syncBtn').addEventListener('click', syncWeek);
    wireGestures();
    wireLongPress();
  }
  var LAST_WEEK = 17;

  /* ---------- NFL WEEK AUTO-ADVANCE ----------------------------------------
   * Tj: "automatically select the tabs in all sections of the app to the
   * current NFL week. After tonight, when NFL week one is finished, the
   * entire app should default to week 2 in all sections."
   *
   * There is exactly one `week` for the whole app (every tab reads this same
   * module variable, and commitWeek is the one place it is written), so
   * fixing it here fixes it everywhere at once — nothing per-tab to repeat.
   *
   * 2026-09-15h: Tj reported that even a full force-stop and relaunch — a
   * genuine cold boot — still left the app on a finished week 1. This
   * comment used to say the check ran "BOOT ONLY, not every appResume"
   * because "Android usually kills the JS context when the app is
   * backgrounded... so appResume() already doubles as a fresh boot most of
   * the time" — WRONG, and already corrected once (2026-09-15f: appResume()
   * now also calls syncCurrentWeek()). But Tj's force-stop report is a TRUE
   * cold boot, where boot() already called this unconditionally even
   * before that fix — so a cold boot still failing means the ESPN-based
   * check itself (below) is not reliable enough on its own: either
   * S.settings.nflWeek's 3-hour reuse cache re-applies an earlier wrong
   * answer, or Espn.currentWeek()'s network round trip silently fails (its
   * own .catch swallows everything, by design, so the app looks stuck with
   * no error surfaced anywhere), or ESPN's own "current week" metadata
   * simply does not flip the moment every game ends. All three are single
   * points of failure this app cannot verify or control. localAutoAdvance()
   * below is a second, INDEPENDENT signal with none of those failure modes:
   * it trusts only weekMeta.allFinal, which this app already computes
   * itself from real box scores it already fetched — no network call of
   * its own, no cache to go stale, no ESPN metadata field to misread.
   * Whichever of the two notices a transition first wins; applyCurrentWeek
   * itself is what actually makes the change, so both share its one set of
   * guards.
   *
   * Only ever moves the week FORWARD, and only within this league's 1-17
   * (LAST_WEEK, not the NFL's 18) — a stale cache, a network hiccup, or an
   * ESPN preseason/postseason week number must never send it backward or off
   * the end of the season this league actually plays.
   *
   * Called from boot() and appResume() ONLY — never from a manual sync or
   * navigation — so deliberately reviewing an old, already-final week later
   * is never yanked forward mid-review. */
  var NFL_WEEK_STALE_MS = 3 * 3600 * 1000;   /* same reasoning as Schedule.STALE_MS */
  /* The local, network-free backstop: if everything this app already knows
   * about the currently-displayed week says it is done, move on — do not
   * wait on ESPN's own notion of "current week" to agree first. Walks
   * forward through as many CONSECUTIVE already-final weeks as are known
   * (the ordinary case is one step; more only matters after a long
   * absence), then applies the result once through applyCurrentWeek so the
   * two checks share one implementation of "how to actually advance." */
  function localAutoAdvance() {
    var w = week, guard = 0;
    while (guard++ < LAST_WEEK) {
      var m = S.weekMeta[String(w)];
      if (!(m && m.synced && m.allFinal) || w >= LAST_WEEK) break;
      w++;
    }
    if (w > week) applyCurrentWeek({ week: w, seasonType: 2, at: Date.now() });
  }
  function syncCurrentWeek() {
    if (!window.Espn || !Espn.currentWeek) return;
    var c = S.settings.nflWeek;
    if (c && c.at && (Date.now() - c.at) < NFL_WEEK_STALE_MS) { applyCurrentWeek(c); return; }
    /* try/catch around the CALL itself, not just a .catch() on what it
       returns — a request with no async bridge available (the legacy path,
       or a test stub) throws synchronously before any promise exists, same
       as freshenSchedule() above guards Schedule.refresh(). */
    try {
      var p = Espn.currentWeek();
      if (p && p.then) {
        p.then(function (r) {
          var v = { week: r.week, seasonType: r.seasonType, at: Date.now() };
          S.settings.nflWeek = v; Store.save();
          applyCurrentWeek(v);
        })['catch'](function () { /* offline: stay on whatever week was already showing */ });
      }
    } catch (e) { /* never block startup for a week check */ }
  }
  function applyCurrentWeek(v) {
    if (!v || v.seasonType !== 2) return;   /* preseason or postseason: nothing this league plays */
    var clamped = Math.max(1, Math.min(LAST_WEEK, v.week));
    if (clamped <= week) return;            /* never move backward, never re-announce */
    week = clamped;
    S.settings.currentWeek = week; Store.save();
    if (window.Sim) Sim.invalidate();
    autoFillWeek(week);
    startLive();
    freshenSchedule();
    render();
    toast('The NFL season moved on — now showing week ' + week);
  }

  /* ---------- SWIPE BETWEEN TABS, PULL DOWN TO REFRESH (v4.7) -------------
   * Tj: "make it so I can gesture swipe left and right to the different tabs
   *      in addition to the bottom tab buttons. and also a gesture to pull
   *      down to refresh anywhere in the app."
   *
   * The mechanics live in gestures.js, which knows nothing about this app.
   * These are the four things it has to be told, and the reasoning is here
   * because it is app knowledge, not gesture knowledge:
   *
   *  - `blocked` covers a modal being open AND a sync already running. A swipe
   *    mid-sync would rebuild the screen under a job that is writing to it.
   *  - `refresh` is the SAME path as whichever sync button the tab you pulled
   *    on already has — never a third, different notion of "refresh" per
   *    screen, which is how a gesture becomes untrustworthy. It also
   *    freshens the schedule, which is nearly free (Schedule.refresh only goes
   *    to the network if the stored copy is over three hours old).
   *  - ON THE ADVICE TAB specifically this means the FULL advice sync
   *    (schedule + injuries + every projection source + Claude last), not
   *    the box-score sync every other tab pulls. Tj, 2026-09-14: "make it so
   *    the advice loads and refreshes all data when I pull down to refresh."
   *    Before this, pulling down on Advice quietly ran the wrong sync — box
   *    scores, which Advice does not even show — and left the projections,
   *    injury feed and Claude read exactly as stale as they were.
   *  - `scrollTop` is the page's, because <main> does not scroll — the body
   *    does. Getting this wrong is what makes a pull-to-refresh fire halfway
   *    down an article.
   */
  /* Advice's own pull-to-refresh. Same call the "Sync advice" button on that
   * tab makes (see recommend.js render()), just triggered by the gesture
   * instead of a tap — one implementation of "refresh the advice", not two
   * that could drift apart. syncAll already does schedule -> injuries ->
   * every projection source -> Claude LAST, so a spent or missing API key
   * still leaves everything else freshly loaded (Tj, 2026-09-14: "get all
   * information possible before trying to access the Claude API in case I
   * have no credit left"). */
  function adviceSyncQuiet() {
    if (jobRunning('advice')) return Promise.resolve();
    jobStart('advice', 'Advice: starting…');
    /* bare setInterval/clearInterval, NOT root.* — ui.js is a bare
       `(function () {...})()`, unlike every other module here, so `root`
       does not mean `window` in this file (see the __appPause/__appResume
       note above). Using root.setInterval would be a ReferenceError. */
    var t0 = Date.now(), lastText = 'Advice: starting…';
    var tick = setInterval(function () {
      jobStep(lastText + '  (' + Math.round((Date.now() - t0) / 1000) + 's)');
    }, 1000);
    function stop() { clearInterval(tick); jobEnd(); }
    return Recommend.syncAll(week, S.league.me, function (t, p) {
      lastText = 'Advice: ' + t;
      jobStep(lastText + '  (' + Math.round((Date.now() - t0) / 1000) + 's)', p);
    }).then(function () { stop(); render(); }, function () { stop(); render(); });
  }
  function wireGestures() {
    if (!window.Gestures) return;
    try {
      Gestures.init({
        tabs: tabList,
        current: function () { return view; },
        go: goTab,
        viewEl: function () { return $('view'); },
        scrollTop: curScroll,
        blocked: function () { return modalOpen() || busy || jobRunning('advice'); },
        refreshLabel: function () {
          return isAdviceView() ? 'Refreshing week ' + week + ' advice…'
                                    : view === 'stats' ? 'Refreshing stats…'
                                    : 'Refreshing week ' + week + '…';
        },
        refresh: function () {
          if (window.Schedule) { try { Schedule.refresh(week, true); } catch (e) { } }
          if (isAdviceView()) return adviceSyncQuiet();
          if (view === 'stats') return Stats.refresh();
          /* NOT quiet. A pull is a deliberate act, so it gets the same progress
             bar the Sync week button gets — "box score 3 of 8" is the
             difference between waiting and wondering whether it is stuck.
             2026-09-15e sweep: doSync() already calls render() itself on
             BOTH its success and its catch path (see the end of doSync
             below) — wrapping it in another .then(render)/.catch(render)
             here rendered the whole page a second time, on every pull-to-
             refresh on every tab but Advice and Stats, for nothing. */
          return doSync({ quiet: false });
        }
      });
    } catch (e) { /* a phone with no touch, or a stubbed DOM: buttons still work */ }
  }

  /* ---------- LONG-PRESS "VIEW STATS" (v6.0) -------------------------------
   * Tj: "Everywhere else in the app, make it so I can long press on a player
   * and press view stats, and it will show the stats for this player just
   * like in the stats tab."
   *
   * A second, SEPARATE delegated touch listener from Gestures — gestures.js
   * is deliberately app-blind (see its own header comment: "nothing here
   * reads Store, Schedule or the view state directly"), and this needs
   * Stats/Store, so it lives here instead of growing that seam a new
   * responsibility. Any element carrying data-player="name|pos|nfl" (see
   * markPlayer above) is a target.
   *
   * "Just like in the stats tab" is true by construction, not by keeping two
   * renderers in sync by hand: openPlayerStatsMenu below calls the exact
   * same Stats.openPlayerModal every search result on the Stats tab uses. */
  var LONGPRESS_MS = 500, LONGPRESS_SLOP = 10;
  var lpTimer = null, lpStart = null, lpSuppressClickUntil = 0, lpSuppressRow = null, lpEnabled = true;
  function findPlayerRow(node) {
    var n = node, depth = 0;
    while (n && n.nodeType === 1 && depth++ < 8) {
      if (n.getAttribute && n.getAttribute('data-player') !== null) return n;
      n = n.parentNode;
    }
    return null;
  }
  function parsePlayerAttr(v) {
    var p = String(v || '').split('|');
    return { name: p[0] || '', pos: p[1] || '', nfl: p[2] || '' };
  }
  function openPlayerStatsMenu(player) {
    if (!player.name) return;
    dialog(player.name, null, function (box, row, close) {
      var cancel = el('button', 'btn', 'Cancel');
      cancel.addEventListener('click', close);
      /* NOT `view` — this file keeps the current tab name in a module-level
         `view` (see the very top of this file). A local `var view` here
         shadowed it silently within this function; harmless today only
         because nothing in this function happens to read the outer one, the
         same landmine showPlayer()'s own `dlgRow` rename avoided elsewhere
         in this sweep. */
      var viewBtn = el('button', 'btn pri', 'View stats');
      viewBtn.addEventListener('click', function () { close(); Stats.openPlayerModal(statsCtx(), player); });
      row.appendChild(cancel); row.appendChild(viewBtn);
    });
  }
  function lpCancel() { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } lpStart = null; }
  function longPressStart(e) {
    lpCancel();
    if (!lpEnabled || !e.touches || e.touches.length !== 1) return;
    var row = findPlayerRow(e.target);
    if (!row) return;
    var t = e.touches[0];
    lpStart = { x: t.clientX, y: t.clientY };
    lpTimer = setTimeout(function () {
      lpTimer = null;
      lpSuppressClickUntil = Date.now() + 400;   /* the touchend's synthetic click never opens the row's own tap action too */
      lpSuppressRow = row;
      openPlayerStatsMenu(parsePlayerAttr(row.getAttribute('data-player')));
    }, LONGPRESS_MS);
  }
  function longPressMove(e) {
    if (!lpTimer || !lpStart || !e.touches || !e.touches.length) return;
    var t = e.touches[0];
    if (Math.abs(t.clientX - lpStart.x) > LONGPRESS_SLOP || Math.abs(t.clientY - lpStart.y) > LONGPRESS_SLOP) lpCancel();
  }
  function wireLongPress() {
    var d = document;
    if (!d || !d.addEventListener) return;
    d.addEventListener('touchstart', longPressStart, { passive: true });
    d.addEventListener('touchmove', longPressMove, { passive: true });
    d.addEventListener('touchend', lpCancel, { passive: true });
    d.addEventListener('touchcancel', lpCancel, { passive: true });
    /* capturing phase, so this runs and can stop the click BEFORE it ever
       reaches a row's own tap handler (e.g. showPlayer, or "Add" on a
       free-agent row). 2026-09-15e sweep: this used to suppress ANY click
       anywhere in the document for 400ms, not just the one synthetic click
       this exists to stop — so tapping Cancel or View in the dialog that
       openPlayerStatsMenu just opened (a separate DOM subtree, not the row)
       inside that same window silently did nothing. Scoped to clicks that
       land back on the SAME row that triggered the long press; the dialog's
       own buttons are never that row, so they were never meant to be caught
       by this at all. */
    d.addEventListener('click', function (e) {
      if (Date.now() < lpSuppressClickUntil && findPlayerRow(e.target) === lpSuppressRow) {
        e.stopPropagation(); e.preventDefault();
      }
    }, true);
    /* desktop/browser testing: right-click reaches the same menu */
    d.addEventListener('contextmenu', function (e) {
      var row = findPlayerRow(e.target);
      if (!row) return;
      e.preventDefault();
      openPlayerStatsMenu(parsePlayerAttr(row.getAttribute('data-player')));
    });
  }

  /* ---------- THE ANDROID BACK BUTTON (v4.7, revised) ---------------------
   * MainActivity used to defer to WebView.canGoBack(), which in a page that
   * never pushes a history entry is always false — so back quit the app from
   * anywhere, including with a confirm dialog open, which on Android is the
   * one place everybody presses it. The Activity now asks the page first and
   * only leaves if the page says it did nothing (and even then, MainActivity
   * backgrounds rather than closes — see its onKeyDown).
   *
   * Tj: "make it go back to the last thing inside the app" — jumping straight
   * to Live from six tabs deep was still wrong, just wrong in a different
   * direction: it threw away wherever he actually came from. navHistory (see
   * goTab) is the real trail of tabs visited, so back unwinds it one tab at a
   * time, same as the Android convention everywhere else on the phone.
   *
   * Order matters: a modal is the most recent thing he opened, so it goes
   * first; then unwind the tab trail; then let the Activity decide (which
   * now means "send to background", never "close"). */
  window.__onBack = function () {
    try {
      if (closeTopModal()) return true;
      if (navHistory.length) { goTab(navHistory.pop(), true); return true; }
    } catch (e) { /* never trap him in the app because a handler threw */ }
    return false;
  };
  function applyAdjust() {
    if (window.__setAdjust) window.__setAdjust(S.settings.adjTop || 0, S.settings.adjBot || 0);
  }
  function commitWeek() {
    S.settings.currentWeek = week; Store.save();
    if (window.Sim) Sim.invalidate();
    autoFillWeek(week);
    startLive();
    renderTop();
    freshenSchedule();      /* a different week has different kickoffs */
  }

  /* ---------- auto-default every lineup ----------
   * Tj asked for the dropdowns to stay but for each roster to already hold the
   * obvious starters. So: on boot, on every week change, and after any sync,
   * fill each team's empty slots with its best projected legal lineup —
   * skipping byes and anyone ruled out. Slots he has touched himself are
   * marked manual in the store and are never overwritten, so this can be left
   * on permanently without ever undoing a decision he made.
   * Opponent teams get the same treatment, because a live matchup total is
   * meaningless if the other nine rosters are empty. */
  /* One team's slice of autoFillWeek below, pulled out so the Lineups tab's
     "re-default" button can run it for just the two teams it shows (mine and
     this week's opponent) instead of looping all ten. Does not itself check
     S.settings.autoFill — callers that mean "only if auto-fill is on" (the
     background boot/sync path) check it once before looping; the button
     means it unconditionally, same as it always has. */
  function autoFillTeam(w, tid, deferSave) {
    if (!window.Recommend || !Recommend.autoLineup) return 0;
    var opp = (S.weekMeta[String(w)] && S.weekMeta[String(w)].opponents) || null;
    try {
      return Store.applyAuto(w, tid, Recommend.autoLineup(w, tid, opp), deferSave);
    } catch (e) { return 0; /* one bad roster must not stop the rest */ }
  }
  /* Runs at boot, on every Lineups render and after a sync: ONE save for the
     whole league, not one per team that changed (see Store.applyAuto). */
  function autoFillWeek(w) {
    if (!S.settings.autoFill) return 0;
    var total = 0;
    S.teams.forEach(function (t) { total += autoFillTeam(w, t.id, true); });
    if (total) Store.save();
    return total;
  }

  /* ---------- live refresh ----------
   * A cheap scoreboard poll decides whether anything is actually happening.
   * Only if a game is in progress does it pull box scores, so sitting on the
   * Live tab on a Tuesday costs one small request every few minutes rather
   * than sixteen every minute. Foreground only, by design: a background
   * service would need a notification channel and a wake lock for a number
   * that is meaningless when nobody is looking at it. */
  function stopLive() { if (live.timer) clearTimeout(live.timer); live.timer = null; }
  function startLive() {
    stopLive();
    if (!S.settings.liveRefresh) { live.next = 0; return; }
    scheduleLive(4000);
  }
  /* THE SINGLE PLACE A LIVE TIMER IS EVER ARMED. The sleep guard lives here
     rather than in appPause() because a request already in flight when the app
     is backgrounded will resolve LATER and re-arm from inside its own .then().
     Guarding only at the pause site would let exactly one timer escape, which
     is enough to keep the 45-second poll running forever. */
  function scheduleLive(ms) {
    stopLive();
    if (asleep) { live.next = 0; return; }
    live.next = Date.now() + ms;
    live.timer = setTimeout(liveTick, ms);
  }
  /* Injury designations move on their own clock — a practice report in the
     afternoon, a Friday-afternoon status change — independent of whether a
     game is actually live, so this rides the SAME poll rather than needing a
     second timer of its own (Tj, 2026-09-14: "it must be updated frequently
     so I know which of my players is injured"). loadNews has its own
     10-minute freshness cache (recommend.js), so this costs nothing on the
     ~98% of ticks where the last fetch is still fresh — it becomes a real
     network request roughly every 10 minutes at most, whether that lands
     during a 45s live-game cadence or a slow Tuesday 10-minute one. Only
     re-renders when a fetch actually landed (`!nc.reused`), never on the
     cache-hit no-op. */
  function freshenInjuries() {
    if (!window.Recommend || !Recommend.loadNews) return;
    try {
      /* 2026-09-15e sweep: this had no .catch — the surrounding try/catch
         only guards a SYNCHRONOUS throw from the call itself, not an async
         rejection from the promise it returns (a network failure, a parse
         error). liveTick's own Espn.weekGames call right after this one
         already catches its own rejection the same way; this was the one
         call on this exact poll that did not, left as an unhandled
         rejection every tick a fetch failed instead of a quiet no-op. */
      Recommend.loadNews(null).then(function (nc) {
        if (nc && !nc.reused) render();
      })['catch'](function () { /* offline or a bad feed: try again next tick */ });
    } catch (e) { /* never let an injury refresh break the score poll */ }
  }
  function liveTick() {
    if (busy) { scheduleLive(15000); return; }
    freshenInjuries();
    Espn.weekGames(S.settings.season, week, week > 18 ? 3 : 2).then(function (games) {
      /* FREE: this response already carries every kickoff time, and before
         v4.5 they were thrown away. The schedule badges and the pre-Sunday
         alert cost no extra request because of this line. */
      if (window.Schedule) { try { Schedule.ingest(week, games); } catch (e) { } }
      var i, inProg = 0, pre = 0, post = 0;
      for (i = 0; i < games.length; i++) {
        if (games[i].state === 'in') inProg++;
        else if (games[i].state === 'pre') pre++;
        else post++;
      }
      live.inProgress = inProg; live.err = ''; live.fails = 0;   /* the backoff resets */
      /* nothing live: check back rarely, and stop entirely once the week is
         complete and already synced */
      function idleNext() {
        var m = S.weekMeta[String(week)];
        if (!pre && m && m.synced && m.allFinal) { live.next = 0; return; }
        scheduleLive(pre ? 5 * 60000 : 10 * 60000);
      }
      /* THE CLOSING SYNC (2026-09-23): a game that has gone final since the
         last sync still owes its final box score — see Schedule.needsSync.
         Without this, Monday night's last minute was never captured and the
         week never became "final" without a manual Sync. */
      var tickWeek = week;
      var closing = !inProg && window.Schedule && Schedule.needsSync &&
        Schedule.needsSync(games, S.weekMeta[String(tickWeek)], function (id) {
          var c = (gcache.season === S.settings.season && gcache.week === tickWeek) ? gcache.byId[id] : null;
          return !!(c && c.final);
        });
      if (inProg > 0 || closing) {
        return doSync({ quiet: true }).then(function () {
          live.at = Date.now();
          if (inProg > 0) scheduleLive(Math.max(20, Number(S.settings.liveEvery) || 45) * 1000);
          else idleNext();
        });
      }
      live.at = Date.now();
      idleNext();
      return null;
    }).catch(function (e) {
      live.err = (e && e.message) ? e.message : String(e);
      /* BACK OFF, and say whether this is the network or the feed.
       * This used to re-arm at a flat 60s forever, so a phone in airplane mode
       * made a request a minute for as long as the app was open — and the
       * bridge already exposes online() precisely to tell "you are offline"
       * apart from "the feed is broken", which look identical at the socket
       * and are very different sentences to read. Doubling from a minute to a
       * ten-minute ceiling means a long outage costs a handful of attempts
       * instead of hundreds, and the first retry is still quick enough that a
       * blip is invisible. Any success resets it (see the top of liveTick). */
      var off = false;
      try { off = !!(window.Native && Native.online && !Native.online()); } catch (e2) { }
      if (off) live.err = 'offline';
      live.fails = (live.fails || 0) + 1;
      var wait = Math.min(600000, 60000 * Math.pow(2, Math.min(4, live.fails - 1)));
      scheduleLive(wait);
    }).then(function () { renderHeader(); });
  }
  /* ---------- SLEEPING WHEN THE APP IS NOT ON SCREEN --------------------
   * Tj: "make sure when the app is backgrounded that it properly sleeps and
   * doesn't hog ram or CPU or battery."
   *
   * It did not sleep at all. The comment above startLive() said the poll was
   * "Foreground only, by design" — and nothing whatsoever implemented that.
   * A backgrounded WebView keeps running its JS timers, so `liveTick` carried
   * on firing every 45 seconds all afternoon, and on a Sunday each of those
   * ticks pulled sixteen box scores. That is the battery and the mobile data,
   * spent on a screen nobody is looking at.
   *
   * Two independent triggers, because neither alone is sufficient:
   *   - MainActivity's onPause/onResume call these directly. That is the
   *     reliable signal, and it is what stops the timer BEFORE pauseTimers()
   *     freezes it mid-flight.
   *   - `visibilitychange` covers the cases Java does not see as a pause —
   *     the screen locking, or a split-screen window losing focus — and it is
   *     also what makes this testable and correct in a plain browser.
   *
   * Stopping is the easy half. RESUMING is where the thought is: coming back
   * must not fire a burst of catch-up requests. `liveTick` is scheduled fresh
   * with a short delay (so the screen is current within a couple of seconds)
   * and it re-derives everything from the scoreboard, which is the cheap
   * endpoint. Nothing is queued while asleep, so nothing can pile up. */
  /* BOTH GUARD ON `S`, not just the visibilitychange listener that calls them.
   * MainActivity calls window.__appResume() from onResume(), and on a cold
   * start onResume() can fire after this script has been evaluated but before
   * DOMContentLoaded has run boot() — at which point `S` does not exist yet and
   * `S.weekMeta` is a TypeError thrown straight into evaluateJavascript, where
   * nothing in the app will ever report it. The window is small and it is
   * exactly the launch path, which is the worst place to have one. */
  function appPause() {
    /* first, and even if already asleep: onPause is the last moment Android
       guarantees this page runs before it may kill the process, so a
       deferred write (Store.saveSoon — the open tab) must land now */
    try { if (window.Store && Store.flush) Store.flush(); } catch (e) { }
    try { if (window.Gamelog && Gamelog.flush) Gamelog.flush(); } catch (e) { }
    if (asleep) return;
    asleep = true;
    stopLive();                 /* the timer, not just its effects */
    live.next = 0;
    /* A stray touch during teardown must not switch a tab or start a fetch. */
    if (window.Gestures) { try { Gestures.enable(false); } catch (e) { } }
    lpEnabled = false; lpCancel();
  }
  function appResume() {
    if (!asleep) return;
    asleep = false;
    if (window.Gestures) { try { Gestures.enable(true); } catch (e) { } }
    lpEnabled = true;
    if (!S) return;             /* not booted yet; boot() starts the poll itself */
    /* Tj, 2026-09-15: "week 1 is complete... yet the app still has all
     * tabs open to week 1." Both checks run here (see the NFL WEEK
     * AUTO-ADVANCE comment above syncCurrentWeek's own definition for the
     * full history — this used to be boot()-only, then ESPN-check-only,
     * neither alone was reliable enough). localAutoAdvance() first: no
     * network, cannot fail, cannot be blocked by a stale cache. Placed
     * BEFORE the "week already final" branch below on purpose: a week
     * looking finished locally is precisely the state where the real NFL
     * week having moved on is likely, not a reason to skip checking. */
    localAutoAdvance();
    syncCurrentWeek();
    refreshPlayerDBIfStale();
    /* A week that is finished stays finished — do not wake a poll for it.
       syncCurrentWeek() above is fire-and-forget: its network round trip
       resolves after this synchronous function has already returned, so
       `week` here is still whatever was on screen when appResume() was
       called. That is fine — if this really is a stale, finished week,
       there is nothing worth polling for it either way, and if
       syncCurrentWeek() does find a real advance, applyCurrentWeek()
       (called from inside its own .then()) independently sets the new
       `week`, arms its own live poll and re-renders on its own schedule,
       decoupled from the rest of this function. */
    /* Coming back after a while is exactly when a flex-scheduling change would
       have landed, and it is cheap: refresh() only fetches if the stored copy
       is over three hours old — and freshenSchedule() skips it entirely when
       the poll armed just below is about to fetch the same scoreboard. */
    var m = S.weekMeta[String(week)];
    if (m && m.synced && m.allFinal) { freshenSchedule(); renderHeader(); return; }
    if (!S.settings.liveRefresh) { freshenSchedule(); renderHeader(); return; }
    /* 1.5s, not 0: the WebView is still restoring and a request fired into
       that costs a frame of jank for no freshness anyone can perceive. */
    scheduleLive(1500);
    freshenSchedule();
    renderHeader();
  }
  /* `window`, not `root`. Every OTHER module in this app is
   * `(function (root) { ... })(window)`, but ui.js is a bare
   * `(function () { ... })()` — the only `root` in this file is the local view
   * container inside render() and the view functions. Writing `root.__appPause`
   * here, out of habit from the other twelve files, is a ReferenceError at
   * SCRIPT LOAD, which means the app does not boot at all. It is pinned by
   * test_lifecycle.js, which loads ui.js against a DOM stub for exactly this
   * class of mistake — nothing else in the suite executes this file. */
  window.__appPause = appPause;
  window.__appResume = appResume;
  if (document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      /* `S` does not exist until boot() runs, and this listener is registered
         at load time — a visibility change in that window must not throw. */
      if (!S) return;
      if (document.hidden) appPause(); else appResume();
    }, false);
  }

  function liveText() {
    if (asleep) return 'asleep';
    if (!S.settings.liveRefresh) return 'live off';
    if (live.err === 'offline') return 'offline — will retry';
    if (live.err) return 'live: ' + live.err;
    if (live.inProgress) return live.inProgress + ' game' + (live.inProgress === 1 ? '' : 's') +
      ' live · updating every ' + (Number(S.settings.liveEvery) || 45) + 's';
    if (!live.next) return 'week complete';
    return 'watching for kickoff';
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var names = { live: 'Live', lineups: 'Lineups', rosters: 'Roster', wire: 'Wire',
                  stats: 'Stats', data: 'Data' };
    $('title').textContent = names[view] || 'Tracker';
    $('wkLabel').textContent = 'Wk ' + week;
    var m = S.weekMeta[String(week)];
    if (!m || !m.synced) $('syncText').textContent = 'not synced · ' + liveText();
    else $('syncText').textContent = (m.allFinal ? 'final'
        : (m.failed && !m.inProgress ? m.failed + ' box score' + (m.failed === 1 ? '' : 's') + ' missing'
                                     : 'in progress')) +
        ' · ' + m.games + ' games · updated ' +
        (live.at ? new Date(live.at).toTimeString().slice(0, 5) : m.at.slice(11, 16) + 'Z') +
        (m.estFG ? ' · FG est' : '') + ' · ' + liveText();
    $('syncBtn').textContent = busy ? '…' : 'Sync week';
    $('syncBtn').disabled = busy;
  }

  /* The canary is worthless in a log nobody opens, so it is the first thing
     on the Data tab in red — moved off Live when that tab was cut down to
     just the my-vs-opponent scoreboard (v5.2). It only appears when a sync
     actually saw something wrong — a renamed scoring column, or coverage
     that collapsed. */
  function feedWarnBanner() {
    var wm = S.weekMeta[String(week)];
    if (!wm || !wm.feedWarn) return null;
    var c = el('div', 'card warn');
    c.appendChild(el('h2', null, 'Check the scores this week'));
    c.appendChild(el('p', null, wm.feedWarn));
    c.appendChild(el('p', 'muted', 'Everything else still ran. Data → Sync & data → Run feed self-test ' +
      'will say which part of the parse changed.'));
    return c;
  }

  /* ---------- LIVE ----------
   * Tj, to a different session: "the only thing I want on the live tab is my
   * team roster... and the points calculated in real time on one side... and
   * on the other side my opponent's points... nothing else should be in the
   * live tab." So this is ONLY the my-vs-opponent card — no feed-warning
   * banner (moved to Data), no early-game alert (stays on Lineups, where he
   * still edits a roster), no other matchups, no idle-teams list. He only
   * cares about his own matchup and never scrolls past anything to find it,
   * because there is nothing else on the screen. */
  function viewLive(root) {
    var mus = Store.getMatchups(week);
    var mine = null;
    mus.forEach(function (pair) {
      if (pair[0] === S.league.me || pair[1] === S.league.me) mine = pair;
    });
    if (!mine) {
      var c = el('div', 'card');
      c.appendChild(el('h2', null, 'No opponent set for week ' + week));
      c.appendChild(el('p', 'muted', 'Add this week\'s matchup under Data → League → Add matchup.'));
      var b = el('button', 'btn pri', 'Set up week ' + week + ' matchup');
      /* straight to League, where the matchups are — Data remembers its last
         sub-screen, so a bare goTab('data') could land on Claude or App */
      b.addEventListener('click', function () { dataSubView = 'league'; goTab('data'); });
      c.appendChild(b); root.appendChild(c);
      return;
    }
    var me = mine[0] === S.league.me ? mine[0] : mine[1];
    var them = mine[0] === S.league.me ? mine[1] : mine[0];
    root.appendChild(myMatchupCard(me, them));
  }
  /* The headline section: my team's live score on the left, my opponent's on
     the right, as two separate boxes rather than one merged card — each is
     self-contained (name, live total, its own open lineup) so either can be
     read, and tapped into, without the other. A shared banner above still
     says who is leading, because that comparison belongs to neither side
     alone. Every player row in BOTH boxes is tappable (via lineupDetail ->
     showPlayer), which is what shows the live stat line behind a score. */
  /* PROJECTED FINISH (2026-09-23) — what ESPN, Sleeper and Yahoo all put
   * under a live score: points already banked plus this app's own weekly
   * projection (Recommend.projectAll — the same numbers that set the
   * auto-lineup) for every starter whose game has NOT started. A starter who
   * is mid-game counts only what he has scored so far, so the figure never
   * claims more than it knows. Before kickoff it replaces a banner that just
   * said "Level" at 0.0-0.0. null when there is nothing to project. */
  /* id -> this week's projection object for one team (Recommend.projectAll,
     the numbers the auto-lineup uses). Computed once per team per render and
     handed to both the projected finish and the per-starter rows. */
  function weekProjById(teamId) {
    var byId = {};
    if (!window.Recommend || !Recommend.projectAll) return byId;
    try {
      var wm = S.weekMeta[String(week)];
      Recommend.projectAll(week, teamId, (wm && wm.opponents) || null).forEach(function (x) {
        if (x.p) byId[x.p.id] = x;
      });
    } catch (e) { /* no projections: the scores still render */ }
    return byId;
  }
  /* His game is over and he has no line — inactive, a DNP: he adds nothing
     more, whatever he was projected for. projectedFinish() has always said
     so; the rows and the "yet to play" count under it now agree (full test
     2026-09-24: an inactive starter read "1 yet to play", in the pending
     style, with "p 14.2" under his 0.0, long after his game had ended). */
  function doneNoLine(d) {
    if (!d.pid || d.played || d.onBye || !d.player || !window.Schedule) return false;
    var b = null;
    try { b = Schedule.badge(d.player.nfl, week); } catch (e) { b = null; }
    return !!(b && b.done);
  }
  function projectedFinish(teamId, res, byIdIn) {
    var wm = S.weekMeta[String(week)];
    if (wm && wm.allFinal) return null;          /* the week is over: no guessing */
    var yet = res.detail.filter(function (d) {
      return d.pid && !d.played && !d.onBye && !doneNoLine(d);
    });
    if (!yet.length || !window.Recommend || !Recommend.projectAll) return null;
    var byId = byIdIn || weekProjById(teamId), add = 0;
    yet.forEach(function (d) { add += Number(byId[d.pid] && byId[d.pid].proj) || 0; });
    return res.total + add;
  }
  function myMatchupCard(meId, oppId) {
    var A = Store.team(meId), B = Store.team(oppId);
    var ra = Store.teamWeekPoints(week, meId), rb = Store.teamWeekPoints(week, oppId);
    var ja = weekProjById(meId), jb = weekProjById(oppId);
    var pa = projectedFinish(meId, ra, ja), pb = projectedFinish(oppId, rb, jb);
    var wrap = el('div');
    var head = el('div', 'card me');
    head.appendChild(el('h2', null, 'Your matchup · week ' + week));
    var diff = ra.total - rb.total;
    var started = ra.detail.concat(rb.detail).some(function (d) { return d.played; });
    var banner;
    if (!started && diff === 0 && pa !== null && pb !== null) {
      var pd = pa - pb;
      banner = el('div', 'banner');
      banner.textContent = 'Projected ' + fmt(pa) + ' – ' + fmt(pb) +
        (Math.abs(pd) < 0.05 ? ' · even' : (pd > 0 ? ' · you by ' + fmt(pd) : ' · them by ' + fmt(-pd)));
    } else {
      banner = el('div', 'banner' + (diff > 0 ? ' good' : (diff < 0 ? ' bad' : '')));
      banner.textContent = diff === 0 ? 'Level' :
        (diff > 0 ? 'You lead by ' + fmt(diff) : 'You trail by ' + fmt(-diff));
    }
    head.appendChild(banner);
    wrap.appendChild(head);

    var cols = el('div', 'mu2');
    cols.appendChild(liveScoreBox(A, ra, true, pa, ja));
    cols.appendChild(liveScoreBox(B, rb, false, pb, jb));
    wrap.appendChild(cols);
    return wrap;
  }
  /* One team's live score box: name, running total, how many starters are
     still to play, then that team's lineup — open, and every row tappable
     for the live stat breakdown behind its points. Used for both halves of
     the split Live-tab matchup, mine and my opponent's alike. */
  function liveScoreBox(team, res, isMine, proj, projById) {
    var c = el('div', 'card halfbox' + (isMine ? ' me' : ''));
    c.appendChild(el('h2', null, team.name));
    c.appendChild(el('div', 'bigfig', fmt(res.total)));
    var yet = res.detail.filter(function (d) {
      return d.pid && !d.played && !d.onBye && !doneNoLine(d);
    }).length;
    c.appendChild(el('div', 'sub muted', yet + ' yet to play' +
      (proj !== null && proj !== undefined ? ' · proj ' + fmt(proj) : '')));
    c.appendChild(openLineup(team, res, projById));
    return c;
  }
  function openLineup(team, res, projById) {
    var d = lineupDetail(team, res, projById);
    d.open = true;
    return d;
  }
  /* "Matthew Stafford" -> "M. Stafford": the standard fantasy-app shorthand
   * (ESPN, Yahoo and everyone else do this in a tight space), used ONLY in
   * the Live tab's side-by-side matchup below — half a 390px phone screen,
   * split further by a slot column and a points column, leaves the name
   * itself maybe 15-18 characters at the halfbox's reduced font-size before
   * .row .nm's ellipsis (app.css) cuts it off mid-word. A kickoff badge or
   * health tag sharing that same nowrap flex box (see the comment on the
   * "to play" tag below) makes it worse. Full names elsewhere in the app
   * have room and stay full — this is scoped to lineupDetail() alone,
   * which nothing but the Live tab's two-column view calls. A defense gets
   * its nickname instead of an initial ("S. Seahawks" is not how anyone
   * refers to one), and anything that is not "first last" shaped is left
   * alone rather than risk mangling a name this cannot parse correctly. */
  function shortName(name, pos) {
    var s = String(name || '');
    /* A defence goes by its nickname in every fantasy app ("Seahawks D/ST"),
       never its city: "Seattle Seahawks" was the one name on the Live tab
       that reliably hit the ellipsis ("Seattle Seah..."). The row's small
       text already says DEF and the team code. */
    if (pos === 'DEF') {
      var d = s.replace(/\s+(d\/st|dst|defen[cs]e)$/i, '').split(' ');
      return d[d.length - 1] || s;
    }
    var parts = s.split(' ');
    if (parts.length < 2 || !parts[0]) return s;
    return parts[0].charAt(0) + '. ' + parts.slice(1).join(' ');
  }
  function lineupDetail(team, res, projById) {
    var d = el('details');
    var s = el('summary', null, team.name + ' lineup ▾');
    d.appendChild(s);
    var flagsById = healthFlags(team.id, weekOpponents());
    res.detail.forEach(function (x) {
      var r = el('div', 'row');
      r.appendChild(el('div', 'slot', x.slot));
      var nm = el('div', 'nm');
      if (!x.pid) { nm.appendChild(el('span', 'muted', '— empty —')); }
      else {
        if (x.player) markPlayer(r, x.player.name, x.player.pos, x.player.nfl);
        nm.appendChild(document.createTextNode(x.player
          ? shortName(x.player.name, x.player.pos) : '?'));
        var sm = el('small', null, ' ' + (x.player ? x.player.pos + ' ' + x.player.nfl : ''));
        nm.appendChild(sm);
        var gb0 = x.player ? gameBadge(x.player.nfl) : null;
        if (gb0) nm.appendChild(gb0);
        if (x.onBye) nm.appendChild(el('span', 'tag out', 'bye'));
        /* "TO PLAY" only when there is no kickoff badge. With one, the row read
           "Bo Nix QB DEN Sun 4:05p TO PLAY" — the badge already says the game
           has not happened, and says WHEN, which the tag never did. The cost was
           not just noise: .row .nm is nowrap with text-overflow:ellipsis, so on a
           narrower phone or a longer name the redundant tag is what pushes the
           PLAYER'S NAME into the ellipsis. Kept when the schedule is unknown, so
           nothing is lost when there is no badge to replace it. */
        else if (!x.played && !gb0) nm.appendChild(el('span', 'tag', 'to play'));
        /* the dedicated "bye" tag above already covers that flag; skip it
           here so a bye player never shows it twice */
        appendHealthTags(nm, (flagsById[x.pid] || []).filter(function (f) {
          return f.text.indexOf('ON BYE') !== 0;
        }));
      }
      r.appendChild(nm);
      var over = doneNoLine(x);
      var p = el('div', 'pts' + (x.onBye ? ' bye' : (x.played || over ? '' : ' pend')), x.onBye ? '0.0' : fmt(x.pts));
      /* Until his game starts, his projection sits under the 0.0 (2026-09-23b,
         Tj's pick #2 — ESPN and Sleeper both do this). Once he has played —
         or his game has ended without him — only the real points show. */
      var pj = (projById && x.pid && !x.played && !x.onBye && !over) ? projById[x.pid] : null;
      if (pj) {
        p.classList.add('hasproj');
        var pp = el('small', 'pproj', 'p ' + fmt(pj.proj));
        pp.setAttribute('aria-label', 'projected ' + fmt(pj.proj));
        p.appendChild(pp);
      }
      r.appendChild(p);
      r.addEventListener('click', function () { if (x.pid) showPlayer(x.pid); });
      d.appendChild(r);
    });
    return d;
  }
  /* BEFORE KICKOFF THERE IS NO STAT LINE, AND THAT USED TO BE A DEAD END.
   * Every player row on the Live tab is tappable, and `Store.lineFor` returns
   * nothing until the week has been synced — so on any day before the games
   * (which is most days, and exactly when you are deciding a lineup) tapping a
   * player produced a toast saying "no stats synced" and nothing else.
   * The app already knows plenty about him at that moment: what it projects,
   * when he plays, who he plays, and what the injury feed and Claude said. All
   * of it was computed and none of it was reachable. This shows that instead.
   * The manual-adjustment editor below is unchanged and still only appears once
   * there IS a line to adjust — there is nothing to correct before kickoff. */
  function showPlayerPreGame(rec) {
    var p = rec.player, lines = [];
    var b = window.Schedule ? Schedule.badge(p.nfl, week) : null;
    var row = null;
    try {
      var opp = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
      var all = Recommend.projectAll(week, rec.team.id, opp), i;
      for (i = 0; i < all.length; i++) if (all[i].p && all[i].p.id === p.id) row = all[i];
    } catch (e) { /* the schedule and the roster facts below still stand */ }

    lines.push(p.pos + '  ·  ' + p.nfl + (rec.team ? '  ·  ' + rec.team.name : ''));
    if (b) lines.push('Kicks off ' + b.text + '  ' + b.opp +
                      (b.early ? '   — BEFORE SUNDAY' : ''));
    else lines.push('No kickoff known for week ' + week + ' yet.');
    if (row && row.onBye) lines.push('ON A BYE in week ' + week + ' — he scores 0.');
    if (row && typeof row.proj === 'number') {
      lines.push('Projected ' + fmt(row.proj) + ' points in this league\'s scoring.');
    }
    if (row && row.h && row.h.label) {
      lines.push('');
      lines.push('Injury feed: ' + row.h.label + (row.h.note ? ' — ' + row.h.note : ''));
    }
    if (row && row.ai && row.ai.reason) {
      lines.push('');
      lines.push('Claude (' + (row.ai.confidence || 'low') + '): ' + row.ai.reason);
    }
    if (row && row.why && row.why.length) {
      lines.push('');
      lines.push('How that number was built:');
      row.why.forEach(function (w) { lines.push('  ' + w); });
    }
    lines.push('');
    lines.push('Nothing has been scored for week ' + week + ' yet, so there is no ' +
               'stat line to correct. Sync the week once his game has finished.');
    modal(p.name, lines.join('\n'));
  }

  function showPlayer(pid) {
    var rec = Store.playerById(pid); if (!rec) return;
    var line = Store.lineFor(week, pid);
    if (!line) { showPlayerPreGame(rec); return; }
    var sc = Scoring.score(line);
    /* The manual adjustment is the escape hatch for the two things the feed
       cannot settle by itself: the league-wide longest-play bonuses, which are
       decided across every game and not always resolvable, and a rare
       mis-parse. It survives a re-sync because it lives on the stat line, and
       it always shows up as its own labelled row so nothing is ever silently
       fudged.
       Tj: "when I press a player to see his stats, the android keyboard
       automatically appears because of the manual adjustment feature and its
       number field." dialog() focuses the first input/button it finds in the
       modal, and a number input WAS the first thing here — so opening any
       already-scored player's card popped the keyboard uninvited. The field
       now only exists in the DOM once "Adjust" is pressed, which is a
       deliberate tap and earns the keyboard it summons. */
    var wrap = el('div');
    var adjBtn = el('button', 'btn', 'Adjust');
    var form = el('div'); form.hidden = true;
    form.style.marginTop = '8px';
    form.appendChild(el('label', 'f', 'Manual adjustment (points)'));
    var inp = el('input'); inp.type = 'number'; inp.step = '0.5';
    inp.value = String(Number(line.manualAdj) || 0);
    inp.style.width = '100%';
    form.appendChild(inp);
    var row = el('div', 'kv'); row.style.marginTop = '8px';
    [['+5 longest play', 5], ['−5', -5], ['Clear', 0]].forEach(function (b) {
      var btn = el('button', 'btn sm', b[0]);
      btn.addEventListener('click', function () {
        inp.value = b[1] === 0 ? '0' : String((Number(inp.value) || 0) + b[1]);
      });
      row.appendChild(btn);
    });
    form.appendChild(row);
    /* opportunity over the last three weeks, above the points. Touches are what
       predict next week; points are what happened last week. Fixed part of
       the body — unaffected by the adjustment below, computed once. */
    var trend = window.Value ? Value.usageText(rec.player.name, week + 1) : '';
    function bodyTextFor(scObj) {
      return fmt(scObj.total) + ' points\n\n' +
        (scObj.parts.length
          ? scObj.parts.map(function (p) { return '  ' + p.label + '   ' + (p.pts > 0 ? '+' : '') + fmt(p.pts); }).join('\n')
          : '  no scoring plays') +
        (trend ? '\n\nOpportunity\n  ' + trend.split('   ·   ').join('\n  ') : '');
    }
    /* NOT modal() here (found in the 2026-09-15e sweep): modal()/dialog()
     * write the <pre> body ONCE at open time with no way back into it, so
     * "Save adjustment" updated the toast and the page underneath but left
     * the modal showing the OLD total and breakdown frozen on screen right
     * above the button that just changed them — the one action this dialog
     * exists to offer, visibly not reflected by it. dialog() is called
     * directly instead, building the <pre> here (same markup/styling
     * dialog() itself would have used) so the save handler can rewrite its
     * text in place. */
    var preEl;
    /* NOT `row` for the dialog's own button row below — this function
       already has an outer `row` (the +5/-5/Clear buttons above) in scope,
       and shadowing it here would be exactly the kind of landmine a later
       edit could trip over even though nothing reads the wrong one today. */
    dialog(rec.player.name + ' · week ' + week, null, function (box, dlgRow, close) {
      preEl = el('pre');
      preEl.style.cssText = 'white-space:pre-wrap;font-size:13px;margin:0 0 12px;' +
        'font-family:inherit;line-height:1.5';
      preEl.textContent = bodyTextFor(sc);
      box.appendChild(preEl);
      box.appendChild(wrap);
      var ok = el('button', 'btn pri', 'Close');
      ok.addEventListener('click', close);
      dlgRow.appendChild(ok);
    });
    var save = el('button', 'btn pri', 'Save adjustment');
    save.style.marginTop = '8px';
    save.addEventListener('click', function () {
      /* Store.setAdj, not a bare assignment to the line plus Store.save():
         the line lives in the archive file, which only a marked write
         reaches — the bare assignment was lost at the next cold start
         (test_retention.js) */
      Store.setAdj(week, pid, Number(inp.value) || 0);
      render();
      var freshSc = Scoring.score(Store.lineFor(week, pid) || line);
      if (preEl) preEl.textContent = bodyTextFor(freshSc);
      toast(rec.player.name + ' adjusted to ' + fmt(freshSc.total));
    });
    form.appendChild(save);
    adjBtn.addEventListener('click', function () {
      adjBtn.hidden = true;
      form.hidden = false;
      try { inp.focus(); } catch (e) { /* older WebView */ }
    });
    wrap.appendChild(adjBtn);
    wrap.appendChild(form);
  }

  /* ---------- LINEUPS ----------
   * Tj, to a different session: "only have me and my opponent in it... delete
   * all the other teams because I will not be entering their lineups." Just
   * these two teams are shown, resolved off the schedule so it follows him
   * into a new opponent every week with nothing to configure. The other ~8
   * teams still auto-fill in the background (autoFillWeek runs for the whole
   * league regardless of this screen) so whichever of them rotates in as a
   * future opponent already has a lineup ready — he never has to touch them
   * here. */
  function viewLineups(root) {
    addSafe(root, 'The early-game alert', earlyGameCard);
    var mine = Store.team(S.league.me), them = null;
    Store.getMatchups(week).forEach(function (pair) {
      if (pair[0] === S.league.me) them = Store.team(pair[1]);
      else if (pair[1] === S.league.me) them = Store.team(pair[0]);
    });
    var head = el('div', 'card');
    head.appendChild(el('h2', null, 'Week ' + week + ' lineups'));
    head.appendChild(el('p', 'muted',
      'Every roster is defaulted to its most likely starters — best projected ' +
      'legal lineup, byes and ruled-out players skipped. Change any slot with ' +
      'its dropdown; a slot you pick yourself is marked "yours" and auto-fill ' +
      'will never move it again.'));
    var togg = el('button', 'btn' + (S.settings.autoFill ? ' pri' : ''),
      S.settings.autoFill ? 'Auto-default: ON' : 'Auto-default: OFF');
    togg.addEventListener('click', function () {
      S.settings.autoFill = !S.settings.autoFill; Store.save();
      if (S.settings.autoFill) autoFillWeek(week);
      render();
    });
    head.appendChild(togg);
    /* WHY THIS BUTTON USED TO LIE (Tj, 2026-09-07: "when I make changes to
     * lineups then press the re-default all teams now button it always says
     * nothing to change even when I made several changes away from the
     * default").
     *
     * He was right and the button was broken in the most confusing way
     * available: it did exactly nothing and then reported success at doing
     * nothing. The cause is that `Store.applyAuto` skips any slot marked
     * manual — `if (M[key]) continue;` — which is the correct and load-bearing
     * contract for the AUTOMATIC fills that run on boot, on every week change
     * and after every sync. Those must never silently undo a decision Tj made.
     *
     * But this button is not an automatic fill. It is Tj explicitly asking for
     * the defaults back, and every hand-edit he makes marks that slot manual,
     * so the more changes he made the more certainly the button did nothing.
     * The per-team "Reset to auto" fifty lines below had it right all along:
     * it calls clearManual FIRST. This is now the same operation across every
     * team this screen shows.
     *
     * It asks first, because discarding hand-picks is exactly the kind of
     * thing that must not happen on a mis-tap — and unlike the old version, it
     * can now say how many picks are at stake.
     *
     * Scoped to just the two teams this screen shows: Tj said he will never
     * enter a lineup for any team but his own and this week's opponent, so a
     * button that reset all ten was resetting eight teams he cannot even see
     * here. The other eight still auto-fill on their own every week
     * (autoFillWeek runs for the whole league regardless of this screen) —
     * this button just no longer touches them. */
    var shown = [mine]; if (them) shown.push(them);
    var refill = el('button', 'btn');
    refill.textContent = them ? 'Re-default both lineups now' : 'Re-default my lineup now';
    refill.style.marginTop = '8px';
    refill.addEventListener('click', function () {
      var manual = 0;
      shown.forEach(function (t) {
        var M = (S.lineupManual[String(week)] || {})[t.id] || {}, k;
        for (k in M) if (Object.prototype.hasOwnProperty.call(M, k)) manual++;
      });
      function go() {
        shown.forEach(function (t) { Store.clearManual(week, t.id); });
        var was = S.settings.autoFill;
        S.settings.autoFill = true;
        var n = 0;
        shown.forEach(function (t) { n += autoFillTeam(week, t.id); });
        S.settings.autoFill = was;
        if (window.Sim) Sim.invalidate();
        render();
        toast(n ? (n + ' slot' + (n === 1 ? '' : 's') + ' updated'
                     + (manual ? ' · ' + manual + ' of your picks replaced' : ''))
                : (shown.length > 1 ? 'Both teams already hold their recommended lineup'
                                     : 'Your team already holds its recommended lineup'));
      }
      if (!manual) { go(); return; }
      confirmModal('Re-default ' + (shown.length > 1 ? 'both lineups' : 'your lineup') + '?',
        'You have hand-picked ' + manual + ' slot' + (manual === 1 ? '' : 's') +
        ' in week ' + week + '. Re-defaulting throws ' + (manual === 1 ? 'it' : 'those') +
        ' away and fills ' + (shown.length > 1 ? 'both teams' : 'your team') +
        ' with the best projected legal lineup instead.\n\n' +
        'Nothing else is touched — rosters, scores and matchups all stay as they ' +
        'are, and you can change any slot straight back afterwards.\n\n' +
        'Any player whose game has already kicked off keeps his slot. Re-' +
        'defaulting cannot move him, and it would corrupt this week\'s scores ' +
        'if it could.',
        'Replace my picks', go, true);
    });
    head.appendChild(refill);
    root.appendChild(head);
    root.appendChild(lineupCard(mine));
    if (them) root.appendChild(lineupCard(them));
    else {
      var nc = el('div', 'card');
      nc.appendChild(el('h2', null, 'No opponent set for week ' + week));
      nc.appendChild(el('p', 'muted', 'Add this week\'s matchup under Data → League → Add matchup ' +
        'to see their lineup here.'));
      root.appendChild(nc);
    }
  }
  function lineupCard(t) {
    var c = el('div', 'card' + (t.id === S.league.me ? ' me' : ''));
    var h = el('h2', null, t.name + (t.id === S.league.me ? '  ★' : ''));
    c.appendChild(h);
    var keys = Store.slotKeys();
    var L = Store.getLineup(week, t.id);
    var locks = Store.lockedSlots(week, t.id);
    var flagsById = healthFlags(t.id, weekOpponents());
    var manualCount = 0, lockCount = 0;
    keys.forEach(function (k) {
      var isMan = Store.isManual(week, t.id, k.key);
      var isLock = !!locks[k.key];
      if (isMan) manualCount++;
      if (isLock) lockCount++;
      /* "locked" beats "yours"/"auto" in the label: once he has kicked off,
         who chose him stopped mattering and whether he can still be changed
         is the only question the row is being asked. */
      var lab = el('label', 'f', k.label +
        (isLock ? '  · ● started' : (isMan ? '  · yours' : (L[k.key] ? '  · auto' : ''))));
      /* WHEN DOES THE MAN IN THIS SLOT ACTUALLY PLAY? On the Lineups tab this
         is the single most useful fact on the row: a Thursday starter is a
         decision with a deadline, and every other slot can wait. */
      if (L[k.key]) {
        var lp = Store.playerById(L[k.key]);
        if (lp) {
          /* BUG (pre-existing, found 2026-09-15): Store.playerById returns
             {team, player}, not the player itself — lp.nfl was always
             undefined, so this badge never showed on the Lineups tab. */
          markPlayer(lab, lp.player.name, lp.player.pos, lp.player.nfl);
          var lb = gameBadge(lp.player.nfl); if (lb) lab.appendChild(lb);
          appendHealthTags(lab, flagsById[L[k.key]]);
        }
      }
      var sel = el('select');
      /* stable identity so the re-render can hand focus back to this exact
         slot instead of dropping it on <body> */
      sel.setAttribute('data-fk', 'ln|' + t.id + '|' + k.key);
      sel.appendChild(new Option('— empty —', ''));
      var opts = Store.eligible(t.id, k.pos);
      /* players already used in another slot are shown but marked */
      opts.forEach(function (p) {
        var usedIn = null, kk;
        for (kk in L) if (L[kk] === p.id && kk !== k.key) usedIn = kk;
        var bye = Store.isOnBye(p, week) ? ' [BYE]' : '';
        /* the kickoff goes in the option text too — an <option> cannot carry a
           styled child, and when you are CHOOSING between two receivers "one
           of them plays Thursday" is exactly the tiebreak you want in view */
        var gw = '';
        if (window.Schedule) {
          try { var gbb = Schedule.badge(p.nfl, week); if (gbb) gw = '  ' + gbb.text; }
          catch (e) { gw = ''; }
        }
        var o = new Option(p.name + ' (' + p.pos + ' ' + p.nfl + ')' + bye + gw +
                           (usedIn ? '  → ' + usedIn : ''), p.id);
        sel.appendChild(o);
      });
      sel.value = L[k.key] || '';
      if (isLock) sel.className = 'locked';
      /* the 4th argument is what marks this as HIS choice, not the app's */
      sel.addEventListener('change', function () {
        var newPid = this.value;
        /* The AUTO-fill can never touch a started slot; Tj still can, because
           this app mirrors a league actually run on RTSports and he sometimes
           has to correct a slot after the fact to match what RTSports had.
           But it is never what he MEANT to do, so it asks once. */
        if (isLock || (newPid && Store.isLocked(week, newPid))) {
          var self = this, prev = L[k.key] || '';
          confirmModal('That game has already started',
            'Changing this slot will not change what actually happened in your ' +
            'league — it only changes what this app shows. Do it if you are ' +
            'correcting the app to match RTSports; otherwise leave it alone.',
            'Change it anyway', function () {
              Store.setSlot(week, t.id, k.key, newPid, true);
              if (window.Sim) Sim.invalidate();
              render();
            }, true);
          self.value = prev;
          return;
        }
        Store.setSlot(week, t.id, k.key, newPid, true);
        if (window.Sim) Sim.invalidate();   /* the win probability depends on it */
        render();
      });
      c.appendChild(lab); c.appendChild(sel);
    });
    var filled = 0; keys.forEach(function (k) { if (L[k.key]) filled++; });
    var byeCount = 0;
    keys.forEach(function (k) {
      if (!L[k.key]) return;
      var r = Store.playerById(L[k.key]);
      if (r && Store.isOnBye(r.player, week)) byeCount++;
    });
    var st = el('div', 'kv');
    st.appendChild(el('span', byeCount ? 'warnText' : null,
      filled + '/' + keys.length + ' filled · ' + manualCount + ' set by you' +
      (lockCount ? '  ·  ' + lockCount + ' started' : '') +
      (byeCount ? '  ·  ' + byeCount + ' ON BYE' : '')));
    var b = el('button', 'btn sm', 'Copy wk ' + (week - 1));
    b.disabled = week <= 1;
    b.addEventListener('click', function () {
      Store.copyLineup(week - 1, week, t.id); render(); toast('Copied');
    });
    st.appendChild(b);
    var rb = el('button', 'btn sm', 'Reset to auto');
    rb.disabled = !manualCount;
    rb.addEventListener('click', function () {
      Store.clearManual(week, t.id);
      if (window.Sim) Sim.invalidate();
      /* THIS team only (full test 2026-09-24). It called autoFillWeek(),
         which refilled all ten rosters — even with Auto-default switched OFF,
         the one setting that says not to. autoFillTeam ignores the setting,
         which is right for a button pressed on purpose for this team. */
      autoFillTeam(week, t.id);
      render(); toast('Reset to the recommended lineup');
    });
    st.appendChild(rb);
    st.style.marginTop = '10px'; st.style.alignItems = 'center';
    c.appendChild(st);
    /* Say WHY the automation has stopped touching some of these. Without this,
       "Reset to auto" appearing to half-work looks like a bug rather than the
       rule it is — and an empty slot that auto-fill refuses to fill is the
       most confusing version of that. */
    if (lockCount) {
      c.appendChild(el('p', 'hint',
        lockCount + ' of these ' + (lockCount === 1 ? 'has' : 'have') + ' already ' +
        'kicked off, so the app will not change ' + (lockCount === 1 ? 'it' : 'them') +
        ' — auto-fill and "Reset to auto" both leave started slots alone. You can ' +
        'still edit one by hand if you are correcting the app to match RTSports.'));
    }
    return c;
  }

  /* ---------- ROSTERS ---------- */
  /* ---------- ROSTERS (v4.8) ----------
   * Tj: "instead of one long vertical scrolling section, organize the teams
   * into tabs so i can click on each team and see their roster." All ten
   * rosters used to render stacked on one screen; now one team shows at a
   * time, picked from a chip row built the same way the free-agent position
   * filter always has been (see .fchips/.fchip in app.css) — Roster tabs
   * without inventing a second tab widget.
   * `rosterSel` is module state, same pattern as `faPos`/`tradeSel` below:
   * it must survive a re-render (every click causes one) but does not need
   * to survive a tab switch away and back, so it is not part of Store. */
  var rosterSel = null;
  function viewRosters(root) {
    /* Tj: "move the trade evaluator to the very bottom, I want to see team
       rosters at the top." Rosters are what he opens this tab to see; the
       trade evaluator is a secondary tool underneath it, not the headline. */
    if (!rosterSel || !S.teams.some(function (t) { return t.id === rosterSel; })) {
      rosterSel = S.league.me;   /* land on Tj's own team first, every time */
    }
    var chips = el('div', 'fchips');
    S.teams.forEach(function (t) {
      var on = t.id === rosterSel;
      var b = el('button', 'fchip' + (on ? ' on' : ''),
                 t.id === S.league.me ? t.name + ' (you)' : t.name);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', function () { rosterSel = t.id; render(); });
      chips.appendChild(b);
    });
    root.appendChild(chips);

    var team = Store.team(rosterSel);
    if (team) addSafe(root, team.name + ' roster', function () { return teamRosterCard(team); });
    /* Below the roster he opened this tab to see, above the trade evaluator
       Tj asked to keep at the very bottom (2026-09-15c) — this card is about
       comparing his own team to the league, not a tool he reaches for first. */
    addSafe(root, 'How your team stacks up', teamAnalysisCard);
    addSafe(root, 'The trade evaluator', tradeCard);
  }
  /* The last week whose games are all in: the current week once it is
     final, otherwise the one before it. A half-played week would drag a
     season average down with games that have not happened yet. */
  function avgThroughWeek() {
    return Store.weekIsScored(week) ? week : week - 1;
  }
  /* Roster row actions (2026-09-23b, Tj's pick #6). Seventeen red "Drop"
     buttons down the page made the most destructive action in the app the
     loudest thing on it. One neutral "⋯" per row opens this instead; Drop is
     still here and still asks before it does anything. */
  function rosterRowMenu(t, p) {
    dialog(p.name, p.pos + ' · ' + p.nfl + ' · ' + t.name, function (box, row, close) {
      var cancel = el('button', 'btn', 'Cancel');
      cancel.addEventListener('click', close);
      var st = el('button', 'btn', 'Stats');
      st.addEventListener('click', function () {
        close(); Stats.openPlayerModal(statsCtx(), { name: p.name, pos: p.pos, nfl: p.nfl });
      });
      var dr = el('button', 'btn dan', 'Drop');
      dr.addEventListener('click', function () {
        close();
        confirmModal('Drop ' + p.name + '?',
          'Removes him from ' + t.name + ' in this app. It does not touch your ' +
          'league site — do the drop there as well.', 'Drop him', function () {
          Store.removePlayer(t.id, p.id);
          if (window.Sim) Sim.invalidate();
          render(); toast('Dropped ' + p.name);
        }, true);
      });
      row.appendChild(cancel); row.appendChild(st); row.appendChild(dr);
    });
  }
  function teamRosterCard(t) {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, t.name + ' · ' + t.players.length + ' players'));
    var order = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };
    var flagsById = healthFlags(t.id, weekOpponents());
    /* PROJ and AVG on every row (2026-09-23b, Tj's pick #1 — ESPN's roster
       view). PROJ is this app's own week projection for him, the same number
       that sets the auto-lineup; AVG is his season average per game played in
       THIS league's scoring (Store.playerAvg). */
    var projById = {};
    try {
      Recommend.projectAll(week, t.id, weekOpponents()).forEach(function (x) {
        if (x.p) projById[x.p.id] = x;
      });
    } catch (e) { /* the roster still lists without numbers */ }
    var thru = avgThroughWeek();
    var hd = el('div', 'row rhead');
    hd.appendChild(el('div', 'slot', ''));
    hd.appendChild(el('div', 'nm', 'Player'));
    hd.appendChild(el('div', 'pv', 'Proj'));
    hd.appendChild(el('div', 'rmore'));
    c.appendChild(hd);
    t.players.slice().sort(function (a, b) {
      if (order[a.pos] !== order[b.pos]) return order[a.pos] - order[b.pos];
      return Names.cmp(a.name, b.name);   /* no ICU start-up on first open */
    }).forEach(function (p) {
      var r = el('div', 'row');
      markPlayer(r, p.name, p.pos, p.nfl);
      r.appendChild(el('div', 'slot', p.pos));
      var nm = el('div', 'nm');
      nm.appendChild(document.createTextNode(p.name));
      nm.appendChild(el('small', null, '  ' + p.nfl + (p.bye ? ' · bye ' + p.bye : '')));
      /* after the team/bye text, matching every other player row in the app,
         so a roster reads  Name  CHI · bye 7 · Thu 8:20p  QUESTIONABLE — the
         " · " is needed: without it the row read "bye 7 Thu 8:20p", which
         says "bye 7 Thu" (full test 2026-09-24) */
      var gb1 = gameBadge(p.nfl);
      if (gb1) { gb1.textContent = ' · ' + gb1.textContent.replace(/^\s+/, ''); nm.appendChild(gb1); }
      /* the "· bye N" text just above already says so; skip the flag that
         would say it again as a second, identical-meaning tag */
      appendHealthTags(nm, (flagsById[p.id] || []).filter(function (f) {
        return f.text.indexOf('ON BYE') !== 0;
      }));
      r.appendChild(nm);
      var pj = projById[p.id], av = Store.playerAvg(p, thru);
      var pv = el('div', 'pv');
      pv.appendChild(el('b', null, pj ? (pj.onBye ? 'BYE' : fmt(pj.proj)) : '–'));
      pv.appendChild(el('small', null, av ? 'avg ' + fmt(av.avg) : 'avg –'));
      r.appendChild(pv);
      var x = el('button', 'btn sm rmore', '⋯');
      x.setAttribute('aria-label', 'Actions for ' + p.name);
      x.addEventListener('click', function () { rosterRowMenu(t, p); });
      r.appendChild(x);
      c.appendChild(r);
    });
    c.appendChild(addForm(t));
    return c;
  }

  /* ---------- ROSTERS: how your team stacks up (2026-09-17b) ----------
   * Tj: "ask Claude its overall take on my team versus every other team in
   * the league and recommendations on how to improve my team... similar to
   * other sections of this app where I can export and import Claude
   * replies." Same two-path shape as the Wire tab's "Ask Claude about the
   * wire" (see freeAgentCard above): a live-API button with a cost
   * estimate, and a handoffCard() export/import pair beneath it that works
   * with no key at all. TeamReport/Handoff/Ai own the data and the wording
   * of what is safe to show (an unverified player is flagged, never
   * hidden); this function only lays it out. */
  /* ---- a number worth showing, not worth waiting for (2026-09-23c) -------
   * Full-test finding. The Claude cost estimates build the ENTIRE prompt the
   * button would send — every roster in the league priced, or the whole wire
   * — only to count its characters. Measured in throttled Chromium: ~100ms of
   * a ~155ms first Roster open at Moto G speed, on a line nobody needs in the
   * first frame. If the estimate is already memoized it is written at once
   * (no flicker on later visits); otherwise the line paints empty and is
   * filled a moment after the screen is up. A re-render that replaced the
   * card in between (the node is detached) skips the fill — the new card
   * schedules its own. `est(cachedOnly)` is one of the estimate functions. */
  function fillAfterPaint(node, est, text) {
    var v = est(true);
    if (v !== undefined) { node.textContent = text(v); return; }
    node.textContent = '';
    afterPaint(function () {
      if (asleep || node.isConnected === false) return;
      try { node.textContent = text(est()); } catch (e) { node.textContent = ''; }
    });
  }
  /* Run fn once the screen has actually been painted: a frame callback runs
     just BEFORE the paint, and a zero timer queued from inside it runs just
     after. A bare setTimeout is not enough — when the render itself took
     longer than the delay, the overdue timer runs first and the paint waits
     for it, which is exactly what this exists to avoid. */
  function afterPaint(fn) {
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function () { setTimeout(fn, 0); });
    } else setTimeout(fn, 30);
  }
  var _taEstMemo = null;
  /* `cachedOnly`: answer only from the memo (undefined on a miss) — lets the
     card paint at once and fill the line in after (see fillAfterPaint) */
  function claudeTeamAnalysisEstimate(cachedOnly) {
    try {
      var mdl = Ai.depth() === 'cheap' ? Ai.cheapModel() : Ai.model();
      var gen = (window.Store && Store.generation) ? Store.generation() : 0;
      var k = week + '|' + S.league.me + '|' + gen + '|' + mdl + '|' + JSON.stringify(Usage.rates(mdl));
      if (_taEstMemo && _taEstMemo.k === k) return _taEstMemo.v;
      if (cachedOnly) return undefined;
      var ctx = TeamReport.context(week, S.league.me, weekOpponents(), S.league.season,
                                    new Date().toISOString().slice(0, 10));
      var promptChars = Ai.buildTeamAnalysisPrompt(ctx).length;
      /* no web_search on this call at all (see ai.js's own comment on
         askTeamAnalysis) — output is the only variable cost, sized to one
         verdict plus one line per other team plus a handful of
         recommendations */
      var outputTokens = 700 + ctx.rosters.length * 50;
      var v = Usage.money(Usage.estimate(promptChars, 0, outputTokens, mdl));
      _taEstMemo = { k: k, v: v };
      return v;
    } catch (e) { return null; }
  }
  function teamAnalysisCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'How your team stacks up'));
    c.appendChild(el('p', 'hint',
      'Claude\'s overall read on your team against every other roster in this ' +
      'league this season — where you really stand, and concrete moves to get ' +
      'better: a trade to explore, a waiver add, or a lineup fix.'));

    var acard = el('div');
    /* jobRunning('teamanalysis') guard — same gap and same fix as the Wire
       tab's identical button, see its own comment (freeAgentCard, ui.js). */
    var abtn = el('button', 'btn pri',
      jobRunning('teamanalysis') ? 'Comparing your team to the league…' : 'Ask Claude');
    var anote = el('p', 'hint', '');
    var aest = el('p', 'hint', '');
    if (jobRunning('teamanalysis')) {
      abtn.disabled = true;
    } else if (!Ai.configured()) {
      abtn.disabled = true;
      anote.textContent = 'Needs an Anthropic API key (Data → Claude → API key). Everything ' +
        'below works without one.';
    } else {
      anote.textContent = 'No web search on this one — every number here (prices, ' +
        'injuries, standings) is already fresh from the app\'s own feeds, so this is ' +
        'judgment, not research, and costs less than the Lineups → Advice and Wire syncs.';
    }
    fillAfterPaint(aest, claudeTeamAnalysisEstimate, function (v) {
      return v ? ('Estimated cost: ' + v +
        ' on the Claude API, at current prices (see Data → Claude → Claude costs).') : '';
    });
    abtn.addEventListener('click', function () {
      abtn.disabled = true; abtn.textContent = 'Comparing your team to the league…';
      jobStart('teamanalysis', 'Comparing your team to the league…');
      Promise.resolve().then(function () {
        var ctx = TeamReport.context(week, S.league.me, weekOpponents(), S.league.season,
                                      new Date().toISOString().slice(0, 10));
        jobStep('Claude is judging the league…', 60);
        return Ai.askTeamAnalysis(ctx, function (msg, pct) { jobStep(msg, pct); });
      }).then(function (res) {
        TeamReport.save(res);
        jobEnd();
        toast('Team analysis updated');
        render();
      })['catch'](function (e) {
        jobEnd();
        abtn.disabled = false; abtn.textContent = 'Ask Claude';
        anote.textContent = 'That did not work: ' + (e && e.message ? e.message : e) +
          '  ·  the rest of the app is unaffected.';
      });
    });
    var arow = el('div', 'dbrow'); arow.appendChild(abtn);
    acard.appendChild(arow); acard.appendChild(anote); acard.appendChild(aest);
    c.appendChild(acard);

    try {
      c.appendChild(handoffCard({
        title: 'Or use the Claude app — no API key, no cost',
        blurb: 'Makes a file with the standings and every roster in this league, ' +
               'already priced in this league\'s scoring. Send it to the Claude app ' +
               'with no message of your own; Claude gives its overall verdict and ' +
               'concrete recommendations. Load the reply here and it shows below.',
        build: function () {
          return Handoff.buildTeamAnalysis(week, S.league.me, weekOpponents(),
            S.league.season, new Date().toISOString().slice(0, 10));
        },
        apply: function (txt) {
          /* a fresh context, not whatever the export built — a player traded
             or signed since the export must not read as still-verified */
          var ctx = TeamReport.context(week, S.league.me, weekOpponents(),
            S.league.season, new Date().toISOString().slice(0, 10));
          return Handoff.importReply(txt, { week: week, ctx: ctx });
        },
        status: function () {
          var cch = TeamReport.load();
          if (!cch) return '';
          return 'Currently showing: rank ' + (cch.overall.rank || '?') + ' of ' +
                 (cch.overall.of || '?') + ' from ' + (cch.model || 'Claude') +
                 ', week ' + (cch.week || '?') + '.';
        }
      }));
    } catch (e) { /* never take the Rosters tab down for this */ }

    var cached = TeamReport.load();
    if (cached && cached.overall &&
        (cached.overall.verdict || (cached.recommendations && cached.recommendations.length))) {
      var stale = (cached.week !== week);
      c.appendChild(el('div', 'subhd', "Claude's take"));
      if (stale) {
        c.appendChild(el('p', 'warnText',
          'FROM WEEK ' + cached.week + ' — re-sync for this week.'));
      }
      if (cached.overall.verdict) {
        c.appendChild(el('p', null,
          (cached.overall.rank ? 'Rank ' + cached.overall.rank + ' of ' +
            cached.overall.of + '. ' : '') + cached.overall.verdict));
      }
      if (cached.strengths && cached.strengths.length) {
        c.appendChild(el('p', 'hint', 'Strengths: ' + cached.strengths.join(', ')));
      }
      if (cached.weaknesses && cached.weaknesses.length) {
        c.appendChild(el('p', 'hint', 'Weaknesses: ' + cached.weaknesses.join(', ')));
      }
      if (cached.teamComparisons && cached.teamComparisons.length) {
        var td = el('details');
        td.appendChild(el('summary', null, 'Team by team ▾'));
        cached.teamComparisons.forEach(function (tc) {
          var p = el('p', null);
          p.appendChild(el('b', null, tc.team));
          p.appendChild(document.createTextNode(' — ' + tc.note));
          td.appendChild(p);
        });
        c.appendChild(td);
      }
      if (cached.recommendations && cached.recommendations.length) {
        c.appendChild(el('div', 'subhd', 'Recommendations'));
        cached.recommendations.forEach(function (r) {
          var row = el('div', 'row');
          var nm = el('div', 'nm');
          nm.appendChild(document.createTextNode(r.action));
          if (!r.verified) nm.appendChild(el('span', 'tag warn', 'unverified player'));
          row.appendChild(nm);
          c.appendChild(row);
          if (r.why) {
            var d = el('details');
            d.appendChild(el('summary', null, 'why ▾'));
            var kv = el('div', 'kv'); kv.appendChild(el('span', null, r.why)); d.appendChild(kv);
            c.appendChild(d);
          }
        });
      }
      if (cached.summary) c.appendChild(el('p', 'muted', cached.summary));
    }
    return c;
  }

  /* ---------- ROSTERS: trade evaluator (v2.6) ---------- */
  var faPos = 'ALL';   /* free-agent board filter (v3.2) */
  var tradeSel = { give: {}, get: {}, other: '' };
  function tradeCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Trade evaluator'));
    var opp = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
    var others = S.teams.filter(function (t) { return t.id !== S.league.me; });
    if (!tradeSel.other) tradeSel.other = others.length ? others[0].id : '';

    var sel = el('select');
    others.forEach(function (t) {
      var o = el('option', null, t.name); o.value = t.id;
      if (t.id === tradeSel.other) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      tradeSel.other = this.value; tradeSel.get = {}; render();
    });
    c.appendChild(el('label', 'f', 'Trade with'));
    c.appendChild(sel);

    function picker(label, teamId, bag) {
      var d = el('details');
      var n = Object.keys(bag).length;
      d.appendChild(el('summary', null, label + (n ? ' — ' + n + ' selected' : '') + ' \u25be'));
      var t = Store.team(teamId);
      if (t) t.players.forEach(function (p) {
        var r = el('label', 'chk');
        var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!bag[p.id];
        cb.addEventListener('change', function () {
          if (this.checked) bag[p.id] = 1; else delete bag[p.id];
          render();
        });
        r.appendChild(cb);
        r.appendChild(document.createTextNode(' ' + p.pos + '  ' + p.name));
        d.appendChild(r);
      });
      return d;
    }
    c.appendChild(picker('You give', S.league.me, tradeSel.give));
    c.appendChild(picker('You get', tradeSel.other, tradeSel.get));

    var giveIds = Object.keys(tradeSel.give), getIds = Object.keys(tradeSel.get);
    if (giveIds.length && getIds.length) {
      var r = Value.trade(week, giveIds, getIds, opp);
      var big = el('div', 'bigfig', (r.delta >= 0 ? '+' : '') + fmt(r.delta));
      big.style.color = r.delta >= 0 ? 'var(--good)' : 'var(--bad)';
      c.appendChild(big);
      c.appendChild(el('p', null, 'points over the rest of the regular season — ' + r.verdict + '.'));
      var rows = [];
      r.give.forEach(function (v) {
        rows.push({ cells: ['out', v.name + ' (' + v.pos + ')', fmt(v.perGame),
                            fmt(v.replacement), fmt(v.ros)] });
      });
      r.get.forEach(function (v) {
        rows.push({ me: true, cells: ['in', v.name + ' (' + v.pos + ')', fmt(v.perGame),
                                      fmt(v.replacement), fmt(v.ros)] });
      });
      c.appendChild(table(['', 'Player', 'Pts/wk', 'Wire', 'Value'], rows));
      if (r.note) c.appendChild(el('p', 'muted', r.note));
      c.appendChild(el('p', 'hint',
        'Value is (his points a week minus what the best free agent at his position ' +
        'is worth) times the ' + r.weeks + ' regular-season weeks left. That subtraction ' +
        'is the whole idea: a player is only worth what he beats the wire by, which is ' +
        'why a startable tight end and a fourth running back are not the same asset at ' +
        'the same projection. All of it in this league\'s scoring.'));
    } else {
      c.appendChild(el('p', 'muted', 'Pick at least one player on each side.'));
    }
    return c;
  }

  function addForm(t) {
    var d = el('details');
    d.appendChild(el('summary', null, '+ Add player  (search ' + PlayerDB.meta().count + ' players) \u25be'));

    var posSel = el('select');
    posSel.setAttribute('data-fk', 'faPos');
    posSel.appendChild(new Option('Any position', 'ANY'));
    ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].forEach(function (p) { posSel.appendChild(new Option(p, p)); });

    var q = el('input'); q.type = 'text';
    q.setAttribute('autocomplete', 'off'); q.setAttribute('autocorrect', 'off');
    q.setAttribute('autocapitalize', 'none'); q.setAttribute('spellcheck', 'false');
    q.placeholder = 'Type a name — e.g. achane, kupp, seahawks';

    var results = el('div');
    var hint = el('p', 'hint', '');

    /* This re-normalised all ~170 rostered names for EVERY search hit, and
       there are up to 20 hits, on EVERY keystroke — about 3,400 regex-heavy
       norm() calls per character typed, which is exactly what input lag feels
       like. The owner index is built once per render instead, and rebuilt only
       if the rosters change under it. */
    var ownerBy = null, ownerGen = -1;
    function owners() {
      var gen = (window.Store && Store.generation) ? Store.generation() : 0;
      if (ownerBy && ownerGen === gen) return ownerBy;
      ownerBy = {};
      var i, j;
      for (i = 0; i < S.teams.length; i++) {
        for (j = 0; j < S.teams[i].players.length; j++) {
          var vv = Names.variants(S.teams[i].players[j].name), q;
          for (q = 0; q < vv.length; q++) ownerBy[vv[q]] = S.teams[i].name;
        }
      }
      ownerGen = gen;
      return ownerBy;
    }
    function have(name) {
      var o = owners();
      var hit = o[PlayerDB.norm(name)] || o[Names.canon(name)];
      return hit ? hit : null;
    }
    function run() {
      results.innerHTML = '';
      var hits = PlayerDB.search(q.value, posSel.value, 20);
      if (!q.value.trim()) { hint.textContent = ''; return; }
      if (!hits.length) {
        hint.textContent = 'No match. Refresh the player database (Data → Sync & data), ' +
                           'or add him by hand below.';
        results.appendChild(manualRow(t, q.value));
        return;
      }
      hint.textContent = hits.length + ' match' + (hits.length === 1 ? '' : 'es');
      hits.forEach(function (p) {
        var owner = have(p.n);
        var row = el('div', 'res');
        markPlayer(row, p.n, p.p, p.t);
        row.appendChild(el('div', 'pos', p.p));
        var nm = el('div', 'nm');
        nm.appendChild(document.createTextNode(p.n));
        nm.appendChild(el('small', null, '  ' + (p.t || '?') + (p.b ? ' · bye ' + p.b : '')));
        if (owner) nm.appendChild(el('span', 'tag out', owner === t.name ? 'on this team' : owner));
        row.appendChild(nm);
        row.appendChild(el('div', 'add', owner ? '' : '+'));
        if (!owner) {
          row.addEventListener('click', function () {
            Store.addPlayer(t.id, { name: p.n, pos: p.p, nfl: p.t, bye: p.b, espnId: p.e || '' });
            toast('Added ' + p.n + ' to ' + t.name);
            render();
          });
        }
        results.appendChild(row);
      });
    }
    q.addEventListener('input', run);
    posSel.addEventListener('change', run);

    d.appendChild(el('label', 'f', 'Position filter')); d.appendChild(posSel);
    d.appendChild(el('label', 'f', 'Search')); d.appendChild(q);
    d.appendChild(hint);
    d.appendChild(results);
    return d;
  }
  /* Escape hatch for a player the database has never heard of. */
  function manualRow(t, typedName) {
    var wrap = el('div');
    wrap.style.marginTop = '8px';
    var pos = el('select');
    pos.setAttribute('data-fk', 'addPos');
    ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].forEach(function (p) { pos.appendChild(new Option(p, p)); });
    var nfl = el('select');
    nfl.setAttribute('data-fk', 'addNfl');
    nfl.appendChild(new Option('— NFL team —', ''));
    Object.keys(S.byes).sort().forEach(function (a) {
      nfl.appendChild(new Option(a + ' (bye ' + S.byes[a] + ')', a));
    });
    var b = el('button', 'btn pri', 'Add "' + typedName.trim() + '" manually');
    b.style.marginTop = '8px';
    b.addEventListener('click', function () {
      Store.addPlayer(t.id, { name: typedName.trim(), pos: pos.value, nfl: nfl.value });
      render(); toast('Added');
    });
    wrap.appendChild(el('label', 'f', 'Position')); wrap.appendChild(pos);
    wrap.appendChild(el('label', 'f', 'NFL team')); wrap.appendChild(nfl);
    wrap.appendChild(b);
    return wrap;
  }

  /* ---------- WIRE (v2.6, moved to its own tab in v4.8) ----------
   * Tj: "move everything about free agents to a new tab called wire. keep
   * all the logic and functions the same, just move it all to its own
   * section. I don't want to see it in the roster section." This card and
   * addFreeAgent are unchanged from the Rosters tab they used to sit in —
   * only the tab that renders them moved.
   *
   * Ranked in THIS league's points, which is the only reason to have it: every
   * waiver list on the internet is computed in scoring where a completion is
   * worth nothing, and here it is worth a point. */
  function viewWire(root) {
    /* Tj, 2026-09-15: keep the player database fresh "each time I refresh
     * waiver wire information or anything else that it is important to see
     * all players" — the free-agent board below IS that screen. Quiet and
     * a no-op unless the database has actually gone stale (see
     * refreshPlayerDBIfStale above). */
    refreshPlayerDBIfStale();
    /* the full-season projections the board is ranked on — see its own
       comment above for why this has to happen here and not only on a sync */
    refreshSeasonProjIfStale();
    addSafe(root, 'Your roster — injuries', rosterInjuryCard);
    addSafe(root, 'The free-agent board', freeAgentCard);
  }
  /* ---- your own roster's injuries, deterministic first (v5.5) -------------
   * Needs no API key: the ESPN designation and its note are on screen the
   * moment this tab opens, straight from the same feed the Advice tab uses
   * (Value.myInjuries reads Recommend.projectAll — one source of truth, never
   * a second copy of the injury logic). Once "Ask Claude about the wire" has
   * been run for this week, its season-outlook research is layered on top of
   * each matching row rather than replacing this baseline.
   *
   * v5.5b (Tj's screenshot, 2026-09-14): this card reads whatever ESPN feed
   * is already cached — which loadCaches() pulls from DISK at boot, and disk
   * only ever holds what the LAST successful sync wrote. Nothing on the Wire
   * tab used to be able to refresh that, so a phone that had not visited the
   * Advice tab in a while showed a note that was genuinely days old (in Tj's
   * case, old enough to predate the trimNote fix — the exact pre-fix
   * "...Swift wil" cutoff, still sitting on disk, unrefreshed). Two fixes:
   * this card now says HOW OLD the feed is instead of presenting it as
   * current, and carries its own Sync button (no API key needed — it is
   * only the ESPN endpoint). */
  function rosterInjuryCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Your roster — injuries · week ' + week));
    var nc = Recommend.newsCache();
    var st = el('div');
    var line = el('div', 'kv');
    line.appendChild(el('span', nc.error || !nc.at ? 'warnText' : null,
      nc.at
        ? (nc.error ? 'Injury feed failed to refresh — showing ' : 'Injury feed: ') +
          (nc.count || 0) + ' ESPN record' + (nc.count === 1 ? '' : 's') + ', ' + agoText(nc.at)
        : 'Injury feed: not synced yet this session'));
    st.appendChild(line);
    c.appendChild(st);
    var syncBtn = el('button', 'btn sm', jobRunning('newsSync') ? 'Syncing…' : 'Sync injury feed');
    syncBtn.disabled = jobRunning('newsSync');
    syncBtn.addEventListener('click', function () {
      jobStart('newsSync', 'Injury report…');
      Recommend.loadNews(function (t, p) { jobStep(t, p); }, { force: true })
        .then(function () { jobEnd(); render(); })
        ['catch'](function () { jobEnd(); render(); });
    });
    c.appendChild(syncBtn);

    var opp = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
    var proj = Recommend.projectAll(week, S.league.me, opp);
    var list = Value.myInjuries(week, proj);
    if (!list.length) {
      c.appendChild(el('p', 'muted',
        'Nobody on your roster is hurt or on a bye this week.'));
      return c;
    }
    var cached = Value.waiverLoad();
    var outlook = {};
    if (cached && cached.injuries && cached.week === week) {
      cached.injuries.forEach(function (x) { outlook[Names.canon(x.name)] = x; });
    }
    list.forEach(function (x) {
      var r = el('div', 'row');
      markPlayer(r, x.name, x.pos, x.nfl);
      r.appendChild(el('div', 'slot', x.pos));
      var nm = el('div', 'nm');
      nm.appendChild(document.createTextNode(x.name));
      nm.appendChild(el('small', null, '  ' + x.nfl));
      nm.appendChild(el('span', (x.status === 'OUT' || x.status === 'BYE') ? 'tag out' : 'tag warn',
                         x.status));
      r.appendChild(nm);
      c.appendChild(r);
      /* the note itself, ALWAYS visible (it is the reason this card exists) —
         a sibling .kv line, not crammed into the row's own <small>: mixing a
         long text run with inline-block tag spans on one nowrap flex line is
         exactly what produced Tj's garbled, mid-word-cut screenshot */
      if (x.note) {
        var nk = el('div', 'kv');
        /* three lines, tap for the rest (full test 2026-09-24): ESPN's notes
           run to ten lines, and a roster with three hurt players pushed the
           free-agent board a whole screen down. Nothing is cut — one tap. */
        var nt = el('span', 'clamp', x.note);
        nt.addEventListener('click', function () { nt.classList.toggle('open'); });
        nk.appendChild(nt);
        c.appendChild(nk);
      }
      /* THE SAME FACT THE WIRE TAB SHOWS, HERE TOO (2026-09-19 sweep).
         health() collapses a plain weekly OUT and a season-ending IR
         designation into the identical label "OUT" — right for "can he play
         Sunday", but this card is titled "your roster — injuries" and a man
         who is DONE FOR THE YEAR reads exactly like one day-to-day case away
         from playing again. Recommend.seasonOutlook is the same, now-fixed
         call the Wire tab's mustReplace()/rosterValues() run (see the
         2026-09-18d job: it used to write off a healthy Dalton Schultz off a
         misread news blurb) — free, no API key, so it belongs on every card
         that shows a hurt player, not only the one the last job happened to
         touch. */
      if (x.status !== 'BYE') {
        var so = Recommend.seasonOutlook({ name: x.name });
        if (so.seasonEnding) {
          var sk = el('div', 'kv');
          sk.appendChild(el('span', 'warnText',
            'Out for the season' + (so.why ? ' — ' + so.why : '')));
          c.appendChild(sk);
        } else if (so.longTermOut) {
          var lk = el('div', 'kv');
          lk.appendChild(el('span', null,
            (so.label || 'Long-term out') +
            (so.returnAround ? ', not eligible to return until ' + so.returnAround : '') +
            ' — not out for the season.'));
          c.appendChild(lk);
        }
      }
      var out = outlook[Names.canon(x.name)];
      if (out && (out.extent || out.timeline)) {
        var d = el('details');
        d.appendChild(el('summary', null, "Claude's season outlook ▾"));
        var kv = el('div', 'kv');
        kv.appendChild(el('span', null,
          (out.extent ? out.extent + '  ' : '') + out.timeline +
          (out.replace === false ? '' : '  — worth watching the wire for a replacement.')));
        d.appendChild(kv);
        c.appendChild(d);
      }
    });
    if (!(cached && cached.injuries && cached.week === week) && Ai.configured()) {
      c.appendChild(el('p', 'hint',
        '"Ask Claude about the wire" below also researches each of these for a ' +
        'rest-of-season outlook — severity, timeline, and whether it is worth ' +
        'chasing a replacement.'));
    }
    return c;
  }
  /* What "Ask Claude about the wire" would actually cost right now, from the
   * REAL prompt this exact press would send — Ai.waiverSearchBudget is the
   * same function askWaivers() itself calls, so this can never claim a
   * cheaper (or pricier) call than the real one. Wrapped: an estimate must
   * never be able to break the wire board it sits under.
   *
   * Memoised (found in review, 2026-09-15): freeAgentCard() calls this on
   * every render, and every position-filter chip on that card re-renders
   * the whole card just to change which rows show — this built a fresh
   * waiverContext (a full projectAll over the roster plus a free-agent scan)
   * purely to refresh a cost string that does not even depend on which
   * position is selected. Same key shape as value.js's own _faMemo: the
   * roster generation covers adds/drops/trades, and the rates are included
   * because editing a price field on the Data tab must still change the
   * number immediately. */
  var _wireEstMemo = null;
  function claudeWireEstimate(cachedOnly) {
    try {
      /* NOT root.Store — ui.js is a bare (function () {...})(), unlike every
         other module here, so `root` does not mean `window` in this file
         (see the __appPause/__appResume note above). Writing root.Store was
         a ReferenceError on every call, silently swallowed by the catch
         below, which is why this line vanished entirely until caught in the
         same sweep that added it — same class of mistake this file already
         has one standing warning about, now a second. */
      /* Same model a real askWaivers() call would use for this exact press —
       * ai.js's own depth()==='cheap' ? cheapModel() : model(). Found in the
       * 2026-09-15e sweep: this used to estimate at a flat rate table that
       * assumed the main model always, overstating the cost whenever
       * 'cheap' depth would really send the call to Haiku. */
      var mdl = Ai.depth() === 'cheap' ? Ai.cheapModel() : Ai.model();
      var gen = (window.Store && Store.generation) ? Store.generation() : 0;
      var k = week + '|' + S.league.me + '|' + gen + '|' + mdl + '|' + JSON.stringify(Usage.rates(mdl));
      if (_wireEstMemo && _wireEstMemo.k === k) return _wireEstMemo.v;
      if (cachedOnly) return undefined;
      var opp2 = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
      var ctx = Value.waiverContext(week, S.league.me, opp2, S.league.season,
                                    new Date().toISOString().slice(0, 10));
      var budget = Ai.waiverSearchBudget(ctx.needs, ctx.injuries);
      var promptChars = Ai.buildWaiverPrompt(ctx).length;
      /* Output is the fuzzier half of this (no formula the way search count
         has one) — a rough per-position-of-need allowance plus a little per
         search for the model's own narration between them. Search cost
         dominates the bill regardless (see Usage.estimate's own note), so
         being a bit off here costs the estimate little. */
      var nNeed = Math.max(1, (ctx.needs || []).length);
      var outputTokens = 300 + nNeed * 220 + budget * 60;
      var v = Usage.money(Usage.estimate(promptChars, budget, outputTokens, mdl));
      _wireEstMemo = { k: k, v: v };
      return v;
    } catch (e) { return null; }
  }
  function freeAgentCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Free agents · week ' + week));
    var opp = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
    /* Tj, 2026-09-18: "focus waiver wire more on my roster weaknesses,
       usually rb and wr." Value.needs() already ranks starting slots
       weakest-first against the wire's own replacement level; K/DEF are
       left out here specifically because Tj also said those "are not
       priorities" — this line exists to make the actual thin spots visible
       up front, not to imply the list below is re-sorted by it (it stays
       ranked by rest-of-season points gained, which is the honest measure
       of how big a SPECIFIC swap is). */
    /* QB LEFT OUT ALONGSIDE K AND DEF (2026-09-18d sweep). Tj's screenshot
       carried this line reading "Your thinnest starting spots right now,
       weakest first: QB, WR — a pickup there is more likely to actually move
       your team", which is a direct contradiction of the rule sitting
       underneath the same screen: rule 6 says quarterback is LOW priority
       unless the edge is season-defining, and he has complained twice that
       the app "always recommends qb switch". The gap arithmetic is not wrong
       — replacement level at QB really is high in a league that pays a full
       point per completion, which is exactly WHY his own starter looks close
       to it — but "thin" here means "go fix this", and telling him to go fix
       quarterback is the one thing the board below is built not to do. The
       three de-prioritised positions are now treated alike in both places. */
    var thin = Value.needs(week, S.league.me, opp)
      .filter(function (n) { return n.pos !== 'K' && n.pos !== 'DEF' && n.pos !== 'QB'; });
    if (thin.length) {
      var seenPos = {}, thinPos = [];
      thin.forEach(function (n) { if (!seenPos[n.pos]) { seenPos[n.pos] = 1; thinPos.push(n.pos); } });
      c.appendChild(el('p', 'hint', 'Your thinnest starting spot' +
        (thinPos.length === 1 ? '' : 's') + ' right now, weakest first: ' + thinPos.join(', ') +
        ' — a pickup there is more likely to actually move your team than one at a ' +
        'position you are already strong at. Quarterback, kicker and defense are ' +
        'deliberately left out: they only earn a move on a season-defining edge or an ' +
        'injury that forces one.'));
    }
    var ups = Value.upgrades(week, S.league.me, opp, 80);
    /* OUTSIDE the `if (ups.length)` below, deliberately (found re-reading this
       job's own diff, the way ckpt 115 caught the last severe one). A hole in
       the roster exists whether or not the wire happens to have somebody who
       clears the bar to put in it — and the case where it does NOT is exactly
       when Tj most needs telling, because nothing else on this screen would
       mention it. Nested inside the upgrade list, a dead roster spot with no
       available replacement at his position would have gone completely
       unreported. */
    {
      /* A forced replacement is not the same kind of thing as an upgrade and
         must not be presented as one: one is a hole in the roster, the other
         is an option (Tj, 2026-09-18, rule 6: a season-ending injury
         "mandates the player be replaced").
 
         COUNTED OFF THE ROSTER, NOT OFF THIS LIST (Tj, 2026-09-18d: "it says
         36 players on my roster are out for the season. My roster is only 17
         players"). This used to be ups.filter(u => u.mandated).length — the
         number of SUGGESTION ROWS whose drop was a dead man. One falsely
         season-ended tight end was priced at zero, which made him the weakest
         droppable player at his position and the weakest flex-eligible player
         overall, so the old pairing loop offered him to every free agent that
         cleared the gates: 36 rows, one player, and a sentence that could not
         have been true of a 17-man roster under any circumstances. A hole in
         the roster is a fact about the ROSTER — it is there whether or not
         the wire happens to have somebody to put in it — so the count and the
         names now come from Value.mustReplace(), and the men are named rather
         than merely tallied, which is the other thing a number alone could
         never get wrong quietly. */
      var forced = Value.mustReplace(week, S.league.me, opp);
      if (forced.length) {
        var names = forced.map(function (m) { return m.name + ' (' + m.pos + ')'; });
        /* warnText, not warn: `.warn` is only defined for a CARD and a TAG in
           app.css (.card.warn, .tag.warn) — a bare <p class="warn"> would have
           styled as nothing at all and the line would have read as ordinary
           body text. */
        c.appendChild(el('p', 'warnText', forced.length === 1
          ? names[0] + ' is out for the season — that roster spot is doing ' +
            'nothing until you replace him:'
          : forced.length + ' players on your roster are out for the season — ' +
            names.join(', ') + '. Those spots are doing nothing until you ' +
            'replace them:'));
        if (!ups.some(function (u) { return u.mandated; })) {
          c.appendChild(el('p', 'hint',
            'Nothing on the wire at ' +
            forced.map(function (m) { return m.pos; }).join('/') +
            ' is startable enough to be worth suggesting right now — but the spot is ' +
            'still dead, so check back after the next round of waivers.'));
        }
      }
    }
    if (ups.length) {
      var optional = ups.filter(function (u) { return !u.mandated; }).length;
      if (optional > 0) {
        c.appendChild(el('p', null, optional + ' available player' +
          (optional === 1 ? '' : 's') + ' project better than someone on your roster ' +
          'for the REST OF THE SEASON (' + ups[0].weeks + ' week' +
          (ups[0].weeks === 1 ? '' : 's') + ' left, not just this week) — each paired ' +
          'with who to drop for him:'));
      }
      ups.slice(0, 6).forEach(function (u) {
        var r = el('div', 'row wrap');
        markPlayer(r, u.fa.name, u.fa.pos, u.fa.nfl);
        r.appendChild(el('div', 'slot', u.fa.pos));
        var nm = el('div', 'nm');
        nm.appendChild(document.createTextNode(u.fa.name));
        nm.appendChild(el('small', null, '  ' + u.fa.nfl + ' · ' +
          (u.mandated
            ? 'replaces ' + u.drop.name + ', who is out for the season — ' +
              fmt0(u.fa.ros) + ' pts over his remaining ' + u.fa.games + ' game' +
              (u.fa.games === 1 ? '' : 's')
            : '+' + fmt0(u.gain) + ' pts the rest of the season over ' + u.drop.name +
              ' (' + fmt(u.perGame) + '/gm across ' + u.fa.games + ' game' +
              (u.fa.games === 1 ? '' : 's') + ')') +
          /* An IR man who is COMING BACK is not "out for the season" and the
             row must not imply he is — the whole point of the 2026-09-18d
             split. Say the true, more useful thing instead: when he is back,
             and how few games that leaves him. */
          (u.drop.longTermOut
            ? ' · ' + u.drop.name + ' is ' + (u.drop.outLabel || 'out') +
              (u.drop.backAround ? ' until ' + u.drop.backAround : '') +
              ' (' + u.drop.games + ' game' + (u.drop.games === 1 ? '' : 's') + ' left)'
            : '')));
        if (u.mandated) nm.appendChild(el('span', 'tag warn', 'REPLACE'));
        /* Tj, 2026-09-18d: same position is the default, so the exceptions are
           worth flagging on the row rather than only in the "why". */
        if (u.crossPos) nm.appendChild(el('span', 'tag', u.fa.pos + ' for ' + u.drop.pos));
        if (u.drop.longTermOut) nm.appendChild(el('span', 'tag', 'IR'));
        if (u.fa.healthLabel) nm.appendChild(el('span', 'tag warn', u.fa.healthLabel));
        r.appendChild(nm);
        var b = el('button', 'btn sm', 'Add + drop ' + u.drop.name);
        b.addEventListener('click', function () { addFreeAgentSwap(u.fa, u.drop.name); });
        r.appendChild(b);
        c.appendChild(r);

        var d = el('details');
        d.appendChild(el('summary', null, 'why ▾'));
        var kv = el('div', 'kv'); kv.appendChild(el('span', null, u.why)); d.appendChild(kv);
        c.appendChild(d);
      });
    } else {
      c.appendChild(el('p', 'muted',
        'Nobody on the wire clearly beats a player on your roster for the rest of the ' +
        'season. This checks a full season\'s worth of value, not one week — a single ' +
        'good matchup is never enough on its own to show up here.'));
    }
    /* ---- Claude's read of the wire (v3.4) ------------------------------
     * The button is here rather than on the Data tab because this is where he
     * is looking when he wants it. The app has already decided WHO is free and
     * what they are worth in league points; this call adds only what a stat
     * line cannot see — who just got hurt ahead of somebody, who just took a
     * job — and re-ranks the shortlist for THIS roster. */
    var wcard = el('div');
    /* jobRunning('waivers') guard added 2026-09-18: this button used to only
     * ever disable itself on ITS OWN click handler (a few lines below) —
     * fine for the button instance that press created, but freeAgentCard()
     * runs fresh on every render, and switching tabs away and back while the
     * 5-minute Ai.askWaivers call (ai.js) is still in flight rebuilds this
     * whole card, including a BRAND NEW button with no memory of the one
     * still running. That new button read only !Ai.configured(), so it came
     * back enabled — a second tap fired a second concurrent paid Claude
     * call, and whichever response landed last silently overwrote
     * Value.waiverSave()'s cache. Every sibling "ask Claude / refresh" button
     * in this file (rosterInjuryCard's jobRunning('newsSync'), the player-db
     * refresh's jobRunning('db')) already guards this way; this one and
     * teamAnalysisCard's below it were the two that did not. */
    var wsync = el('button', 'btn pri',
      jobRunning('waivers') ? 'Reading the wire…' : 'Ask Claude about the wire');
    var wnote = el('p', 'hint', '');
    var west = el('p', 'hint', '');
    var cached = Value.waiverLoad();

    if (jobRunning('waivers')) {
      wsync.disabled = true;
    } else if (!Ai.configured()) {
      wsync.disabled = true;
      wnote.textContent = 'Needs an Anthropic API key (Data → Claude → API key). ' +
        'Everything above works without one; this only adds the news layer.';
    } else {
      wnote.textContent = 'Reads this week\'s waiver-wire and injury news for the ' +
        'shortlist above, then ranks it for your roster under THIS league\'s ' +
        'scoring. Public waiver lists are half-PPR standard and are wrong about ' +
        'quarterbacks here by roughly a factor of two.';
    }
    /* Tj: "get rid of anywhere it says how much Claude usage I have left...
     * put an estimate of what each request would cost." Shown whether or
     * not a key is configured right now — the whole point is he can see
     * this without one. Computed from the REAL prompt this exact press
     * would send (claudeWireEstimate below), not a flat guess. */
    /* 2026-09-15e sweep: matched wording with the Advice tab's identical
       estimate line (recommend.js render()'s own "Estimated cost to sync"). */
    fillAfterPaint(west, claudeWireEstimate, function (v) {
      return v ? ('Estimated cost: ' + v +
        ' on the Claude API, at current prices (see Data → Claude → Claude costs).') : '';
    });
    wsync.addEventListener('click', function () {
      wsync.disabled = true; wsync.textContent = 'Reading the wire…';
      /* This IS "refreshing waiver wire information" — fired in the
       * background alongside the injury/Claude chain below, never awaited,
       * so it adds no latency to a call that already costs money. */
      refreshPlayerDBIfStale();
      jobStart('waivers', 'Refreshing the injury feed…');
      /* The injury feed is refreshed FIRST, forced — a paid Claude call must
         not reason from whatever ESPN designations happen to already be
         cached (possibly days old; see rosterInjuryCard's history above).
         Its own failure is swallowed and the chain carries on with whatever
         is already cached, same resilience pattern syncAll() already uses
         for the Advice tab: one step failing must not cost the whole sync. */
      Recommend.loadNews(function (msg, pct) { jobStep(msg, pct); }, { force: true })
        ['catch'](function () { return null; })
        .then(function () {
          var opp2 = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
          var ctx = Value.waiverContext(week, S.league.me, opp2, S.league.season,
                                        new Date().toISOString().slice(0, 10));
          jobStep('Claude is reading the waiver wire…', 60);
          return Ai.askWaivers(ctx, function (msg, pct) { jobStep(msg, pct); });
        })
        .then(function (res) {
          Value.waiverSave(res);
          jobEnd();
          toast('Wire read — ' + res.adds.length + ' adds');
          render();
        })['catch'](function (e) {
          jobEnd();
          wsync.disabled = false; wsync.textContent = 'Ask Claude about the wire';
          wnote.textContent = 'That did not work: ' + (e && e.message ? e.message : e) +
            '  ·  the ranked board above is unaffected and still works.';
        });
    });
    var wrow = el('div', 'dbrow'); wrow.appendChild(wsync);
    wcard.appendChild(wrow); wcard.appendChild(wnote); wcard.appendChild(west);
    c.appendChild(wcard);

    /* The same round trip as the Advice tab, on the same card component, for
       the same reason: this is the button that costs money per press, so the
       free alternative belongs directly beneath it. Note that unlike the API
       path it works with NO key at all — which is why it is added outside the
       Ai.configured() branch above. */
    try {
      c.appendChild(handoffCard({
        title: 'Or use the Claude app — no API key, no cost',
        blurb: 'Makes a file listing every free agent the app has priced in this ' +
               'league\'s scoring, plus your starting lineup and where it is thin. ' +
               'Send it to the Claude app with no message of your own; Claude reads ' +
               'the wire news and ranks it for this roster. Load the reply here and ' +
               'it fills in the board below.',
        build: function () {
          var o = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
          return Handoff.buildWaivers(week, S.league.me, o, S.league.season,
                                      new Date().toISOString().slice(0, 10));
        },
        apply: function (txt) {
          var o = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
          /* the pool is rebuilt so "was he in the list we sent" is answered
             against the CURRENT wire, not a stale one — a player signed since
             the export must not come back marked verified */
          var wc = Value.waiverContext(week, S.league.me, o, S.league.season,
                                       new Date().toISOString().slice(0, 10));
          return Handoff.importReply(txt, { week: week, pool: wc.pool,
            roster: wc.roster, mandated: wc.mandated,
            dropCandidates: wc.dropCandidates, kdefNeed: wc.kdefNeed,
            injuries: wc.injuries });
        },
        status: function () {
          var cch = Value.waiverLoad();
          if (!cch || !cch.adds || !cch.adds.length) return '';
          return 'Currently showing: ' + cch.adds.length + ' add' +
                 (cch.adds.length === 1 ? '' : 's') + ' from ' +
                 (cch.model || 'Claude') + ', week ' + (cch.week || '?') + '.';
        }
      }));
    } catch (e) { /* never take the Wire tab down for this */ }

    if (cached && cached.adds && cached.adds.length) {
      var stale = (cached.week !== week);
      c.appendChild(el('div', 'subhd', "Claude's read of the wire"));
      c.appendChild(el('p', stale ? 'warnText' : 'muted',
        (stale ? 'FROM WEEK ' + cached.week + ' — re-sync for this week. ' : '') +
        (cached.needs || '') + (cached.summary ? '  ' + cached.summary : '')));
      /* Grouped by position, in the SAME fixed order the free-agent board
         below always uses (Value.POS: QB, RB, WR, TE, K, DEF) — not the
         order Claude happened to rank them in. That is what keeps K/DEF
         visually last regardless of how the model ranked them, matching
         Tj's "low priority" rule with a guarantee rather than a hope. */
      var seen = {};
      cached.adds.forEach(function (a) {
        if (!seen[a.pos]) seen[a.pos] = [];
        seen[a.pos].push(a);
      });
      Value.POS.forEach(function (k) {
        if (!seen[k] || !seen[k].length) return;
        var lowPri = (k === 'K' || k === 'DEF');
        var anyForced = seen[k].some(function (x) { return x.mandated; });
        c.appendChild(el('div', 'subhd', k + ' — Claude' +
          (lowPri
            ? (anyForced
                ? '  ·  low priority, but yours is out for the season'
                : '  ·  low priority — ranked only because yours is unavailable')
            : '')));
        seen[k].forEach(function (a) {
          var r = el('div', 'row');
          markPlayer(r, a.name, a.pos, a.nfl);
          r.appendChild(el('div', 'slot', '#' + a.rank));
          var nm = el('div', 'nm');
          nm.appendChild(document.createTextNode(a.name));
          var bits = [a.nfl];
          /* the expected REST-OF-SEASON point edge over the exact man being
             dropped — the number Tj asked every recommendation to carry
             ("expected to produce 54 more fantasy points over the season").
             Only Claude can supply it, so it is only shown when it came
             back; the app's own projection stays as the fallback. */
          if (typeof a.edge === 'number' && a.dropCandidate) {
            bits.push('+' + fmt0(a.edge) + ' pts over ' + a.dropCandidate + ' this season');
          } else if (typeof a.ros === 'number') {
            bits.push(fmt0(a.ros) + ' pts rest of season');
          } else if (typeof a.proj === 'number') {
            bits.push(fmt(a.proj) + ' proj');
          }
          if (a.onBye) bits.push('ON BYE this week');
          if (a.overStarter) bits.push('beats ' + a.overStarter);
          bits.push(a.confidence + ' confidence');
          nm.appendChild(el('small', null, '  ' + bits.join(' · ') +
            (a.verified ? '' : '  ·  NOT IN THE APP\'S POOL — check he is actually free') +
            (a.dropCandidate && !a.dropVerified
              ? '  ·  the player it says to drop is not on your roster' : '')));
          /* forced replacement, season-long move, or one-week-only. The first
             is not a kind of upgrade at all — it is a hole — so it gets its
             own tag rather than being folded in with the others. */
          if (a.mandated) nm.appendChild(el('span', 'tag warn', 'REPLACE'));
          nm.appendChild(el('span', a.priority === 'season' ? 'tag ok' : 'tag',
                             a.priority === 'season' ? 'SEASON' : '1-WEEK'));
          r.appendChild(nm);
          if (a.verified) {
            if (a.dropCandidate) {
              var swap = el('button', 'btn sm', 'Add + drop ' + a.dropCandidate);
              swap.addEventListener('click', function () {
                addFreeAgentSwap({ name: a.name, pos: a.pos, nfl: a.nfl, bye: a.bye },
                                  a.dropCandidate);
              });
              r.appendChild(swap);
            } else {
              var ab = el('button', 'btn sm', 'Add');
              ab.addEventListener('click', function () {
                addFreeAgent({ name: a.name, pos: a.pos, nfl: a.nfl, bye: a.bye });
              });
              r.appendChild(ab);
            }
          }
          c.appendChild(r);
          /* recentStat and why used to be crammed into the row's own <small>,
             which is nowrap/ellipsis — exactly the text Tj asked to actually
             see (the stat line, the injury that opened the role) was being
             cut off. A details block, the same pattern the Advice tab already
             uses for its own "why", is not. */
          if (a.recentStat || a.why) {
            var d = el('details');
            d.appendChild(el('summary', null, 'why ▾'));
            if (a.recentStat) {
              var rs = el('div', 'kv');
              rs.appendChild(el('span', null, 'Last game: ' + a.recentStat));
              d.appendChild(rs);
            }
            if (a.why) {
              var wy = el('div', 'kv');
              wy.appendChild(el('span', null, a.why));
              d.appendChild(wy);
            }
            c.appendChild(d);
          }
        });
      });
      c.appendChild(el('p', 'hint',
        'Read ' + agoText(cached.at) + ' with ' + (cached.model || 'Claude') +
        ', ' + cached.searchBudget + ' searches allowed' +
        (cached.spent && typeof cached.spent.cost === 'number' ? ', about $' + cached.spent.cost.toFixed(3) : '') +
        '. Availability and the projections come from this app; the news and the ' +
        'ranking come from Claude. Rows it could not match to the app\'s pool are ' +
        'marked — verify those on your league site before claiming.'));
    }

    /* ---- the board, BY POSITION ---------------------------------------
     * It used to be one list of the top 40 by league points, and it came out
     * as forty quarterbacks. That was not a data fault: this league pays a
     * point per completion, so a startable QB is worth about twice a startable
     * RB, and any single sort across positions puts every QB on top. Nobody
     * picking up a free agent wants QB1-40. Sections per position, plus one
     * genuinely comparable mixed ranking on value-over-replacement. */
    var chips = el('div', 'fchips');
    ['ALL', 'VALUE'].concat(Value.POS).forEach(function (k) {
      var b = el('button', 'fchip' + (faPos === k ? ' on' : ''),
                 k === 'VALUE' ? 'Best value' : (k === 'ALL' ? 'All positions' : k));
      b.setAttribute('data-fk', 'faChip|' + k);
      b.setAttribute('aria-pressed', k === faPos ? 'true' : 'false');
      b.addEventListener('click', function () { faPos = k; render(); });
      chips.appendChild(b);
    });
    c.appendChild(chips);

    var groups = Value.byPos(week, 0);
    /* The left column: his position on the mixed "Best value" list, else his
       RANK within the position group — the team code it used to show is
       already printed right beside his name. */
    function faRow(f, showPos, rank) {
      var r2 = el('div', 'row');
      markPlayer(r2, f.name, f.pos, f.nfl);
      r2.appendChild(el('div', 'slot', showPos ? f.pos : (rank ? '#' + rank : (f.nfl || f.pos))));
      var nm2 = el('div', 'nm');
      nm2.appendChild(document.createTextNode(f.name));
      /* THE HEADLINE NUMBER IS THE SEASON, NOT THE WEEK (Tj, 2026-09-18).
         The row used to read "16.4 proj (1 scored week in this app — thin
         sample)" — a per-game rate extrapolated from one game, with the
         caption admitting as much and the number printed anyway. It now
         leads with expected points for the REST OF THE SEASON, says how
         many games that is over, and keeps the per-game rate as the
         secondary figure a human actually reads a player by. */
      var vor = (typeof f.vor === 'number' && f.vor > 0.5)
        ? '  ·  +' + fmt(f.vor) + ' over the next ' + f.pos + ' on the wire' : '';
      var season = (typeof f.ros === 'number')
        ? fmt0(f.ros) + ' pts rest of season (' + f.games + ' game' +
          (f.games === 1 ? '' : 's') + ' left, ' + fmt(f.v) + '/gm)'
        : fmt(f.v) + ' proj';
      nm2.appendChild(el('small', null, '  ' + f.nfl + (f.onBye ? ' · ON BYE this week' : '') +
        ' · ' + season + vor));
      /* The basis and the usage trail are fine print, clamped to two lines —
         tap to read the rest. They used to be full-size text under every
         row, which made each free agent five or six lines tall and the
         board ~7,000px long. Nothing is removed: the whole sentence is in
         the row, one tap away. */
      nm2.appendChild(finePrint(f.src + (f.usage ? '\n' + f.usage : '')));
      /* OUT/IR/SUSPENDED/PUP never reach this row at all (Value.freeAgents
         excludes them entirely) — DOUBTFUL/QUESTIONABLE still show up here,
         just visibly tagged rather than silently offered as if healthy. */
      if (f.healthLabel) nm2.appendChild(el('span', 'tag warn', f.healthLabel));
      r2.appendChild(nm2);
      var b2 = el('button', 'btn sm', 'Add');
      b2.addEventListener('click', function () { addFreeAgent(f); });
      r2.appendChild(b2);
      return r2;
    }

    if (faPos === 'VALUE') {
      c.appendChild(el('p', 'muted',
        'Ranked by REST-OF-SEASON points above the best free agent at the same ' +
        'position. This is the only ranking on this screen that compares a QB ' +
        'with a running back honestly — raw points never can, because a ' +
        'completion pays 1 here.'));
      Value.byVor(week, 30).forEach(function (f) { c.appendChild(faRow(f, true)); });
    } else {
      var show = faPos === 'ALL' ? Value.POS : [faPos];
      var perPos = faPos === 'ALL' ? 6 : 30;
      show.forEach(function (k) {
        var rows = groups[k] || [];
        if (!rows.length) return;
        var hd = el('div', 'subhd');
        hd.textContent = k + '  ·  ' + rows.length + ' available';
        c.appendChild(hd);
        rows.slice(0, perPos).forEach(function (f, i) { c.appendChild(faRow(f, false, i + 1)); });
        if (rows.length > perPos && faPos === 'ALL') {
          var more = el('button', 'btn sm', 'All ' + rows.length + ' ' + k + 's');
          more.addEventListener('click', function () { faPos = k; render(); });
          c.appendChild(more);
        }
      });
    }
    c.appendChild(el('p', 'hint',
      'Everyone active on one of the 32 NFL rosters who is not on one of the ten ' +
      'league rosters, grouped by position and ranked for the REST OF THE SEASON — ' +
      'his own recent scored games in this app where there are enough of them, ' +
      'ESPN\'s season-long projection where there are not, and this week\'s ESPN line ' +
      'only as a last resort before a flat guess. Each row says which. Practice-squad ' +
      'players and anyone ESPN has OUT, on Injured Reserve, suspended or on PUP are ' +
      'never shown at all; DOUBTFUL/QUESTIONABLE still show, tagged. Adding a player ' +
      'here does not tell your league site anything; do the real add there.'));
    return c;
  }
  function finePrint(text) {
    var d = el('div', 'fine', text);
    d.addEventListener('click', function (e) {
      e.stopPropagation();
      d.classList.toggle('open');
    });
    return d;
  }
  function addFreeAgent(f) {
    var t = Store.team(S.league.me);
    if (!t) return;
    var go = el('button', 'btn pri', 'Add to my roster');
    go.style.marginBottom = '8px';
    go.addEventListener('click', function () {
      Store.addPlayer(S.league.me, { name: f.name, pos: f.pos, nfl: f.nfl, bye: f.bye });
      if (window.Sim) Sim.invalidate();
      var back = go.parentNode && go.parentNode.parentNode;
      if (back && back.parentNode) back.parentNode.removeChild(back);
      render(); toast('Added ' + f.name);
    });
    modal('Add ' + f.name + '?',
      'This adds him to YOUR roster in this app (' + t.players.length + ' players now). ' +
      'It does not touch your league site — do the waiver claim there as well.', go);
  }
  /* Add + drop in one tap, for a Claude add that came with a validated
   * dropCandidate (see ai.js normalizeWaivers — that name is guaranteed to be
   * a real player on this roster at the SAME position as the add, never a
   * kicker-for-a-receiver mismatch). If the roster has changed since the
   * context was built and the named player is no longer on it, this falls
   * back to a plain add rather than failing outright. */
  function addFreeAgentSwap(f, dropName) {
    var t = Store.team(S.league.me);
    if (!t) return;
    var dropRec = null, i;
    for (i = 0; i < t.players.length; i++) {
      if (t.players[i].name === dropName) { dropRec = t.players[i]; break; }
    }
    confirmModal('Add ' + f.name + ', drop ' + dropName + '?',
      'Adds ' + f.name + ' to your roster and removes ' + dropName + ' from it — in ' +
      'this app only. It does not touch your league site; do both moves there too.',
      'Add + drop', function () {
        if (dropRec) Store.removePlayer(S.league.me, dropRec.id);
        Store.addPlayer(S.league.me, { name: f.name, pos: f.pos, nfl: f.nfl, bye: f.bye });
        if (window.Sim) Sim.invalidate();
        render();
        toast(dropRec ? 'Added ' + f.name + ', dropped ' + dropName : 'Added ' + f.name);
      }, true);
  }

  function table(head, rows) {
    var t = el('table'), thead = el('thead'), tr = el('tr');
    head.forEach(function (h) { tr.appendChild(el('th', null, h)); });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var x = el('tr'); if (r.me || r.cls) x.className = (r.me ? 'me' : '') + (r.cls ? (r.me ? ' ' : '') + r.cls : '');
      r.cells.forEach(function (c, i) { x.appendChild(el('td', i ? 'num' : null, c)); });
      tb.appendChild(x);
    });
    t.appendChild(tb); return t;
  }

  /* ---------- ADVICE ----------
     The "not built yet" placeholder that used to guard this is gone:
     index.html loads recommend.js unconditionally, so it was unreachable, and
     render()'s own try/catch already turns a real failure into a named error
     card rather than a blank tab. */
  /* ---------- STATS (v6.0) ----------
   * "search for any current NFL player... see the game logs stats line for
   * the player for all games so far this season... calculate the fantasy
   * points... using only the rules for this league. Also include
   * defenses... view game logs by team... sorted by player position...
   * top players... top 10 highest fantasy points scored by position." */
  function statsCtx() {
    return { el: el, table: table, fmt: fmt, modal: modal, toast: toast,
             rerender: render, week: week };
  }
  function viewStats(root) {
    Stats.render(root, statsCtx());
  }

  function viewAdvice(root) {
    Recommend.render(root, { week: week, teamId: S.league.me, el: el, table: table,
      fmt: fmt, toast: toast, modal: modal, jobStart: jobStart, jobStep: jobStep,
      jobEnd: jobEnd, jobRunning: jobRunning, rerender: render,
      handoffCard: handoffCard, adviceHandoff: adviceHandoff,
      gameBadge: gameBadge, earlyGameCard: earlyGameCard, markPlayer: markPlayer });
  }
  /* ---------- LINEUPS = set lineups + advice (2026-09-23b) ---------------
   * Tj's pick #3: "Merge Advice into Lineups (7 tabs -> 6)". Start/sit advice
   * belongs where the lineup is set — ESPN, Sleeper and Yahoo all put it
   * there. Nothing was removed: the old Advice tab is the "Advice" sub-view,
   * rendered by the exact same viewAdvice(), and the same two-chip switch the
   * Data and Stats tabs already use picks between them. Two sub-views rather
   * than one long page on purpose: the advice cards are the heaviest render
   * in the app after Wire, and a lineup edit re-renders the screen — it should
   * not pay for the advice every time a dropdown changes. */
  function isAdviceView() { return view === 'lineups' && lineSub === 'advice'; }
  function lineSubNav() {
    var nav = el('div', 'subnav');
    [['set', 'Set lineups'], ['advice', 'Advice']].forEach(function (t) {
      var on = lineSub === t[0];
      var b = el('button', 'btn sm' + (on ? ' pri' : ''), t[1]);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (lineSub === t[0]) return;
        scrollMem['lineups:' + lineSub] = curScroll();
        lineSub = t[0];
        keepScroll = scrollMem['lineups:' + lineSub] || 0;
        S.settings.lineSub = lineSub;
        if (Store.saveSoon) Store.saveSoon(); else Store.save();
        render();
      });
      nav.appendChild(b);
    });
    return nav;
  }
  function viewLineupsTab(root) {
    root.appendChild(lineSubNav());
    if (lineSub === 'advice') viewAdvice(root);
    else viewLineups(root);
  }

  /* The Advice tab's round trip. Lives here rather than in recommend.js so the
     card, the picker and the paste fallback have exactly one implementation
     shared with the waiver wire. */
  function adviceHandoff() {
    return handoffCard({
      title: 'Or use the Claude app — no API key, no cost',
      blurb: 'Makes a file that explains itself. Send it to the Claude app with ' +
             'no message of your own, and Claude reads this week\'s news for every ' +
             'player on your roster and gives you a file back. Load that here and ' +
             'the advice below fills in exactly as if the key had done it — except ' +
             'it asks about EVERY player, not just the ones worth paying to check.',
      build: function () {
        var opp = null;
        try { opp = (S.weekMeta[String(week)] || {}).opponents || null; } catch (e) { }
        return Handoff.buildAdvice(week, S.league.me, opp);
      },
      apply: function (txt) { return Handoff.importReply(txt, { week: week }); },
      status: function () {
        var a = Recommend.aiCache();
        if (!a || !a.at) return '';
        return 'Currently showing: ' + (a.count || 0) + ' verdict' +
               ((a.count === 1) ? '' : 's') + ' from ' + (a.model || 'Claude') +
               ', week ' + (a.week || '?') + '.';
      }
    });
  }

  /* ---------- DATA: weekly scores + standings ------------------------------
   * Tj, to a different session: "I only want to enter their points scored
   * for each week, and the app should determine whether they won or lost and
   * update all relevant parts of the app accordingly." Every team but his
   * own, right where the standings it feeds are shown — type a number and
   * the record below updates with nothing else to touch. Left blank (or
   * cleared), it falls back to that team's own auto-computed lineup total,
   * same as always; his own score and his live opponent's are never entered
   * here, since those already track live on the Live tab.
   *
   * This card, and the standings table under it, used to live on the Table
   * tab. That tab is gone (the 2026-09-12 request deleted it outright), so
   * both are relocated here rather than dropped — the capability survived,
   * only its home changed.
   *
   * v5.3: Tj, directly — "get rid of the large section with blank fields...
   * make a simple section where I can type in the weekly points for every
   * team. For example, it will say Ron then have a box." The explanatory
   * paragraph and the faint placeholder preview (that week's auto-computed
   * total, shown greyed-out in an otherwise-empty box) are both gone — they
   * were exactly what made an intentionally blank, ready-to-type field read
   * as clutter. One row per team: its name, then its box. Nothing else. */
  function weeklyScoresCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Enter week ' + week + ' scores'));
    S.teams.forEach(function (t) {
      if (t.id === S.league.me) return;
      var row = el('div', 'row');
      row.appendChild(el('div', 'nm', t.name));
      var manual = Store.getManualScore(week, t.id);
      var inp = el('input'); inp.type = 'number'; inp.step = '0.1'; inp.className = 'scoreInput';
      inp.value = manual !== null ? String(manual) : '';
      inp.addEventListener('change', function () {
        Store.setManualScore(week, t.id, inp.value);
        if (window.Sim) Sim.invalidate();
        render();
      });
      row.appendChild(inp);
      c.appendChild(row);
    });
    return c;
  }
  /* Just the win/loss table that used to open the Table tab — enough to see
     what entering a score above just did, without rebuilding the season
     points and weekly-high-score cards nobody asked to keep. */
  function standingsCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Standings'));
    var st = Store.standings(Math.max(week, 1));
    /* the playoff line under the last seed in, as ESPN and Yahoo draw it —
       top 6 of 10 make it (RULES_2026.md §LEAGUE STRUCTURE; Sim.PLAYOFF_TEAMS) */
    var cut = (window.Sim && Sim.PLAYOFF_TEAMS) || 6;
    c.appendChild(table(['Team', 'W', 'L', 'T', 'Points'], st.byRecord.map(function (r, i) {
      return { me: r.id === S.league.me, cls: (i === cut - 1 && st.byRecord.length > cut) ? 'cut' : '',
               cells: [(i + 1) + '. ' + r.name, r.w, r.l, r.t, fmt(r.pts)] };
    })));
    c.appendChild(el('p', 'hint', 'Top ' + cut + ' make the playoffs (the line); the top 2 get a first-round bye.'));
    return c;
  }

  /* ---------- weekly recap (2026-09-15g) ---------------------------------
   * Tj: "Build the 'weekly recap' Claude write-up feature you told me
   * about. Make the button where it is most appropriate but it shouldn't
   * push away any major feature because I probably won't use it much."
   *
   * recap.js's build()/text() already compute a full, real, FACT-BASED
   * recap from scored weeks — high/low score, closest and biggest games,
   * the best individual week in the whole NFL, the best/worst starter, the
   * biggest bench regret — with no Claude and no network at all. Claude's
   * only job (ai.js's recap(), the one piece that was actually unwired) is
   * turning that fact sheet into something readable for the league chat.
   * So this works fully without an API key — Ai.recap() is offered as an
   * optional "make it read less like a spreadsheet" step, never a
   * requirement, matching the honest-degradation rule every other Claude
   * feature in this app already follows.
   *
   * Deliberately ONE small card, not a big one: he said he probably won't
   * use it much, so it does not compete for space with anything he opens
   * every week (Weekly scores, Standings, matchups all render before it).
   */
  function latestScoredWeek() {
    var w;
    for (w = week; w >= 1; w--) { if (Store.weekIsScored(w)) return w; }
    return 0;
  }
  function weeklyRecapCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Weekly recap'));
    var rw = latestScoredWeek();
    if (!rw) {
      c.appendChild(el('p', 'muted', 'No week is fully scored yet — a recap needs at ' +
        'least one week finished and synced.'));
      return c;
    }
    c.appendChild(el('p', 'muted', 'High score, closest game, best and worst starter ' +
      'and more for week ' + rw + ', built from your own league\'s real results.'));
    var btn = el('button', 'btn pri', 'View week ' + rw + ' recap');
    btn.addEventListener('click', function () { openRecapDialog(rw); });
    c.appendChild(btn);
    return c;
  }
  function openRecapDialog(rw) {
    var facts = Recap.text(rw);
    if (!facts) { toast('Week ' + rw + ' is not fully scored — nothing to recap yet.'); return; }
    var preEl, writeBtn;
    dialog('Week ' + rw + ' recap', null, function (box, dlgRow, close) {
      preEl = el('pre');
      preEl.style.cssText = 'white-space:pre-wrap;font-size:13px;margin:0 0 12px;' +
        'font-family:inherit;line-height:1.5';
      preEl.textContent = facts;
      box.appendChild(preEl);
      if (window.Ai && Ai.configured()) {
        writeBtn = el('button', 'btn', 'Write it up with Claude');
        writeBtn.style.marginBottom = '10px';
        writeBtn.addEventListener('click', function () {
          writeBtn.disabled = true; writeBtn.textContent = 'Writing…';
          Ai.recap(facts, rw).then(function (written) {
            if (preEl) preEl.textContent = written;
            if (writeBtn) { writeBtn.disabled = false; writeBtn.hidden = true; }
          }).catch(function (e) {
            if (writeBtn) { writeBtn.disabled = false; writeBtn.textContent = 'Write it up with Claude'; }
            toast('Claude could not write it up: ' + (e && e.message ? e.message : e), 6000);
          });
        });
        box.insertBefore(writeBtn, preEl);
      }
      var share = el('button', 'btn', 'Share');
      share.addEventListener('click', function () {
        if (!(window.Native && Native.share)) { toast('No share sheet on this build'); return; }
        if (!Native.share(preEl.textContent)) toast('Could not open the share sheet');
      });
      var copy = el('button', 'btn', 'Copy');
      copy.addEventListener('click', function () {
        if (window.Native && Native.copy && Native.copy(preEl.textContent)) toast('Copied');
        else toast('Could not copy');
      });
      var ok = el('button', 'btn pri', 'Close');
      ok.addEventListener('click', close);
      dlgRow.appendChild(share); dlgRow.appendChild(copy); dlgRow.appendChild(ok);
    });
  }

  /* ---------- DATA ---------- */
  /* Tj, 2026-09-15g: "organize the data tab with sub navigation that is
   * smart and easy to understand." Grouped by WHAT a card is for, not an
   * arbitrary split: League (the season's own data — scores, standings,
   * matchups, scoring rules, the new recap), Claude (the two AI-related
   * cards), Sync & data (where the numbers come from and its health),
   * App (device/app behaviour and maintenance). Every card that existed
   * before this landed in exactly one of the four, in its original order
   * within that group — nothing was cut, only regrouped. */
  var DATA_SUBTABS = [['league', 'League'], ['claude', 'Claude'],
                       ['sync', 'Sync & data'], ['app', 'App']];
  function dataSubNav() {
    var nav = el('div');
    nav.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px';
    DATA_SUBTABS.forEach(function (t) {
      var on = dataSubView === t[0];
      var b = el('button', 'btn sm' + (on ? ' pri' : ''), t[1]);
      b.addEventListener('click', function () {
        if (dataSubView === t[0]) return;
        dataSubView = t[0]; render();
      });
      nav.appendChild(b);
    });
    return nav;
  }
  function viewData(root) {
    var warn = feedWarnBanner(); if (warn) root.appendChild(warn);
    root.appendChild(dataSubNav());
    if (dataSubView === 'league') viewDataLeague(root);
    else if (dataSubView === 'claude') viewDataClaude(root);
    else if (dataSubView === 'sync') viewDataSync(root);
    else viewDataApp(root);
  }
  /* ---------- POWER RANKINGS + PLAYOFF ODDS (2026-09-23b) ---------------
   * Tj's pick #5. sim.js has computed these since v1.x — all-play records, a
   * luck index, a full rest-of-season simulation — and nothing ever showed
   * them. Power and all-play are instant. The odds are 3,000 simulated
   * seasons (~100ms at Moto G speed), so they are cached on the store
   * generation and, when stale, computed just AFTER the tab has painted
   * (afterPaint) and patched into the table in place: opening Data never
   * waits on them. */
  var _oddsMemo = null, _oddsTurn = 0;
  function oddsKey() {
    return (Store.generation ? Store.generation() : 0) + '|' + S.league.regularSeasonWeeks;
  }
  function powerCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Power rankings · playoff odds'));
    var reg = S.league.regularSeasonWeeks, scored = 0, w;
    for (w = 1; w <= reg; w++) if (Store.weekIsScored(w)) scored++;
    if (!scored) {
      c.appendChild(el('p', 'muted', 'Appears once the first week is final. Power rankings ' +
        'judge every team against every other team, every week, so they need real results.'));
      return c;
    }
    var pw = Sim.power(reg), key = oddsKey();
    var odds = (_oddsMemo && _oddsMemo.k === key) ? _oddsMemo.v : null;
    var byId = {};
    if (odds) odds.rows.forEach(function (r) { byId[r.id] = r; });
    function pct(x) { return x >= 0.995 ? '>99%' : (x > 0 && x < 0.005 ? '<1%' : Math.round(x * 100) + '%'); }
    var t = table(['Team', 'All-play', 'Luck', 'Playoffs', 'Title'], pw.map(function (r) {
      var o = byId[r.id];
      var luck = Math.abs(r.luck) < 0.05 ? '0.0' : (r.luck > 0 ? '+' : '−') + fmt(Math.abs(r.luck));
      return { me: r.id === S.league.me,
               cells: [r.rank + '. ' + r.name, r.allPlayW + '-' + r.allPlayL, luck,
                       o ? pct(o.playoff) : '…', o ? pct(o.title) : '…'] };
    }));
    c.appendChild(t);
    var note = el('p', 'hint clamp',
      'Ranked on how good, not how lucky: the all-play record (your score against ' +
      'every team, every week) plus points per game. Luck = your real wins minus the ' +
      'wins that all-play record would expect — plus means the schedule has been kind. ' +
      'Odds: 3,000 simulated rests-of-season from every team\'s scored weeks in this ' +
      'league\'s points, with the uncertainty of a short season built in (top 6 make ' +
      'the playoffs, top 2 get byes, ties go to points).');
    note.addEventListener('click', function () { note.classList.toggle('open'); });
    var left = el('p', 'hint');
    c.appendChild(note);
    c.appendChild(left);
    function fillOdds(v) {
      var tb = t.children[1], i;
      byId = {}; v.rows.forEach(function (r) { byId[r.id] = r; });
      for (i = 0; i < pw.length && tb && i < tb.children.length; i++) {
        var o = byId[pw[i].id], tr = tb.children[i];
        if (!o || !tr || tr.children.length < 5) continue;
        tr.children[3].textContent = pct(o.playoff);
        tr.children[4].textContent = pct(o.title);
      }
      var remaining = reg - scored;
      /* Sim.season plays EVERY unplayed week now (2026-09-24): an opponent
         nobody entered is drawn at random in each simulated season, rather
         than the game being skipped (which froze today's standings into
         ">99%" and "0%"). Say so, since the real schedule would be sharper. */
      left.textContent = v.randomWeeks
        ? 'Matchups are missing in ' + v.randomWeeks + ' of the ' + remaining + ' unplayed ' +
          'regular-season week' + (remaining === 1 ? '' : 's') + ', so those games are ' +
          'simulated against random opponents. Enter the real ones under the week\'s ' +
          'matchups below for odds on your actual schedule.'
        : '';
      left.hidden = !left.textContent;
    }
    left.hidden = true;
    if (odds) fillOdds(odds);
    else {
      var myTurn = ++_oddsTurn;
      afterPaint(function () {
        if (myTurn !== _oddsTurn) return;   /* a newer render of the card owns it */
        /* only if he is still looking at it — otherwise the next visit pays */
        if (asleep || view !== 'data' || dataSubView !== 'league') return;
        try {
          var v = Sim.season(reg);
          _oddsMemo = { k: oddsKey(), v: v };
          fillOdds(v);
        } catch (e) { left.textContent = 'Odds could not be computed: ' + (e && e.message ? e.message : e); left.hidden = false; }
      });
    }
    return c;
  }
  function viewDataLeague(root) {
    addSafe(root, 'Weekly scores', weeklyScoresCard);
    addSafe(root, 'Standings', standingsCard);
    addSafe(root, 'Power rankings', powerCard);
    /* matchups */
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Week ' + week + ' matchups'));
    var mus = Store.getMatchups(week);
    mus.forEach(function (p, i) {
      var r = el('div', 'row');
      r.appendChild(el('div', 'nm', nameOf(p[0]) + '  vs  ' + nameOf(p[1])));
      var x = el('button', 'btn sm dan', 'Remove');
      x.addEventListener('click', function () { mus.splice(i, 1); Store.setMatchups(week, mus); render(); });
      r.appendChild(x); c.appendChild(r);
    });
    var sa = el('select'), sb = el('select');
    S.teams.forEach(function (t) { sa.appendChild(new Option(t.name, t.id)); sb.appendChild(new Option(t.name, t.id)); });
    if (S.teams.length > 1) sb.selectedIndex = 1;
    var sp = el('div', 'split'); sp.style.marginTop = '8px';
    sp.appendChild(sa); sp.appendChild(sb);
    c.appendChild(sp);
    var add = el('button', 'btn pri', 'Add matchup'); add.style.marginTop = '8px';
    add.addEventListener('click', function () {
      if (sa.value === sb.value) { toast('Pick two different teams'); return; }
      Store.addMatchup(week, sa.value, sb.value); render();
    });
    c.appendChild(add);
    /* the whole season at once (v2.8) — circle method, and it refuses to
       touch a week that already has results */
    var gen = el('button', 'btn', 'Generate the whole season');
    gen.style.marginTop = '8px';
    gen.addEventListener('click', function () {
      var go = el('button', 'btn pri', 'Generate');
      go.style.marginBottom = '8px';
      go.addEventListener('click', function () {
        var r = Recap.generateSchedule({});
        var back = go.parentNode && go.parentNode.parentNode;
        if (back && back.parentNode) back.parentNode.removeChild(back);
        if (window.Sim) Sim.invalidate();
        render();
        toast('Wrote ' + r.weeks + ' week' + (r.weeks === 1 ? '' : 's') +
              (r.skipped.length ? ', kept ' + r.skipped.length + ' already played' : ''));
      });
      modal('Generate a full round robin?',
        'Ten teams over ' + S.league.regularSeasonWeeks + ' weeks: a complete ' +
        'round robin (everyone plays everyone once in nine weeks), then the first ' +
        'five rounds again with the order swapped.\n\nAny week that already has ' +
        'results is left exactly as it is — this cannot overwrite a played week.', go);
    });
    c.appendChild(gen);

    var auto = el('button', 'btn', 'Auto-pair remaining'); auto.style.marginTop = '8px';
    auto.addEventListener('click', function () {
      var used = {}; Store.getMatchups(week).forEach(function (p) { used[p[0]] = 1; used[p[1]] = 1; });
      var free = S.teams.filter(function (t) { return !used[t.id]; });
      while (free.length > 1) Store.addMatchup(week, free.shift().id, free.shift().id);
      render();
    });
    c.appendChild(auto);
    root.appendChild(c);

    addSafe(root, 'Weekly recap', weeklyRecapCard);
    root.appendChild(scoringCard());
  }
  function viewDataSync(root) {
    /* sync + diagnostics */
    var c2 = el('div', 'card');
    c2.appendChild(el('h2', null, 'Stats feed'));
    var m = S.weekMeta[String(week)];
    c2.appendChild(el('p', 'muted', m && m.synced
      ? ('Week ' + week + ': ' + m.games + ' games, ' + (m.allFinal ? 'all final' : 'in progress') +
         ', ' + m.matched + ' of ' + m.rostered + ' rostered players matched.' + (m.estFG ? ' Field-goal distances estimated for some kickers.' : ''))
      : ('Week ' + week + ' has not been synced. Tap Sync week at the top.')));
    if (m && m.synced && m.reused !== undefined) {
      c2.appendChild(el('p', 'muted', 'Last sync fetched ' + m.fetched + ' box score' +
        (m.fetched === 1 ? '' : 's') + ' and reused ' + m.reused +
        ' already-final game' + (m.reused === 1 ? '' : 's') +
        (m.failed ? ', ' + m.failed + ' failed' : '') + '. ' +
        (m.bookSize || 0) + ' players are in the league book.'));
    }
    if (m && m.feedWarn) {
      var fw = el('p', null, 'FEED ALARM: ' + m.feedWarn);
      fw.style.color = 'var(--bad)';
      c2.appendChild(fw);
    }
    var st = el('button', 'btn', 'Run feed self-test');
    st.addEventListener('click', selfTest);
    c2.appendChild(st);
    if (m && m.unmatched && m.unmatched.length) {
      var d = el('details');
      d.appendChild(el('summary', null, m.unmatched.length + ' rostered players had no stat line ▾'));
      d.appendChild(el('p', 'muted', m.unmatched.join(', ')));
      d.appendChild(el('p', 'muted', 'Normal for players who did not play, were inactive, or are on bye. If a starter is here every week, his name may not match ESPN’s spelling — drop and re-add him with the exact ESPN name.'));
      c2.appendChild(d);
    }
    root.appendChild(c2);

    /* player database */
    var cdb = el('div', 'card');
    cdb.appendChild(el('h2', null, 'Player database'));
    var dm = PlayerDB.meta();
    cdb.appendChild(el('p', 'muted', dm.count + ' players · ' +
      (dm.updated ? 'refreshed ' + dm.updated.slice(0, 10) : 'bundled with the app, never refreshed') +
      '. Used by roster search so you never type a position or team by hand.'));
    cdb.appendChild(el('p', 'hint', 'Also refreshes itself quietly in the background — at least every ' +
      Math.round(PlayerDB.STALE_MS / 86400000) + ' days, and whenever the free-agent wire is checked or ' +
      'refreshed — so this button is only for forcing it right now.'));
    var rb = el('button', 'btn pri', jobRunning('db') ? 'Refreshing…' : 'Refresh from ESPN (needs internet)');
    rb.disabled = jobRunning('db');
    rb.addEventListener('click', function () {
      rb.disabled = true; rb.textContent = 'Refreshing…';
      jobStart('db', 'Player database: starting…');
      /* PlayerDB.refresh() shares its single in-flight attempt with the
         quiet background path (boot/resume/wire) — if one happens to
         already be running, this attaches to it instead of starting a
         second, so the progress text below just sits on "starting…" until
         it resolves rather than showing per-team updates. Rare (a
         background refresh finishes in well under a minute) and harmless:
         the completion toast/modal below is unaffected either way. */
      PlayerDB.refresh(function (done, total, ab) {
        jobStep(done >= total ? 'Player database: saving…'
                              : ('Player database: ' + ab + '  ' + done + '/' + total),
                Math.round(done * 100 / total));
      }).then(function (r) {
        jobEnd();
        var msg = (r.added || r.updated || r.removed)
          ? (r.total + ' players · ' + r.added + ' new, ' + r.updated + ' changed' +
             (r.removed ? ', ' + r.removed + ' removed (no longer on any of the 32 rosters)' : ''))
          : (r.total + ' players · already up to date');
        render();
        if (r.failed.length) modal('Player database', msg + '\n\nThese teams failed every route:\n  ' +
          r.failed.join('\n  ') + '\n\nEverything else was saved. Each entry lists what every ' +
          'route returned, so the cause is in there.');
        else toast(msg, 6000);
      }).catch(function (e) {
        jobEnd(); rb.disabled = false;
        toast('Refresh failed: ' + (e && e.message ? e.message : e), 8000);
        render();
      });
    });
    cdb.appendChild(rb);
    /* If the player database ever carries one man twice under two spellings
       AND the two copies name different NFL teams, one of them has a wrong bye
       week — and in a league with no auto-substitution a wrong bye is a zero.
       PlayerDB.init() collapses them; this says so rather than letting the
       merge be silent. */
    var dup = (PlayerDB.meta().dupes || []);
    if (dup.length) {
      var dw = el('div', 'card');
      dw.appendChild(el('h2', null, 'Duplicate players merged'));
      dw.appendChild(el('p', 'muted', dup.length + ' player' + (dup.length > 1 ? 's are' : ' is') +
        ' in the database twice under two spellings, and the copies disagree about ' +
        'the NFL team — so one of them has the wrong bye week. They have been ' +
        'merged into one, but check the team is right before you rely on the bye.'));
      dup.forEach(function (d) {
        dw.appendChild(el('div', 'kv')).innerHTML =
          '<span>' + esc(d.name) + ' / ' + esc(d.alt) + ' (' + esc(d.pos) + ')</span><b>' +
          esc(d.teams.join(' vs ')) + '</b>';
      });
      cdb.appendChild(dw);
    }
    var dg = el('button', 'btn'); dg.textContent = 'Diagnose a team'; dg.style.marginTop = '8px';
    dg.addEventListener('click', function () {
      textModal('Diagnose a team', 'Which NFL team code? For example ARI, KC, WSH.',
                'ARI', 'Test it', function (raw) {
      var ab = String(raw || '').toUpperCase().trim();
      if (!ab) return;
      if (PlayerDB.TEAMS.indexOf(ab) < 0) { toast('Unknown code: ' + ab); return; }
      dg.disabled = true; dg.textContent = 'Testing ' + ab + '…';
      PlayerDB.diagnose(ab).then(function (txt) {
        dg.disabled = false; dg.textContent = 'Diagnose a team';
        modal('Route test · ' + ab, txt +
          '\n\nEach line is one way of asking ESPN for that roster. ' +
          'Send this to Claude — it says exactly which routes your network allows.');
      }).catch(function (e) {
        dg.disabled = false; dg.textContent = 'Diagnose a team';
        modal('Route test failed', String(e && e.message ? e.message : e));
      });
      });
    });
    cdb.appendChild(dg);
    root.appendChild(cdb);
  }
  function viewDataClaude(root) {
    root.appendChild(aiCard());
    root.appendChild(usageCard());
  }
  function viewDataApp(root) {
    addSafe(root, 'Lineup alerts', alertCard);
    root.appendChild(liveCard());

    /* screen fit */
    var cs = el('div', 'card');
    cs.appendChild(el('h2', null, 'Screen fit'));
    var ins = window.__insets || { seen: false, t: 0, b: 0 };
    cs.appendChild(el('p', 'muted', ins.seen
      ? ('Detected system bars: ' + Math.round(ins.t) + 'px at the top, ' +
         Math.round(ins.b) + 'px at the bottom. The header and tab bar are padded by that much.')
      : 'The app has not received inset sizes from Android. Using the sliders below.'));

    /* WHY THIS READOUT EXISTS (2026-09-08).
     * Tj: "notice the bottom navigation has shifted up for some reason." The
     * tab bar is position:fixed;bottom:0, so nothing in the page content can
     * move it — only three numbers can, and until now none of them were
     * visible: the system-bar inset Android reports, the saved adjBot slider,
     * and the bar's own height. adjBot in particular is SAVED STATE that
     * survives every update, so a value set once to fix something else looks
     * exactly like a regression months later. All three are now on screen, and
     * the measured height is compared against the computed one so a CSS
     * mismatch of the kind that caused the 124px dead band shows itself. */
    var tabsEl = $('tabs');
    var measured = (tabsEl && tabsEl.offsetHeight) ? tabsEl.offsetHeight : 0;
    /* A PROBE, NOT getComputedStyle.
       getPropertyValue('--tabh') hands back the SPECIFIED value of the custom
       property — the literal string "calc(var(--tab-h) + 1px + ...)" — not a
       resolved length, so parseFloat on it is NaN and this whole check would
       have silently reported nothing. Custom properties only resolve when they
       are USED, so the reliable way to ask "what does --tabh come out as" is to
       give something that height and measure it. */
    var computed = 0;
    try {
      var probe = el('div');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;' +
                            'height:var(--tabh);pointer-events:none';
      document.body.appendChild(probe);
      computed = probe.offsetHeight || 0;
      document.body.removeChild(probe);
    } catch (e) { computed = 0; }
    var bits = [];
    bits.push('Tab bar: ' + (measured ? measured + 'px tall' : 'not measured yet'));
    if (computed) bits.push('CSS expects ' + computed + 'px');
    bits.push('bottom inset ' + Math.round(ins.b || 0) + 'px');
    bits.push('your extra padding ' + (S.settings.adjBot || 0) + 'px');
    cs.appendChild(el('p', 'hint', bits.join('  ·  ')));

    if (measured && computed && Math.abs(measured - computed) > 2) {
      var mm = el('p', 'warnText',
        'The bar measures ' + measured + 'px but the stylesheet expects ' + computed +
        'px. That gap is a layout bug, not a setting — tell Claude these two numbers.');
      cs.appendChild(mm);
    }
    if (Number(S.settings.adjBot || 0) > 0) {
      var w = el('p', 'warnText',
        'Extra bottom padding is set to ' + S.settings.adjBot + 'px, which lifts the ' +
        'tab bar by that much. This is a saved setting, so it survives every ' +
        'update — if the bar looks too high, this is the first thing to try.');
      cs.appendChild(w);
      var fix = el('button', 'btn sm pri', 'Put the tab bar back down');
      fix.addEventListener('click', function () {
        S.settings.adjBot = 0; Store.save(); applyAdjust(); render();
        toast('Extra bottom padding cleared');
      });
      cs.appendChild(fix);
    }
    [['adjTop', 'Extra top padding'], ['adjBot', 'Extra bottom padding']].forEach(function (f) {
      var lab = el('label', 'f', f[1] + ': ' + (S.settings[f[0]] || 0) + 'px');
      var rng = el('input'); rng.type = 'range'; rng.min = '0'; rng.max = '80'; rng.step = '2';
      rng.value = String(S.settings[f[0]] || 0);
      rng.style.width = '100%';
      rng.addEventListener('input', function () {
        S.settings[f[0]] = Number(this.value);
        lab.textContent = f[1] + ': ' + this.value + 'px';
        applyAdjust();
      });
      rng.addEventListener('change', function () { Store.save(); });
      cs.appendChild(lab); cs.appendChild(rng);
    });
    var rz = el('button', 'btn sm', 'Reset both to 0');
    rz.addEventListener('click', function () {
      S.settings.adjTop = 0; S.settings.adjBot = 0; Store.save(); applyAdjust(); render();
    });
    cs.appendChild(rz);
    cs.appendChild(el('p', 'hint', 'If the top or bottom is still clipped, drag these until it sits right. ' +
      'The value is saved and applied every launch.'));
    root.appendChild(cs);

    /* backup */
    var c3 = el('div', 'card');
    c3.appendChild(el('h2', null, 'Backup'));
    var ab = S.settings.autoBackupAt;
    c3.appendChild(el('p', 'muted', 'Everything lives on this phone, saved the moment you change it. ' +
      'An invisible safety copy is kept automatically after every sync and every 10 edits — ' +
      'it never shows up in Downloads or a file manager, and the oldest ones are cleared out ' +
      'once there are more than 8, only after a new one finishes writing' +
      (ab ? ' — last one ' + ab.slice(0, 16).replace('T', ' ') + '.' : '.')));
    var ex = el('button', 'btn pri', 'Export backup');
    ex.addEventListener('click', function () {
      var js = Store.exportJSON();
      var fn = 'fftracker-backup-w' + week + '.json';
      if (window.Native && Native.export) { Native.export(fn, js); toast('Saved to Downloads: ' + fn); }
      else {
        textModal('Copy this backup', 'Select all and copy. This is your whole season — ' +
          js.length.toLocaleString() + ' characters. Keep it somewhere you can paste from.',
          js, 'Done', function () { });
      }
    });
    c3.appendChild(ex);
    var im = el('button', 'btn'); im.textContent = 'Import backup'; im.style.marginTop = '8px';
    im.addEventListener('click', function () {
      textModal('Import a backup',
        'Paste a backup JSON. Nothing is replaced until it has been checked, so a ' +
        'bad paste cannot damage the season you have now.',
        '', 'Import it', function (txt) {
        if (!txt || !txt.trim()) return;
        try { Store.importJSON(txt); S = Store.get(); renderTop(); toast('Imported'); }
        catch (e) { modal('That backup was not usable', String(e && e.message ? e.message : e) +
          '\n\nNothing was changed — the season you had is still here.'); }
      });
    });
    c3.appendChild(im);
    var rb = el('button', 'btn'); rb.textContent = 'Restore from auto-backup'; rb.style.marginTop = '8px';
    rb.addEventListener('click', function () {
      if (!(window.Native && Native.backupList)) { toast('No auto-backups on this device'); return; }
      var list;
      try { list = JSON.parse(Native.backupList() || '[]'); } catch (e) { list = []; }
      if (!list.length) { toast('No auto-backups yet'); return; }
      dialog('Restore from auto-backup',
        'These are the invisible safety copies this app kept on its own — the ' +
        'newest ' + list.length + ' shown first. Nothing changes until you pick ' +
        'one and confirm.',
        function (box, row, close) {
        list.forEach(function (b) {
          var d = new Date(b.mtime);
          var btn = el('button', 'btn');
          btn.style.cssText = 'display:block;width:100%;margin-bottom:6px;text-align:left';
          btn.textContent = d.toLocaleString() + '  ·  ' + Math.round(b.size / 1024) + ' KB';
          btn.addEventListener('click', function () {
            close();
            confirmModal('Restore this backup?',
              'This replaces everything currently on screen with the snapshot ' +
              'from ' + d.toLocaleString() + '. The season you have now is not ' +
              'touched until you confirm.',
              'Restore', function () {
              var txt = Native.backupLoad(b.name);
              if (!txt) { toast('Could not read that backup'); return; }
              try { Store.importJSON(txt); S = Store.get(); renderTop(); toast('Restored'); }
              catch (e) { modal('That backup was not usable', String(e && e.message ? e.message : e)); }
            }, true);
          });
          box.appendChild(btn);
        });
        var cancel = el('button', 'btn', 'Cancel');
        cancel.addEventListener('click', close);
        row.appendChild(cancel);
      });
    });
    c3.appendChild(rb);
    var rs = el('button', 'btn dan'); rs.textContent = 'Reset to drafted rosters'; rs.style.marginTop = '8px';
    rs.addEventListener('click', function () {
      confirmModal('Wipe everything?',
        'This deletes every lineup, every synced week and every transaction, and ' +
        'reloads the ten drafted rosters. Export a backup first if you are not sure.',
        'Wipe it', function () {
        Store.resetToSeed(seed); S = Store.get(); renderTop(); toast('Reset');
      }, true);
    });
    c3.appendChild(rs);
    var tx = el('details');
    tx.appendChild(el('summary', null, 'Transactions (' + S.transactions.length + ') ▾'));
    S.transactions.slice(0, 40).forEach(function (t) {
      tx.appendChild(el('div', 'kv')).innerHTML =
        '<span>' + esc(t.at.slice(0, 10)) + ' ' + esc(t.type) + ' ' + esc(t.player) + '</span><b>' + esc(t.team) + '</b>';
    });
    c3.appendChild(tx);
    root.appendChild(c3);

    var ver = el('div', 'card');
    ver.appendChild(el('h2', null, 'About'));
    ver.appendChild(el('p', 'muted', 'League Tracker v' +
      (window.APP_VERSION || '?') + ' · season ' + S.settings.season +
      ' · ' + Store.allPlayers().length + ' rostered players'));
    root.appendChild(ver);
  }
  function nameOf(id) { var t = Store.team(id); return t ? t.name : id; }

  /* ---------- Data: scoring rules, in full, computed not claimed ---------- */
  function scoringCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Scoring rules'));
    c.appendChild(el('p', 'muted',
      'Every line below is read out of the live scoring engine, not typed into ' +
      'this screen — so if the app pays something different from what you see ' +
      'here, that is impossible rather than merely unlikely. Ground truth is ' +
      'RULES_2026.md, transcribed from your league\'s rules sheet.'));

    Scoring.describe().forEach(function (grp) {
      var d = el('details');
      d.appendChild(el('summary', null, grp.title + ' ▾'));
      grp.rows.forEach(function (r) {
        var kv = el('div', 'kv');
        kv.appendChild(el('span', null, r[0]));
        kv.appendChild(el('b', null, r[1]));
        d.appendChild(kv);
      });
      c.appendChild(d);
    });

    var audit = Scoring.selfAudit();
    var ad = el('details');
    ad.appendChild(el('summary', null,
      'Live check: ' + audit.pass + '/' + audit.total + ' worked examples ' +
      (audit.pass === audit.total ? 'agree' : 'DISAGREE') + ' ▾'));
    audit.cases.forEach(function (x) {
      var kv = el('div', 'kv');
      kv.appendChild(el('span', x.ok ? null : 'warnText', x.pos + ' · ' + x.name));
      kv.appendChild(el('b', null, (x.ok ? '' : 'got ' + x.got + ' want ') + x.exp));
      ad.appendChild(kv);
    });
    ad.appendChild(el('p', 'hint',
      'These run on your phone every time you open this screen. Each one is a ' +
      'full stat line for a position, scored by the same code that scores real ' +
      'games, checked against arithmetic done by hand off the rules sheet.'));
    c.appendChild(ad);

    /* This was a dropdown until v4.7 — the one item the rules image left
       ambiguous. Tj settled it, so it is a stated fact now, not a setting. */
    c.appendChild(el('p', 'hint',
      'Return touchdowns: the +6 goes to the D/ST, once. A kick or punt return ' +
      'TD pays the defense and not the returning player, and a defensive TD is ' +
      'never scored twice. This was a setting until v4.7; you settled it, so it ' +
      'is fixed in the engine now. The app still records return TDs on the ' +
      'player\'s line so you can see them on his card — they are just worth 0.'));

    /* STALE TEXT (found and fixed in the 2026-09-19 sweep). This used to say
       these three bonuses were "not modelled" and had to be added by hand —
       true when it was written, but Scoring.applyWeeklyBonuses has since
       been wired into doSync (ui.js): once every game in a week is final, it
       scans every player's box-score "long" reception/rush and the QB with
       the most completions on the team that owns the longest reception, and
       credits the +5 automatically, league-wide, not only for rostered
       players. Telling Tj it still needs a manual adjustment was actively
       wrong: following that advice today would double the bonus, once from
       the automatic pass and once from the manualAdj he added believing the
       app had not. See test_scoring.js's own "weekly league-wide +5 bonuses"
       block and doSync's "league-wide longest-play bonuses" comment for the
       one known imprecision this still carries (a two-QB game can credit
       the wrong quarterback), which IS worth knowing before overriding one
       by hand. */
    c.appendChild(el('p', 'hint',
      'The three league-wide +5 bonuses (longest completion, reception and rush) ' +
      'are applied automatically once a week is fully final — scanned from every ' +
      'game\'s box score, not just your rostered players\' games, the same way the ' +
      'rules require. The one thing it cannot always get right: if a team plays ' +
      'two different quarterbacks in a game, the completion bonus can credit ' +
      'whichever one threw the most passes that game rather than whoever actually ' +
      'threw the longest one. Correct that one case by hand, on the Live tab, as a ' +
      'labelled adjustment — everything else needs no adjustment at all.'));
    return c;
  }

  /* ---------- Data: Claude ---------- */
  function aiCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Claude reasoning (optional)'));
    c.appendChild(el('p', 'muted',
      'With an Anthropic API key, Sync advice has Claude search current news for ' +
      'every player on your roster — practice reports, designations, suspensions, ' +
      'snap restrictions — and adjust each projection with its reasoning shown ' +
      'and sourced. Without a key everything else still works; only this layer ' +
      'is skipped. The key is stored on this phone and sent only to Anthropic.'));

    var lab = el('label', 'f', 'API key');
    var inp = el('input'); inp.type = 'password';
    inp.setAttribute('autocomplete', 'off'); inp.setAttribute('autocorrect', 'off');
    inp.setAttribute('autocapitalize', 'none'); inp.setAttribute('spellcheck', 'false');
    inp.placeholder = 'sk-ant-…';
    inp.value = S.settings.aiKey || '';
    inp.addEventListener('change', function () {
      S.settings.aiKey = this.value.trim(); Store.save();
      toast(S.settings.aiKey ? 'Key saved' : 'Key cleared');
    });
    c.appendChild(lab); c.appendChild(inp);

    /* ---- model pickers (v3.3) ------------------------------------------
     * Was a free-text box, which cannot tell a typo from a retired model id —
     * both come back as the same 404 in the middle of a sync. A hard-coded
     * list would go stale instead. So the list is fetched from GET /v1/models
     * with the key that is already here, cached in settings, and always ends
     * with a Custom row so a model newer than the cache stays reachable. */
    c.appendChild(modelPicker('Main model — used for the players that matter',
      'aiModel', Ai.DEFAULT_MODEL));
    c.appendChild(modelPicker('Routine model — the cheap pass over settled players',
      'aiCheapModel', Ai.CHEAP_MODEL));

    var refresh = el('button', 'btn sm', 'Refresh the model list');
    var mstamp = el('p', 'hint', modelListNote());
    refresh.addEventListener('click', function () {
      refresh.disabled = true; refresh.textContent = 'Asking Anthropic…';
      Ai.listModels().then(function (list) {
        S = Store.get();
        refresh.disabled = false; refresh.textContent = 'Refresh the model list';
        toast(list.length + ' models available');
        render();
      })['catch'](function (e) {
        refresh.disabled = false; refresh.textContent = 'Refresh the model list';
        mstamp.textContent = 'Could not fetch the list: ' + ((e && e.message) ? e.message : e) +
          '  ·  the picker still works and Custom always does.';
      });
    });
    var mrow = el('div', 'dbrow'); mrow.appendChild(refresh);
    c.appendChild(mrow); c.appendChild(mstamp);

    /* ---- what a sync is allowed to spend (v2.4) ------------------------- */
    var dlab = el('label', 'f', 'How much to research each sync');
    var dsel = el('select');
    [['smart', 'Smart — only players whose answer could change (default)'],
     ['full',  'Full — every player, every sync (the old behaviour)'],
     ['cheap', 'Cheap — smart, on the cheaper model']].forEach(function (o) {
      var op = el('option', null, o[1]); op.value = o[0];
      if ((S.settings.aiDepth || 'smart') === o[0]) op.selected = true;
      dsel.appendChild(op);
    });
    dsel.addEventListener('change', function () {
      S.settings.aiDepth = this.value; Store.save(); render();
    });
    c.appendChild(dlab); c.appendChild(dsel);

    var flab = el('label', 'f', 'A clear verdict stays good for (days)');
    var finp = el('input'); finp.type = 'number'; finp.min = '0.5'; finp.step = '0.5';
    finp.value = String(S.settings.aiFreshDays === undefined ? 3 : S.settings.aiFreshDays);
    finp.addEventListener('change', function () {
      var v = parseFloat(this.value);
      S.settings.aiFreshDays = (isFinite(v) && v > 0) ? v : 3; Store.save();
    });
    c.appendChild(flab); c.appendChild(finp);
    c.appendChild(el('p', 'hint',
      'A web search costs roughly what ten thousand input tokens cost, so what ' +
      'a sync spends is decided almost entirely by how many players it searches ' +
      'for. On Smart, anyone carrying an injury designation, anyone whose verdict ' +
      'is stale or was not clear, anyone whose workload just changed and anyone ' +
      'never checked is researched exactly as before. Players who came back ' +
      'clear a day ago, and players already settled by a bye or an OUT, are not ' +
      'paid for twice — their previous verdict is shown with its own date. The ' +
      'fixed half of the prompt is cached, so a second sync in the same few ' +
      'minutes re-reads it at a tenth of the price.'));

    var t = el('button', 'btn pri', 'Test the key');
    t.addEventListener('click', function () {
      if (!Ai.configured()) { modal('No key', 'Paste an API key above first.'); return; }
      t.disabled = true; t.textContent = 'Testing…';
      Ai.test().then(function (msg) {
        t.disabled = false; t.textContent = 'Test the key';
        modal('Key works', msg);
      }).catch(function (e) {
        t.disabled = false; t.textContent = 'Test the key';
        modal('Key test failed', (e && e.message ? e.message : String(e)) +
          '\n\nA 401 means the key is wrong or revoked. A 404 naming the model ' +
          'means the model string needs updating in the field above.');
      });
    });
    c.appendChild(t);

    var p = el('button', 'btn'); p.textContent = 'Show the exact prompt'; p.style.marginTop = '8px';
    p.addEventListener('click', function () {
      var opp = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
      var team = Store.team(S.league.me), players = [];
      var proj = Recommend.projectAll(week, S.league.me, opp);
      proj.forEach(function (x) {
        players.push({ name: x.p.name, pos: x.p.pos, nfl: x.p.nfl, opp: x.opp || '',
                       onBye: x.onBye, proj: x.base, feedStatus: x.h.label });
      });
      modal('Prompt sent to Claude', Ai.buildPrompt({
        week: week, season: S.settings.season,
        today: new Date().toISOString().slice(0, 10), players: players
      }));
    });
    c.appendChild(p);
    return c;
  }

  /* ---------- Data: what Claude would cost ----------
   * Tj, 2026-09-15: "get rid of anywhere it says how much Claude api usage I
   * have left, because I no longer have the API key. Instead, put an
   * estimate of what each request would cost." There is no endpoint a
   * normal key can call to ask how much credit is left either way —
   * Anthropic's Usage and Cost API needs an ADMIN key, organisation-scoped,
   * and does not belong typed into a phone — so a "remaining balance" was
   * always this app's own running guess, not a real one, and now that
   * there is no key to spend it is not even that. What IS answerable
   * without a key: what a call would cost, from its real inputs, computed
   * live below. */
  function usageCard() {
    Usage.load();
    /* the same depth()-resolved model claudeAdviceEstimate/claudeWireEstimate
       use, so the "prices used for this estimate" panel below matches the
       numbers shown above it instead of always assuming the main model. */
    var mdl = (window.Ai && Ai.depth() === 'cheap') ? Ai.cheapModel() : (window.Ai ? Ai.model() : '');
    var t = Usage.totals(mdl);
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Claude costs'));

    var adviceEst = (window.Recommend && window.Recommend.claudeAdviceEstimate)
      ? Recommend.claudeAdviceEstimate(week, S.league.me) : null;
    var wireEst = claudeWireEstimate();
    if (adviceEst || wireEst) {
      c.appendChild(el('p', 'muted', 'Estimated cost of the next call, at today\'s roster and prices:'));
      if (adviceEst) {
        var e1 = el('div', 'kv');
        e1.appendChild(el('span', null, 'Sync advice (Lineups → Advice)'));
        e1.appendChild(el('b', null, adviceEst));
        c.appendChild(e1);
      }
      if (wireEst) {
        var e2 = el('div', 'kv');
        e2.appendChild(el('span', null, 'Ask Claude about the wire'));
        e2.appendChild(el('b', null, wireEst));
        c.appendChild(e2);
      }
      c.appendChild(el('p', 'hint',
        'Both are also shown right next to their own buttons. Based on how ' +
        'many players actually need research right now (an injury designation, ' +
        'a stale or unclear verdict) and the real prompt this exact press would ' +
        'send — searches are almost all of the bill, so this is close even ' +
        'though the exact output length can vary a little.'));
    } else {
      c.appendChild(el('p', 'muted',
        'Could not estimate right now — this needs a roster and a current week loaded.'));
    }

    if (t.calls) {
      var big = el('div', 'bigfig', Usage.money(t.spend));
      big.style.marginTop = '12px';
      c.appendChild(big);
      c.appendChild(el('p', 'muted',
        t.calls + ' call' + (t.calls === 1 ? '' : 's') + ' actually made · ' + t.syncs +
        ' advice sync' + (t.syncs === 1 ? '' : 's') + ' · ' + t.searches +
        ' web searches · since ' + new Date(t.since).toISOString().slice(0, 10)));

      if (t.last) {
        c.appendChild(el('p', 'muted', 'Last call: ' + t.last.what + ' · ' +
          Usage.money(t.last.cost) + ' · ' + t.last.tokensIn + ' in, ' +
          t.last.tokensOut + ' out, ' + t.last.searches + ' searches'));
      }

      var h = el('details');
      h.appendChild(el('summary', null, 'every call ▾'));
      Usage.history(25).forEach(function (x) {
        var r = el('div', 'kv');
        r.appendChild(el('span', null,
          new Date(x.at).toISOString().slice(5, 16).replace('T', ' ') + '  ' + x.what));
        r.appendChild(el('b', null, Usage.money(x.cost)));
        h.appendChild(r);
      });
      c.appendChild(h);
    }

    var rd = el('details');
    rd.appendChild(el('summary', null, 'prices used for this estimate ▾'));
    var R = t.rates;
    [['rate_inPerM', 'Input, per million tokens', R.inPerM],
     ['rate_outPerM', 'Output, per million tokens', R.outPerM],
     ['rate_cacheReadPerM', 'Cached input read, per million', R.cacheReadPerM],
     ['rate_cacheWritePerM', 'Cache write, per million', R.cacheWritePerM],
     ['rate_searchPer1000', 'Web search, per 1000', R.searchPer1000]].forEach(function (f) {
      var l = el('label', 'f', f[1]);
      var i2 = el('input'); i2.type = 'number'; i2.step = '0.01'; i2.min = '0';
      i2.value = String(f[2]);
      i2.addEventListener('change', function () {
        S.settings[f[0]] = Number(this.value) || 0; Store.save(); render();
      });
      rd.appendChild(l); rd.appendChild(i2);
    });
    rd.appendChild(el('p', 'hint',
      'Shown for ' + (mdl || 'the selected model') + ', the model the next call would ' +
      'actually use' + (t.usingDefaults ? ' — its published prices' : ' (you have changed these)') +
      '. Switching models above updates these automatically; they stay editable ' +
      'because prices change too, and a wrong number baked into the app would be ' +
      'worse than one you can correct.'));
    c.appendChild(rd);

    if (t.calls) {
      var rs = el('button', 'btn sm dan'); rs.textContent = 'Clear the call history';
      rs.style.marginTop = '8px';
      rs.addEventListener('click', function () {
        confirmModal('Clear the recorded call history?',
          'Removes the "every call" log and the spend total above. Does not touch ' +
          'your API key and does not touch your actual Anthropic balance — it never ' +
          'could read that.', 'Clear it', function () {
          Usage.reset(); render(); toast('Call history cleared');
        });
      });
      c.appendChild(rs);
    }

    c.appendChild(el('p', 'hint',
      'The estimates above are computed from today\'s real roster and prompt, ' +
      'not a guess. The call history below them (if any) is THIS APP ONLY — ' +
      'there is no way for an ordinary API key to ask Anthropic what its ' +
      'balance is; that needs an admin key, which can read your whole ' +
      'organisation and manage keys, so the app deliberately does not want ' +
      'one. The authoritative number is always the Anthropic Console.'));
    return c;
  }

  /* ---------- Data: lineup alerts (v2.7) ----------
   * The only feature in the app that does anything while the app is closed. */
  function alertCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Lineup alerts'));
    var have = !!(window.Native && Native.alertsSet);
    if (!have) {
      c.appendChild(el('p', 'muted',
        'This build of the shell has no alarm bridge — reinstall the current APK ' +
        'to get alerts. Everything else works as normal.'));
      return c;
    }
    var st = {};
    try { st = JSON.parse(Native.alertsStatus() || '{}'); } catch (e) { st = {}; }

    c.appendChild(el('p', 'muted',
      'Before kickoff, this checks your starting lineup with the app closed and ' +
      'tells you if a starter is on a bye, has been ruled OUT or doubtful, or if ' +
      'a slot is empty. Sunday at the time you set, and Thursday at 4pm for the ' +
      'night game. It is deliberately narrow: only things that are certain and ' +
      'expensive. Everything that needs judgement stays in Lineups → Advice where ' +
      'the reasoning can be shown.'));

    var row = el('div', 'kv');
    var lab = el('label', 'chk');
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!st.on;
    var hr = el('input'); hr.type = 'number'; hr.min = '0'; hr.max = '23';
    hr.value = String(st.hour === undefined ? 11 : st.hour);
    hr.style.width = '70px';
    var mn = el('input'); mn.type = 'number'; mn.min = '0'; mn.max = '59';
    mn.value = String(st.minute === undefined ? 30 : st.minute);
    mn.style.width = '70px';
    function apply() {
      /* raw bridge calls: if the Java side throws, an unguarded call escapes
         the click handler to window.onerror, which replaces the whole screen
         with a stack trace. alertsStatus above was already guarded; these two
         were not. */
      var ok = false;
      try {
        ok = Native.alertsSet(!!cb.checked, parseInt(hr.value, 10) || 0,
                              parseInt(mn.value, 10) || 0);
      } catch (e) {
        toast('The alarm bridge failed: ' + ((e && e.message) ? e.message : e), 7000);
        return;
      }
      toast(ok ? (cb.checked ? 'Alerts on' : 'Alerts off') : 'Could not set the alarm');
    }
    cb.addEventListener('change', apply);
    hr.addEventListener('change', apply);
    mn.addEventListener('change', apply);
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(' Check my lineup on Sunday at'));
    c.appendChild(lab);
    row.appendChild(hr); row.appendChild(el('span', null, ':')); row.appendChild(mn);
    c.appendChild(row);
    c.appendChild(el('p', 'hint',
      'The alarm uses a half-hour window rather than an exact time, so it needs ' +
      'no special permission from you — set it comfortably before the early ' +
      'kickoff, not at one minute to.'));

    var t = el('button', 'btn pri', 'Run the check now');
    /* alertsTest() is async now (2026-09-15e): the real check is a real
       network fetch on the Java side, and a @JavascriptInterface method
       blocks the calling JS thread until it returns — this button used to
       freeze the whole page for however long that fetch took (up to 13s
       worst case). Native.alertsTest() now returns immediately and wakes
       the page through this one global callback once the real result is
       ready, the same shape as every other async bridge call. */
    t.addEventListener('click', function () {
      t.disabled = true; t.textContent = 'Running the check…';
      window.__alertsTestDone = function (r) {
        window.__alertsTestDone = null;
        t.disabled = false; t.textContent = 'Run the check now';
        modal('Lineup check', r + '\n\nA notification was posted as well. If you ' +
          'did not see one, Android is blocking notifications for this app — ' +
          'turn them on in Settings → Apps → League Tracker.');
        render();
      };
      try { Native.alertsTest(); }
      catch (e) {
        window.__alertsTestDone = null;
        t.disabled = false; t.textContent = 'Run the check now';
        modal('The check could not run', ((e && e.message) ? e.message : String(e)) +
          '\n\nNothing else is affected — every other tab still works.');
      }
    });
    c.appendChild(t);

    if (st.lastRun) {
      c.appendChild(el('p', 'muted', 'Last automatic check: ' +
        new Date(st.lastRun).toLocaleString() + ' — ' + (st.lastResult || 'all clear')));
    }
    return c;
  }

  /* ---------- Data: live + projections ---------- */
  function liveCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Live updating'));
    c.appendChild(el('p', 'muted',
      'While a game is in progress the app re-pulls the box scores on its own, ' +
      'so the Live tab and your matchup total move without you touching Sync. ' +
      'It checks the scoreboard first and only pulls box scores when something ' +
      'is actually being played. Status right now: ' + liveText() + '.'));

    var togg = el('button', 'btn' + (S.settings.liveRefresh ? ' pri' : ''),
      S.settings.liveRefresh ? 'Live updating: ON' : 'Live updating: OFF');
    togg.addEventListener('click', function () {
      S.settings.liveRefresh = !S.settings.liveRefresh; Store.save();
      startLive(); render();
    });
    c.appendChild(togg);

    var lab = el('label', 'f', 'Refresh every: ' + (S.settings.liveEvery || 45) + ' seconds');
    var rng = el('input'); rng.type = 'range'; rng.min = '20'; rng.max = '300'; rng.step = '5';
    rng.value = String(S.settings.liveEvery || 45); rng.style.width = '100%';
    rng.addEventListener('input', function () {
      S.settings.liveEvery = Number(this.value);
      lab.textContent = 'Refresh every: ' + this.value + ' seconds';
    });
    rng.addEventListener('change', function () { Store.save(); startLive(); });
    c.appendChild(lab); c.appendChild(rng);
    c.appendChild(el('p', 'hint',
      'Faster is not better here — a box score does not change more than about ' +
      'once a minute, and each refresh is sixteen requests on a full Sunday.'));

    var pm = Projections.meta();
    c.appendChild(el('h2', null, 'Projection feed'));
    c.appendChild(el('p', 'muted', pm.count
      ? (pm.count + ' players indexed, ' + pm.weekly + ' with a week-' + pm.week +
         ' line, via the ' + pm.route + ' route.')
      : (pm.error ? ('Not working yet: ' + pm.error) : 'Not loaded yet.')));
    var pt = el('button', 'btn', 'Test the projection feed');
    pt.addEventListener('click', function () {
      pt.disabled = true; pt.textContent = 'Testing…';
      Projections.selfTest(S.settings.season, week).then(function (txt) {
        pt.disabled = false; pt.textContent = 'Test the projection feed';
        modal('Projection feed test', txt +
          '\n\nThis pulls ESPN\'s projected stat lines and re-scores them under ' +
          'your league\'s rules. The QB numbers should look high — a completion ' +
          'is a point here, which nobody else\'s scoring does.');
        render();
      }).catch(function (e) {
        pt.disabled = false; pt.textContent = 'Test the projection feed';
        modal('Projection feed failed', String(e && e.message ? e.message : e));
      });
    });
    c.appendChild(pt);
    return c;
  }

  /* ---------- sync ---------- */
  function syncWeek() { doSync({ quiet: false }); }
  function doSync(opts) {
    var quiet = !!(opts && opts.quiet);
    if (busy) return Promise.resolve(null);
    busy = true; renderHeader();
    /* Captured once, here — NOT read live off the module-level `week` for the
     * rest of this function (2026-09-18 review finding). `week` can be
     * mutated mid-flight by applyCurrentWeek() (the NFL-week auto-advance,
     * reachable from syncCurrentWeek() at boot and appResume — neither of
     * which checks `busy` before moving it), and this chain runs several real
     * network round trips. Without a capture, a week-advance landing between
     * two of those awaits would fetch week N's box scores and then file them
     * under Store.setBook(week,...)/S.weekMeta[week] for whatever week the
     * display had already moved on to — silently corrupting the WRONG week's
     * scored stats. Every reference below to "the week this sync is for"
     * uses `syncedWeek` (named to avoid colliding with the unrelated
     * top-level syncWeek() function just above, which only fires this whole
     * thing from the Sync-week button); `render()`/`renderHeader()` still
     * read the live `view`/`week` as always, because what the SCREEN shows
     * should track the current week regardless of which week just finished
     * syncing. */
    var syncedWeek = week;
    if (!quiet) jobStart('sync', 'Week ' + syncedWeek + ': loading schedule…');
    function step(t, p) { if (!quiet) jobStep(t, p); }
    var season = S.settings.season, allLines = [], oppMap = {}, twoPtSeen = 0, stSource = 'groups';
    var meta = { games: 0, allFinal: true, estFG: false, inProgress: 0 };
    /* NFL teams whose game has started but whose box score this sync could
       not get (a failed fetch with nothing cached) — see "A BOX SCORE THAT
       DID NOT ARRIVE" below */
    var missingTeams = {};
    function failedAny() { for (var k in missingTeams) { if (Object.prototype.hasOwnProperty.call(missingTeams, k)) return true; } return false; }
    return Espn.weekGames(season, syncedWeek, syncedWeek > 18 ? 3 : 2).then(function (games) {
      meta.games = games.length;
      games.forEach(function (g) {
        /* who plays whom, recorded every sync: the advice engine's matchup term
           and the lineup auto-fill both need it, and it is free here */
        if (g.teams.length === 2) {
          oppMap[g.teams[0].abbr] = g.teams[1].abbr;
          oppMap[g.teams[1].abbr] = g.teams[0].abbr;
        }
      });

      /* ---- what actually has to be fetched -------------------------------
       * A FINAL game cannot change again. Through v2.2 every poll refetched
       * every game anyway, so a 4pm Sunday refresh at 45s was pulling ten
       * settled box scores over cellular for nothing. Final results are kept
       * for the session and reused; anything still moving is refetched.
       * The cache is per season+week and is memory only — a cold start does
       * one honest full sync, which is right. */
      if (gcache.season !== season || gcache.week !== syncedWeek) {
        gcache = { season: season, week: syncedWeek, byId: {} };
      }
      var want = [], reused = 0;
      games.forEach(function (g) {
        if (g.state === 'pre') { meta.allFinal = false; return; }
        if (g.state !== 'post') { meta.allFinal = false; meta.inProgress++; }
        var c = gcache.byId[g.id];
        if (c && c.final && g.state === 'post') { reused++; return; }
        want.push(g);
      });
      meta.reused = reused; meta.fetched = want.length;
      if (!want.length) step('Week ' + syncedWeek + ': every game already final', 100);

      /* Three at a time: the Java side runs a 3-thread pool that used to sit
         two-thirds idle while the page waited for one box score at a time. */
      return Espn.pool(want, 3, function (g) {
        return Espn.gameStats(g.id).then(function (r) {
          gcache.byId[g.id] = { final: g.state === 'post', r: r };
          /* FREE: gamelog.js's own ensureEvent() would otherwise issue this
             EXACT SAME Espn.gameStats(g.id) call again the first time Tj
             opens a game log for one of this week's teams — same pattern as
             Schedule.ingest above (liveTick), applied to box scores instead
             of kickoff times. gcache above is this file's own in-memory,
             session-only cache for scoring rostered players; this feeds the
             SAME fetch into gamelog.js's separate, persistent, any-player
             cache, so neither has to know about the other's shape. */
          if (window.Gamelog) { try { Gamelog.ingestEvent(syncedWeek, g, r); } catch (e) { } }
          return r;
        });
      }, function (n, total) {
        step('Week ' + syncedWeek + ': box score ' + n + ' of ' + total +
             (reused ? ' · ' + reused + ' final reused' : ''),
             Math.round(n * 100 / Math.max(1, total)));
      }).then(function () {
        var perGame = [], failed = 0;
        games.forEach(function (g) {
          var c = gcache.byId[g.id];
          if (c && c.r) perGame.push({ g: g, r: c.r });
          else if (g.state !== 'pre') {
            failed++;
            (g.teams || []).forEach(function (tm) {
              if (tm && tm.abbr) missingTeams[String(tm.abbr).toUpperCase()] = 1;
            });
          }
        });
        meta.failed = failed;
        return perGame;
      });
    }).then(function (perGame) {
      var byName = {}, i;
      /* Index rostered players by DEF code and by every spelling of the name.
         This used to be an exact normalised match, so a roster that said
         "Kenneth Gainwell" against an ESPN box score that says "Kenny" matched
         NOTHING and he scored 0.0 for the week, silently. */
      Store.allPlayers().forEach(function (x) {
        var pl = x.player;
        if (pl.pos === 'DEF') { byName['DEF:' + pl.nfl] = pl.id; return; }
        var v = Names.variants(pl.name), j;
        for (j = 0; j < v.length; j++) byName[v[j]] = pl.id;
      });
      var stats = Store.getStats(syncedWeek), matched = 0, seenPid = {};
      /* A hand-entered adjustment must survive the wipe below, or every
         re-sync (which a live poll does every 45s) silently erases it. This
         capture used to be missing entirely — `keepAdj[pid]` below referenced
         a variable that was never declared, so it threw a ReferenceError on
         the FIRST matched player of EVERY sync since the v4.2 baseline,
         leaving the "0 of N matched" banner stuck no matter what. */
      var keepAdj = {}, keepBonus = {};
      Object.keys(stats).forEach(function (k) {
        if (stats[k] && stats[k].manualAdj) keepAdj[k] = stats[k].manualAdj;
        if (stats[k] && stats[k].bonus) keepBonus[k] = stats[k].bonus;
      });
      /* ---- A BOX SCORE THAT DID NOT ARRIVE (full test 2026-09-24) ---------
       * The wipe below used to clear EVERY line of the week and rebuild from
       * whatever this sync fetched. One failed box score (a flaky connection
       * on a Tuesday re-sync, say) therefore deleted that game's players'
       * already-correct lines — 0.0 for them — and, every game being over,
       * the week was still stamped final, so nothing ever retried it. Now:
       *  - a player whose NFL team's game could not be fetched KEEPS his
       *    stored line (and his league-book row, below);
       *  - the three +5 longest-play bonuses are not recomputed from a week
       *    with a game missing (the missing game may hold the longest play);
       *    everyone keeps the flags the last complete sync gave him;
       *  - the week is final only if it really is complete: every game over
       *    and either nothing missing, or it was already complete before
       *    this sync (the kept lines ARE its final numbers). Otherwise it
       *    stays open, so the live poll's closing sync fetches the missing
       *    game on its next tick, and the header says what is missing. */
      var pidTeam = function (pid) {
        var rec = Store.playerById(pid);
        return rec && rec.player ? String(rec.player.nfl || '').toUpperCase() : '';
      };
      var kept = 0;
      /* wipe this week's lines so a re-sync is idempotent — except those
         whose game could not be refetched this time (above) */
      Object.keys(stats).forEach(function (k) {
        if (failedAny() && missingTeams[pidTeam(k)]) { seenPid[k] = 1; kept++; return; }
        delete stats[k];
      });

      perGame.forEach(function (pg) {
        var r = pg.r, key;
        twoPtSeen += r.twoPtCredited || 0;
        if (r.flags.stFromScoringPlays) stSource = 'scoring plays';
        for (key in r.players) {
          if (!Object.prototype.hasOwnProperty.call(r.players, key)) continue;
          var L = r.players[key].line;
          if (L.kick && L.kick.est) meta.estFG = true;
          allLines.push({ key: key, line: L, abbr: r.players[key].abbr });
          var pid = byName[key];
          if (pid) {
            if (keepAdj[pid]) L.manualAdj = keepAdj[pid];
            stats[pid] = L; seenPid[pid] = 1; matched++;
          }
        }
        var ab;
        for (ab in r.teamAgg) {
          if (!Object.prototype.hasOwnProperty.call(r.teamAgg, ab)) continue;
          var dpid = byName['DEF:' + ab];
          if (dpid) { stats[dpid] = Espn.dstLine(r.teamAgg[ab]); seenPid[dpid] = 1; matched++; }
        }
      });

      /* league-wide longest-play bonuses, only once every game is final.
       *
       * KNOWN IMPRECISION (found in the 2026-09-19 sweep, not fixed — the
       * data to fix it does not exist in what this app fetches). The winning
       * QB is credited as `teamPrimaryQB[pl.abbr]` — the passer with the most
       * COMPLETIONS in that game (espn.js) — not the man who actually threw
       * this specific longest-reception play. In the ordinary case those are
       * the same person and this is exact. They can differ when a team plays
       * two quarterbacks in one game (an in-game injury, a benching) and the
       * one who is NOT "primary" for the game happened to throw the long ball
       * before leaving. ESPN's box score gives per-player game TOTALS, not a
       * play-by-play passer for a specific completion; `scanPlays` above does
       * walk the full drive list, but only to find field goals and safeties
       * by text pattern — extracting "who threw THIS specific reception" from
       * play text reliably enough to trust for a scored point is a real
       * feature, not a one-line fix, and would need its own tests against
       * real play text before it could replace this. Left as the best
       * available proxy; a two-QB game is the one case where the +5 can land
       * on the wrong man. */
      var prevComplete = !!(S.weekMeta[String(syncedWeek)] && S.weekMeta[String(syncedWeek)].synced &&
                            S.weekMeta[String(syncedWeek)].allFinal && !S.weekMeta[String(syncedWeek)].failed);
      var complete = meta.allFinal && (!meta.failed || prevComplete);
      if (meta.failed) {
        /* no bonus pass on a week with a hole in it: everyone keeps the
           flags the last complete sync gave him */
        Object.keys(keepBonus).forEach(function (k) { if (stats[k]) stats[k].bonus = keepBonus[k]; });
      } else if (meta.allFinal && allLines.length) {
        var qbKey = null, bestLong = -1;
        perGame.forEach(function (pg) {
          var k2;
          for (k2 in pg.r.players) {
            if (!Object.prototype.hasOwnProperty.call(pg.r.players, k2)) continue;
            var pl = pg.r.players[k2];
            if (pl.line.rec && pl.line.rec.long > bestLong) {
              bestLong = pl.line.rec.long;
              qbKey = pg.r.teamPrimaryQB[pl.abbr] || null;
            }
          }
        });
        Scoring.applyWeeklyBonuses(allLines, qbKey);
      }

      /* ---- the league book ------------------------------------------------
       * Everything ESPN reported, scored under THIS league's rules, not only
       * the rostered players. The free-agent board and the usage trend read it
       * and never touch the network. Compact by design. */
      var book = {};
      perGame.forEach(function (pg) {
        var k3;
        for (k3 in pg.r.players) {
          if (!Object.prototype.hasOwnProperty.call(pg.r.players, k3)) continue;
          var P3 = pg.r.players[k3], L3 = P3.line, u = L3.use || {};
          book[k3] = { n: P3.name, t: P3.abbr,
                       p: Math.round(Scoring.score(L3).total * 10) / 10,
                       pa: u.patt || 0, cr: u.car || 0, tg: u.tgts || 0 };
        }
        var ab2;
        for (ab2 in pg.r.teamAgg) {
          if (!Object.prototype.hasOwnProperty.call(pg.r.teamAgg, ab2)) continue;
          book['DEF:' + ab2] = { n: ab2 + ' D/ST', t: ab2,
            p: Math.round(Scoring.score(Espn.dstLine(pg.r.teamAgg[ab2])).total * 10) / 10,
            pa: 0, cr: 0, tg: 0 };
        }
      });
      /* A quiet poll of a week still being played rewrites this book every
         45 seconds; the archive it lives in is written lazily for those
         (store.js markArchiveLazy) and the save is not counted as an edit
         (saveLive). A manual sync or the week's closing, final sync is
         written at once, exactly as before. */
      var lazyArch = quiet && !complete;
      /* the missing game's players keep last time's book rows too */
      if (meta.failed) {
        var prevBook = Store.bookWeek(syncedWeek);
        Object.keys(prevBook).forEach(function (k) {
          var row = prevBook[k];
          if (row && !book[k] && missingTeams[String(row.t || '').toUpperCase()]) book[k] = row;
        });
      }
      Store.setBook(syncedWeek, book, lazyArch);

      /* ---- the feed-shape canary -----------------------------------------
       * Two independent alarms, because the expensive failure here is silent.
       * 1. a scoring label ESPN renamed — pick() would answer 0 forever.
       * 2. coverage collapsing: rostered players whose NFL team played this
       *    week but who came back with nothing. A name-matching change looks
       *    exactly like this and costs real points before anyone notices. */
      var shapeMissing = [];
      perGame.forEach(function (pg) {
        (pg.r.shape ? pg.r.shape.missing : []).forEach(function (m) {
          if (shapeMissing.indexOf(m) < 0) shapeMissing.push(m);
        });
      });
      var expected = 0;
      Store.allPlayers().forEach(function (x) {
        var ab3 = String(x.player.nfl || '').toUpperCase();
        /* a team whose box score did not arrive cannot be "matched" this
           time — counting it would raise the name-matching alarm for what
           is only a failed fetch */
        if (ab3 && oppMap[ab3] !== undefined && !missingTeams[ab3]) expected++;
      });
      var feedWarn = '';
      if (shapeMissing.length) {
        feedWarn = 'ESPN is no longer sending ' + shapeMissing.join(', ') +
                   ' — those points are being read as zero.';
      } else if (expected >= 20 && matched < Math.round(expected * 0.75)) {
        feedWarn = 'only ' + matched + ' of ' + expected +
                   ' rostered players whose team played were matched — the feed or the name matching has changed.';
      }

      var unmatched = [];
      Store.allPlayers().forEach(function (x) { if (!seenPid[x.player.id]) unmatched.push(x.player.name); });
      /* MUTATE the existing weekMeta[week] object; never replace it wholesale.
       * (2026-09-19 full-test sweep.) This used to be `S.weekMeta[...] = {
       * ...a brand new object literal... }`, which discarded every field a
       * DIFFERENT module keeps on the same object — schedule.js's own
       * ingest()/earlyAlertUncached() write kickoffs/schedAt/schedSig/
       * shouldStart/shouldStartSig directly onto this exact S.weekMeta[week],
       * and liveTick() calls Schedule.ingest(week, games) immediately before
       * calling doSync on the very same tick. The old code went out of its
       * way to carry `opponents` forward (read off the old object first) but
       * nothing else survived, so every manual "Sync week" tap or pull-to-
       * refresh silently erased the game-time badges next to every player's
       * name and the pre-Sunday bench alert — both the in-app card and
       * Alerts.java's closed-app notification, which reads this identical
       * persisted key with no WebView available — until something unrelated
       * happened to re-ingest a schedule. Mutating in place keeps every field
       * this function does not itself own, automatically, with no name list
       * to keep in sync by hand. */
      var wm = S.weekMeta[String(syncedWeek)];
      if (!wm) wm = S.weekMeta[String(syncedWeek)] = {};
      var prevOpp = wm.opponents;
      wm.synced = true; wm.at = new Date().toISOString(); wm.games = meta.games;
      wm.allFinal = complete; wm.estFG = meta.estFG; wm.matched = matched; wm.kept = kept;
      wm.inProgress = meta.inProgress; wm.twoPt = twoPtSeen; wm.stSource = stSource;
      wm.rostered = Store.allPlayers().length; wm.unmatched = unmatched;
      wm.opponents = (prevOpp && Object.keys(prevOpp).length) ? prevOpp : oppMap;
      wm.expected = expected; wm.feedWarn = feedWarn; wm.shapeMissing = shapeMissing;
      wm.fetched = meta.fetched; wm.reused = meta.reused; wm.failed = meta.failed;
      wm.bookSize = Object.keys(book).length;
      S.settings.lastSync = new Date().toISOString();
      live.at = Date.now(); live.inProgress = meta.inProgress;
      if (lazyArch) Store.saveLive(); else Store.save();
      /* only spend a Downloads write on a settled week — a live poll every 45s
         would otherwise fill the folder with near-identical copies */
      if (!quiet || complete) Store.autoBackup(true);
      autoFillWeek(syncedWeek);
      /* projections and measured spread both just changed */
      if (window.Sim) Sim.invalidate();
      busy = false; if (!quiet) jobEnd();
      render();
      if (!quiet) {
        toast('Week ' + syncedWeek + ': ' + matched + ' players scored' +
              (meta.failed
                ? ' · ' + meta.failed + ' box score' + (meta.failed === 1 ? '' : 's') + ' did not load' +
                  (kept ? ', kept the last good numbers for ' + kept + ' player' + (kept === 1 ? '' : 's') : '') +
                  (complete ? '' : ' — will retry')
                : (complete ? ' (final)' : ' (live)')), meta.failed ? 7000 : undefined);
      }
      return meta;
    }).catch(function (e) {
      busy = false; if (!quiet) jobEnd();
      var raw = (e && e.message) ? e.message : String(e);
      /* "you are offline" and "the feed is broken" are the same exception at
         the socket and completely different sentences to read. */
      var off = !!(window.Native && Native.online && !Native.online());
      live.err = off ? 'no connection — everything already synced still works' : raw;
      render();
      if (!quiet) {
        toast(off ? 'No connection. Scores, your roster and advice ' +
                    'from the last sync all still work.'
                  : 'Sync failed: ' + raw, 8000);
      }
      return null;
    });
  }

  function selfTest() {
    toast('Testing feed against a known 2025 game…', 30000);
    Espn.gameStats('401772636').then(function (r) {
      var names = Object.keys(r.players), lines = [];
      lines.push('players parsed: ' + names.length);
      lines.push('teams: ' + Object.keys(r.teamAgg).join(', '));
      lines.push('scores found: ' + r.flags.scoresFound + ' ' + JSON.stringify(r.teamScore));
      lines.push('FG from play-by-play: ' + r.flags.fgFromPlays + ' (' + r.fgs.length + ' kicks)');
      var k, sample = null;
      for (k in r.players) { if (r.players[k].line.pass.cmp > 5) { sample = k; break; } }
      if (sample) {
        var sc = Scoring.score(r.players[sample].line);
        lines.push('QB ' + r.players[sample].name + ' -> ' + fmt(sc.total) + ' league pts');
        lines.push('  ' + sc.parts.slice(0, 5).map(function (p) { return p.label; }).join(', '));
      }
      var ab; for (ab in r.teamAgg) {
        var d = Scoring.score(Espn.dstLine(r.teamAgg[ab]));
        lines.push('DST ' + ab + ' -> ' + fmt(d.total));
      }
      modal('Feed self-test', lines.join('\n'));
    }).catch(function (e) { modal('Feed self-test failed', (e && e.stack) ? e.stack : String(e)); });
  }

  /* ---------- render ---------- */
  function render() {
    var atEntry = curScroll();
    grabFocus();
    renderHeader();
    var root = $('view'); root.innerHTML = '';
    /* A screen that throws must not leave a stack trace where the app was:
       whatever was already built stays on screen and the failure is named. */
    try {
      if (view === 'live') viewLive(root);
      else if (view === 'lineups') viewLineupsTab(root);
      else if (view === 'rosters') viewRosters(root);
      else if (view === 'wire') viewWire(root);
      else if (view === 'stats') viewStats(root);
      else viewData(root);
    } catch (e) {
      var bad = el('div', 'card warn');
      bad.appendChild(el('h2', null, 'This screen hit an error'));
      bad.appendChild(el('p', null, (e && e.message) ? e.message : String(e)));
      bad.appendChild(el('p', 'muted', 'Every other tab still works, and nothing ' +
        'has been lost — the season is on disk and Data → App → Export backup will ' +
        'still write it out.'));
      root.appendChild(bad);
    }
    paintJob();
    var y;
    if (view !== lastView) y = scrollMem[view] || 0;   /* tab switch: resume */
    else if (keepScroll !== null) y = keepScroll;      /* caller asked for it */
    else y = atEntry;                                  /* same view: stay put */
    lastView = view; keepScroll = null;
    applyScroll(y);
    restoreFocus();
  }
  /* for the few places that genuinely SHOULD go back to the top: a week
     change, or a fresh import. Everything else must not. */
  function renderTop() { keepScroll = 0; render(); }

  /* One <select> over the cached model list plus a Custom escape hatch, bound
     to a settings key. Two of these exist and they must behave identically, so
     they are one function rather than two copies. */
  function modelListNote() {
    var at = S.settings.aiModelListAt;
    var n = (S.settings.aiModelList || []).length;
    if (!n) {
      return 'Showing a small built-in list. Tap refresh with a key set and the ' +
             'app will ask Anthropic what is actually available to your account.';
    }
    return n + ' models, fetched ' + (at ? new Date(at).toLocaleString() : 'earlier') +
           '. The list is cached, so the picker works offline.';
  }
  function modelPicker(labelText, settingKey, fallbackId) {
    var wrap = el('div');
    wrap.appendChild(el('label', 'f', labelText));
    var cur = S.settings[settingKey] ? String(S.settings[settingKey]).trim() : '';
    var list = Ai.cachedModels();
    var sel = el('select');
    sel.setAttribute('data-fk', 'model|' + settingKey);
    var o0 = el('option', null, 'Default (' + fallbackId + ')'); o0.value = '';
    sel.appendChild(o0);
    var known = false, i;
    for (i = 0; i < list.length; i++) {
      var op = el('option', null, list[i].display_name === list[i].id
        ? list[i].id : (list[i].display_name + '  —  ' + list[i].id));
      op.value = list[i].id;
      if (cur && cur === list[i].id) { op.selected = true; known = true; }
      sel.appendChild(op);
    }
    var oc = el('option', null, 'Custom…'); oc.value = '__custom__';
    if (cur && !known) oc.selected = true;
    sel.appendChild(oc);

    var box = el('input'); box.type = 'text';
    box.setAttribute('autocapitalize', 'none'); box.setAttribute('spellcheck', 'false');
    box.setAttribute('data-fk', 'modelCustom|' + settingKey);
    box.placeholder = 'exact model id';
    box.value = (cur && !known) ? cur : '';
    box.style.marginTop = '6px';
    box.style.display = (cur && !known) ? 'block' : 'none';
    box.addEventListener('change', function () {
      S.settings[settingKey] = this.value.trim(); Store.save();
      toast(S.settings[settingKey] ? ('Using ' + S.settings[settingKey]) : 'Back to default');
    });

    sel.addEventListener('change', function () {
      if (this.value === '__custom__') { box.style.display = 'block'; box.focus(); return; }
      box.style.display = 'none';
      S.settings[settingKey] = this.value; Store.save();
      toast(this.value ? ('Using ' + this.value) : ('Using the default, ' + fallbackId));
    });
    wrap.appendChild(sel); wrap.appendChild(box);
    return wrap;
  }


  document.addEventListener('DOMContentLoaded', boot);
})();
