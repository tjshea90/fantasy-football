/* ui.js — all screens. ES2018 only (no ?. no ?? no .at()). */
(function () {
  'use strict';
  var S, seed, view = 'live', week = 1, busy = false;
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
        'If this keeps happening, Data → Export a backup and say what it says here.'));
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

  /* The alert card. Shown at the top of Live, Lineups and Advice — the three
     screens he is actually on when he thinks about his lineup — and only when
     there is something to act on. It leads with the ACTIONABLE case (someone
     benched who ought to be starting) because "you have players on Thursday"
     is a reminder and "two of them are on your bench" is the thing that saves
     a week. */
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
    c.appendChild(el('p', 'hint', opts.blurb));

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
      applyAdjust();
      if (window.Recommend && Recommend.loadCaches) Recommend.loadCaches();
      autoFillWeek(week);
      wire(); render();
      startLive();
      freshenSchedule();
    } catch (e) {
      fatal('Startup failed:\n' + (e && e.stack ? e.stack : e));
    }
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
  function freshenSchedule() {
    if (!window.Schedule) return;
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
  /* The one place a tab change happens, whether it came from a tap or a swipe. */
  function goTab(name, fromBack) {
    if (!name || name === view) return;
    if (!fromBack) navHistory.push(view);
    scrollMem[view] = curScroll();
    view = name;
    var t = document.querySelectorAll('#tabs .tab'), k;
    for (k = 0; k < t.length; k++) {
      var on = t[k].getAttribute('data-v') === name;
      t[k].classList.toggle('on', on);
      t[k].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    render();
  }
  function wire() {
    var tabs = document.querySelectorAll('#tabs .tab'), i;
    for (i = 0; i < tabs.length; i++) {
      tabs[i].setAttribute('role', 'tab');
      tabs[i].setAttribute('aria-selected',
        tabs[i].getAttribute('data-v') === view ? 'true' : 'false');
      tabs[i].addEventListener('click', function () {
        goTab(this.getAttribute('data-v'));
      });
    }
    var nav = $('tabs'); if (nav) nav.setAttribute('role', 'tablist');
    $('wkPrev').addEventListener('click', function () { if (week > 1) { week--; commitWeek(); } });
    /* 17, not 18. The league's season is weeks 1-14 plus playoffs 15-17
       (RULES_2026.md §LEAGUE STRUCTURE); week 18 has no matchups, no lineups
       and nothing to show, and it was reachable purely because the guard was
       written against the NFL calendar rather than this league's. */
    $('wkNext').addEventListener('click', function () { if (week < LAST_WEEK) { week++; commitWeek(); } });
    $('syncBtn').addEventListener('click', syncWeek);
    wireGestures();
  }
  var LAST_WEEK = 17;

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
   *  - `refresh` is deliberately the SAME path as the Sync week button rather
   *    than a second one. "Refresh" meaning something different depending on
   *    which tab you pulled on is how a gesture becomes untrustworthy. It also
   *    freshens the schedule, which is nearly free (Schedule.refresh only goes
   *    to the network if the stored copy is over three hours old).
   *  - `scrollTop` is the page's, because <main> does not scroll — the body
   *    does. Getting this wrong is what makes a pull-to-refresh fire halfway
   *    down an article.
   */
  function wireGestures() {
    if (!window.Gestures) return;
    try {
      Gestures.init({
        tabs: tabList,
        current: function () { return view; },
        go: goTab,
        viewEl: function () { return $('view'); },
        scrollTop: curScroll,
        blocked: function () { return modalOpen() || busy; },
        refreshLabel: function () { return 'Refreshing week ' + week + '…'; },
        refresh: function () {
          if (window.Schedule) { try { Schedule.refresh(week, true); } catch (e) { } }
          /* NOT quiet. A pull is a deliberate act, so it gets the same progress
             bar the Sync week button gets — "box score 3 of 8" is the
             difference between waiting and wondering whether it is stuck. */
          var p = doSync({ quiet: false });
          return (p && p.then) ? p.then(function () { render(); }, function () { render(); })
                               : Promise.resolve();
        }
      });
    } catch (e) { /* a phone with no touch, or a stubbed DOM: buttons still work */ }
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
  function autoFillTeam(w, tid) {
    if (!window.Recommend || !Recommend.autoLineup) return 0;
    var opp = (S.weekMeta[String(w)] && S.weekMeta[String(w)].opponents) || null;
    try {
      return Store.applyAuto(w, tid, Recommend.autoLineup(w, tid, opp));
    } catch (e) { return 0; /* one bad roster must not stop the rest */ }
  }
  function autoFillWeek(w) {
    if (!S.settings.autoFill) return 0;
    var total = 0;
    S.teams.forEach(function (t) { total += autoFillTeam(w, t.id); });
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
  function liveTick() {
    if (busy) { scheduleLive(15000); return; }
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
      if (inProg > 0) {
        return doSync({ quiet: true }).then(function () {
          live.at = Date.now();
          scheduleLive(Math.max(20, Number(S.settings.liveEvery) || 45) * 1000);
        });
      }
      live.at = Date.now();
      /* nothing live: check back rarely, and stop entirely once the week is
         complete and already synced */
      var m = S.weekMeta[String(week)];
      if (!pre && m && m.synced && m.allFinal) { live.next = 0; return; }
      scheduleLive(pre ? 5 * 60000 : 10 * 60000);
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
    if (asleep) return;
    asleep = true;
    stopLive();                 /* the timer, not just its effects */
    live.next = 0;
    /* A stray touch during teardown must not switch a tab or start a fetch. */
    if (window.Gestures) { try { Gestures.enable(false); } catch (e) { } }
  }
  function appResume() {
    if (!asleep) return;
    asleep = false;
    if (window.Gestures) { try { Gestures.enable(true); } catch (e) { } }
    if (!S) return;             /* not booted yet; boot() starts the poll itself */
    /* Coming back after a while is exactly when a flex-scheduling change would
       have landed, and it is cheap: refresh() only fetches if the stored copy
       is over three hours old. */
    freshenSchedule();
    /* A week that is finished stays finished — do not wake a poll for it. */
    var m = S.weekMeta[String(week)];
    if (m && m.synced && m.allFinal) { renderHeader(); return; }
    if (!S.settings.liveRefresh) { renderHeader(); return; }
    /* 1.5s, not 0: the WebView is still restoring and a request fired into
       that costs a frame of jank for no freshness anyone can perceive. */
    scheduleLive(1500);
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
    var names = { live: 'Live', lineups: 'Lineups', rosters: 'Rosters', wire: 'Wire',
                  advice: 'Advice', data: 'Data' };
    $('title').textContent = names[view] || 'Tracker';
    $('wkLabel').textContent = 'Wk ' + week;
    var m = S.weekMeta[String(week)];
    if (!m || !m.synced) $('syncText').textContent = 'not synced · ' + liveText();
    else $('syncText').textContent = (m.allFinal ? 'final' : 'in progress') +
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
    c.appendChild(el('p', 'muted', 'Everything else still ran. Data → Run the feed self-test ' +
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
      c.appendChild(el('p', 'muted', 'Add this week\'s matchup on the Data tab.'));
      var b = el('button', 'btn pri', 'Set up week ' + week + ' matchup');
      b.addEventListener('click', function () { goTab('data'); });
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
  function myMatchupCard(meId, oppId) {
    var A = Store.team(meId), B = Store.team(oppId);
    var ra = Store.teamWeekPoints(week, meId), rb = Store.teamWeekPoints(week, oppId);
    var wrap = el('div');
    var head = el('div', 'card me');
    head.appendChild(el('h2', null, 'Your matchup · week ' + week));
    var diff = ra.total - rb.total;
    var banner = el('div', 'banner' + (diff > 0 ? ' good' : (diff < 0 ? ' bad' : '')));
    banner.textContent = diff === 0 ? 'Level' :
      (diff > 0 ? 'You lead by ' + fmt(diff) : 'You trail by ' + fmt(-diff));
    head.appendChild(banner);
    wrap.appendChild(head);

    var cols = el('div', 'mu2');
    cols.appendChild(liveScoreBox(A, ra, true));
    cols.appendChild(liveScoreBox(B, rb, false));
    wrap.appendChild(cols);
    return wrap;
  }
  /* One team's live score box: name, running total, how many starters are
     still to play, then that team's lineup — open, and every row tappable
     for the live stat breakdown behind its points. Used for both halves of
     the split Live-tab matchup, mine and my opponent's alike. */
  function liveScoreBox(team, res, isMine) {
    var c = el('div', 'card halfbox' + (isMine ? ' me' : ''));
    c.appendChild(el('h2', null, team.name));
    c.appendChild(el('div', 'bigfig', fmt(res.total)));
    var yet = res.detail.filter(function (d) { return d.pid && !d.played && !d.onBye; }).length;
    c.appendChild(el('div', 'sub muted', yet + ' yet to play'));
    c.appendChild(openLineup(team, res));
    return c;
  }
  function openLineup(team, res) {
    var d = lineupDetail(team, res);
    d.open = true;
    return d;
  }
  function lineupDetail(team, res) {
    var d = el('details');
    var s = el('summary', null, team.name + ' lineup ▾');
    d.appendChild(s);
    res.detail.forEach(function (x) {
      var r = el('div', 'row');
      r.appendChild(el('div', 'slot', x.slot));
      var nm = el('div', 'nm');
      if (!x.pid) { nm.appendChild(el('span', 'muted', '— empty —')); }
      else {
        nm.appendChild(document.createTextNode(x.player ? x.player.name : '?'));
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
      }
      r.appendChild(nm);
      var p = el('div', 'pts' + (x.onBye ? ' bye' : (x.played ? '' : ' pend')), x.onBye ? '0.0' : fmt(x.pts));
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
    var save = el('button', 'btn pri', 'Save adjustment');
    save.style.marginTop = '8px';
    save.addEventListener('click', function () {
      line.manualAdj = Number(inp.value) || 0;
      Store.save(); render();
      toast(rec.player.name + ' adjusted to ' + fmt(Scoring.score(line).total));
    });
    form.appendChild(save);
    adjBtn.addEventListener('click', function () {
      adjBtn.hidden = true;
      form.hidden = false;
      try { inp.focus(); } catch (e) { /* older WebView */ }
    });
    wrap.appendChild(adjBtn);
    wrap.appendChild(form);

    /* opportunity over the last three weeks, above the points. Touches are what
       predict next week; points are what happened last week. */
    var trend = window.Value ? Value.usageText(rec.player.name, week + 1) : '';
    modal(rec.player.name + ' · week ' + week,
      fmt(sc.total) + ' points\n\n' +
      (sc.parts.length
        ? sc.parts.map(function (p) { return '  ' + p.label + '   ' + (p.pts > 0 ? '+' : '') + fmt(p.pts); }).join('\n')
        : '  no scoring plays') +
      (trend ? '\n\nOpportunity\n  ' + trend.split('   ·   ').join('\n  ') : ''),
      wrap);
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
     * it calls clearManual FIRST. This is now the same operation across all
     * ten teams, which is what its name has always claimed.
     *
     * It asks first, because discarding hand-picks is exactly the kind of
     * thing that must not happen on a mis-tap — and unlike the old version, it
     * can now say how many picks are at stake. */
    var refill = el('button', 'btn'); refill.textContent = 'Re-default all teams now';
    refill.style.marginTop = '8px';
    refill.addEventListener('click', function () {
      var manual = 0;
      S.teams.forEach(function (t) {
        var M = (S.lineupManual[String(week)] || {})[t.id] || {}, k;
        for (k in M) if (Object.prototype.hasOwnProperty.call(M, k)) manual++;
      });
      function go() {
        S.teams.forEach(function (t) { Store.clearManual(week, t.id); });
        var was = S.settings.autoFill;
        S.settings.autoFill = true;
        var n = autoFillWeek(week);
        S.settings.autoFill = was;
        if (window.Sim) Sim.invalidate();
        render();
        toast(n ? (n + ' slot' + (n === 1 ? '' : 's') + ' updated'
                     + (manual ? ' · ' + manual + ' of your picks replaced' : ''))
                : 'Every team already holds its recommended lineup');
      }
      if (!manual) { go(); return; }
      confirmModal('Re-default all ten teams?',
        'You have hand-picked ' + manual + ' slot' + (manual === 1 ? '' : 's') +
        ' in week ' + week + '. Re-defaulting throws those away and fills every ' +
        'team with the best projected legal lineup instead.\n\n' +
        'Nothing else is touched — rosters, scores and matchups all stay as they ' +
        'are, and you can change any slot straight back afterwards.\n\n' +
        'Any player whose game has already kicked off keeps his slot. Re-' +
        'defaulting cannot move him, and it would corrupt this week\'s scores ' +
        'if it could.',
        'Replace my picks', go, true);
    });
    head.appendChild(refill);
    root.appendChild(head);
    /* my team first — it is the only one he edits weekly */
    var mine = null, rest = [];
    S.teams.forEach(function (t) { if (t.id === S.league.me) mine = t; else rest.push(t); });
    if (mine) root.appendChild(lineupCard(mine));
    rest.forEach(function (t) { root.appendChild(lineupCard(t)); });
  }
  function lineupCard(t) {
    var c = el('div', 'card' + (t.id === S.league.me ? ' me' : ''));
    var h = el('h2', null, t.name + (t.id === S.league.me ? '  ★' : ''));
    c.appendChild(h);
    var keys = Store.slotKeys();
    var L = Store.getLineup(week, t.id);
    var locks = Store.lockedSlots(week, t.id);
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
        if (lp) { var lb = gameBadge(lp.nfl); if (lb) lab.appendChild(lb); }
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
      var was = S.settings.autoFill; S.settings.autoFill = true;
      autoFillWeek(week);
      S.settings.autoFill = was;
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
    addSafe(root, 'The trade evaluator', tradeCard);

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
    if (!team) return;
    addSafe(root, team.name + ' roster', function () { return teamRosterCard(team); });
  }
  function teamRosterCard(t) {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, t.name + ' · ' + t.players.length + ' players'));
    var order = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };
    t.players.slice().sort(function (a, b) {
      if (order[a.pos] !== order[b.pos]) return order[a.pos] - order[b.pos];
      return a.name.localeCompare(b.name);
    }).forEach(function (p) {
      var r = el('div', 'row');
      r.appendChild(el('div', 'slot', p.pos));
      var nm = el('div', 'nm');
      nm.appendChild(document.createTextNode(p.name));
      nm.appendChild(el('small', null, '  ' + p.nfl + (p.bye ? ' · bye ' + p.bye : '') +
        (p.projPG ? ' · proj ' + fmt(p.projPG) + '/wk' : '')));
      /* after the team/bye text, matching every other player row in the app,
         so a roster reads  Name   CHI · bye 7   Thu 8:20p */
      var gb1 = gameBadge(p.nfl); if (gb1) nm.appendChild(gb1);
      r.appendChild(nm);
      var x = el('button', 'btn sm dan', 'Drop');
      x.addEventListener('click', function () {
        confirmModal('Drop ' + p.name + '?',
          'Removes him from ' + t.name + ' in this app. It does not touch your ' +
          'league site — do the drop there as well.', 'Drop him', function () {
          Store.removePlayer(t.id, p.id);
          if (window.Sim) Sim.invalidate();
          render(); toast('Dropped ' + p.name);
        }, true);
      });
      r.appendChild(x);
      c.appendChild(r);
    });
    c.appendChild(addForm(t));
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
        hint.textContent = 'No match. Refresh the player database on the Data tab, ' +
                           'or add him by hand below.';
        results.appendChild(manualRow(t, q.value));
        return;
      }
      hint.textContent = hits.length + ' match' + (hits.length === 1 ? '' : 'es');
      hits.forEach(function (p) {
        var owner = have(p.n);
        var row = el('div', 'res');
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
    addSafe(root, 'The free-agent board', freeAgentCard);
  }
  function freeAgentCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Free agents · week ' + week));
    var opp = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
    var ups = Value.upgrades(week, S.league.me, opp, 80);
    if (ups.length) {
      c.appendChild(el('p', null, ups.length + ' available player' + (ups.length === 1 ? '' : 's') +
        ' project higher than somebody you are starting:'));
      ups.slice(0, 6).forEach(function (u) {
        var r = el('div', 'row');
        r.appendChild(el('div', 'slot', u.fa.pos));
        var nm = el('div', 'nm');
        nm.appendChild(document.createTextNode(u.fa.name));
        nm.appendChild(el('small', null, '  ' + u.fa.nfl + ' · ' + fmt(u.fa.v) + ' proj — ' +
          '+' + fmt(u.gain) + ' over ' + u.over.name + ' in your ' + u.over.slot));
        r.appendChild(nm);
        var b = el('button', 'btn sm', 'Add');
        b.addEventListener('click', function () { addFreeAgent(u.fa); });
        r.appendChild(b);
        c.appendChild(r);
      });
    } else {
      c.appendChild(el('p', 'muted', 'Nobody on the wire beats a player you are starting this week.'));
    }
    /* ---- Claude's read of the wire (v3.4) ------------------------------
     * The button is here rather than on the Data tab because this is where he
     * is looking when he wants it. The app has already decided WHO is free and
     * what they are worth in league points; this call adds only what a stat
     * line cannot see — who just got hurt ahead of somebody, who just took a
     * job — and re-ranks the shortlist for THIS roster. */
    var wcard = el('div');
    var wsync = el('button', 'btn pri', 'Ask Claude about the wire');
    var wnote = el('p', 'hint', '');
    var cached = Value.waiverLoad();

    if (!Ai.configured()) {
      wsync.disabled = true;
      wnote.textContent = 'Needs an Anthropic API key — Data tab, "Claude". ' +
        'Everything above works without one; this only adds the news layer.';
    } else {
      wnote.textContent = 'Reads this week\'s waiver-wire and injury news for the ' +
        'shortlist above, then ranks it for your roster under THIS league\'s ' +
        'scoring. Public waiver lists are half-PPR standard and are wrong about ' +
        'quarterbacks here by roughly a factor of two.';
    }
    wsync.addEventListener('click', function () {
      var opp2 = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
      var ctx;
      try {
        ctx = Value.waiverContext(week, S.league.me, opp2, S.league.season, new Date().toISOString().slice(0, 10));
      } catch (e) {
        wnote.textContent = 'Could not build the roster context: ' + (e && e.message ? e.message : e);
        return;
      }
      wsync.disabled = true; wsync.textContent = 'Reading the wire…';
      jobStart('waivers', 'Claude is reading the waiver wire…');
      Ai.askWaivers(ctx, function (msg, pct) { jobStep(msg, pct); })
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
    wcard.appendChild(wrow); wcard.appendChild(wnote);
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
          return Handoff.importReply(txt, { week: week, pool: wc.pool });
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
      var age = Math.round((Date.now() - (cached.at || 0)) / 3600000);
      var stale = (cached.week !== week);
      c.appendChild(el('div', 'subhd', "Claude's read of the wire"));
      c.appendChild(el('p', stale ? 'warnText' : 'muted',
        (stale ? 'FROM WEEK ' + cached.week + ' — re-sync for this week. ' : '') +
        (cached.needs || '') + (cached.summary ? '  ' + cached.summary : '')));
      /* grouped by position, because that is the question being asked */
      var seen = {}, order = [];
      cached.adds.forEach(function (a) {
        if (!seen[a.pos]) { seen[a.pos] = []; order.push(a.pos); }
        seen[a.pos].push(a);
      });
      order.forEach(function (k) {
        c.appendChild(el('div', 'subhd', k + ' — Claude'));
        seen[k].forEach(function (a) {
          var r = el('div', 'row');
          r.appendChild(el('div', 'slot', '#' + a.rank));
          var nm = el('div', 'nm');
          nm.appendChild(document.createTextNode(a.name));
          var bits = [a.nfl];
          if (typeof a.proj === 'number') bits.push(fmt(a.proj) + ' proj');
          if (a.onBye) bits.push('ON BYE');
          if (a.overStarter) bits.push('beats ' + a.overStarter);
          bits.push(a.confidence + ' confidence');
          nm.appendChild(el('small', null, '  ' + bits.join(' · ') +
            (a.verified ? '' : '  ·  NOT IN THE APP\'S POOL — check he is actually free') +
            (a.why ? '  —  ' + a.why : '')));
          r.appendChild(nm);
          if (a.verified) {
            var ab = el('button', 'btn sm', 'Add');
            ab.addEventListener('click', function () {
              addFreeAgent({ name: a.name, pos: a.pos, nfl: a.nfl, bye: a.bye });
            });
            r.appendChild(ab);
          }
          c.appendChild(r);
        });
      });
      c.appendChild(el('p', 'hint',
        'Read ' + (age < 1 ? 'just now' : age + 'h ago') + ' with ' + (cached.model || 'Claude') +
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
    function faRow(f, showPos) {
      var r2 = el('div', 'row');
      r2.appendChild(el('div', 'slot', showPos ? f.pos : (f.nfl || f.pos)));
      var nm2 = el('div', 'nm');
      nm2.appendChild(document.createTextNode(f.name));
      var vor = (typeof f.vor === 'number' && f.vor > 0.05)
        ? '  ·  +' + fmt(f.vor) + ' over the next ' + f.pos + ' on the wire' : '';
      nm2.appendChild(el('small', null, '  ' + f.nfl + (f.onBye ? ' · ON BYE' : '') +
        ' · ' + fmt(f.v) + ' proj' + vor + '  (' + f.src + ')' +
        (f.usage ? '\n' + f.usage : '')));
      r2.appendChild(nm2);
      var b2 = el('button', 'btn sm', 'Add');
      b2.addEventListener('click', function () { addFreeAgent(f); });
      r2.appendChild(b2);
      return r2;
    }

    if (faPos === 'VALUE') {
      c.appendChild(el('p', 'muted',
        'Ranked by points above the best free agent at the same position. This ' +
        'is the only ranking on this screen that compares a QB with a running ' +
        'back honestly — raw points never can, because a completion pays 1 here.'));
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
        rows.slice(0, perPos).forEach(function (f) { c.appendChild(faRow(f, false)); });
        if (rows.length > perPos && faPos === 'ALL') {
          var more = el('button', 'btn sm', 'All ' + rows.length + ' ' + k + 's');
          more.addEventListener('click', function () { faPos = k; render(); });
          c.appendChild(more);
        }
      });
    }
    c.appendChild(el('p', 'hint',
      'Everyone in the bundled player database who is not on one of the ten ' +
      'rosters, grouped by position and ranked by this league\'s points — ESPN\'s ' +
      'projected stat line for this week re-scored here where there is one, and ' +
      'what he has actually scored in this app where there is not. Each row says ' +
      'which. Adding a player here does not tell your league site anything; do ' +
      'the real add there.'));
    return c;
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

  function table(head, rows) {
    var t = el('table'), thead = el('thead'), tr = el('tr');
    head.forEach(function (h) { tr.appendChild(el('th', null, h)); });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var x = el('tr'); if (r.me) x.className = 'me';
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
  function viewAdvice(root) {
    Recommend.render(root, { week: week, teamId: S.league.me, el: el, table: table,
      fmt: fmt, toast: toast, modal: modal, jobStart: jobStart, jobStep: jobStep,
      jobEnd: jobEnd, jobRunning: jobRunning, rerender: render,
      handoffCard: handoffCard, adviceHandoff: adviceHandoff,
      gameBadge: gameBadge, earlyGameCard: earlyGameCard });
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

  /* ---------- DATA: weekly scores + standings (v5.2, reconciled in) --------
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
   * only its home changed. */
  function weeklyScoresCard() {
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Enter week ' + week + ' scores'));
    c.appendChild(el('p', 'muted',
      'Your score and your opponent\'s track live automatically on the Live ' +
      'tab. For every other team, type their final score from the league ' +
      'site — it drives the record below and who won.'));
    S.teams.forEach(function (t) {
      if (t.id === S.league.me) return;
      var row = el('div', 'row');
      row.appendChild(el('div', 'nm', t.name));
      var manual = Store.getManualScore(week, t.id);
      var inp = el('input'); inp.type = 'number'; inp.step = '0.1'; inp.className = 'scoreInput';
      inp.value = manual !== null ? String(manual) : '';
      inp.placeholder = fmt(Store.teamWeekPoints(week, t.id).total);
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
    c.appendChild(table(['Team', 'W', 'L', 'T', 'Points'], st.byRecord.map(function (r) {
      return { me: r.id === S.league.me, cells: [r.name, r.w, r.l, r.t, fmt(r.pts)] };
    })));
    return c;
  }

  /* ---------- DATA ---------- */
  function viewData(root) {
    var warn = feedWarnBanner(); if (warn) root.appendChild(warn);
    addSafe(root, 'Weekly scores', weeklyScoresCard);
    addSafe(root, 'Standings', standingsCard);
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

    root.appendChild(scoringCard());
    root.appendChild(aiCard());
    root.appendChild(usageCard());
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

    /* player database */
    var cdb = el('div', 'card');
    cdb.appendChild(el('h2', null, 'Player database'));
    var dm = PlayerDB.meta();
    cdb.appendChild(el('p', 'muted', dm.count + ' players · ' +
      (dm.updated ? 'refreshed ' + dm.updated.slice(0, 10) : 'bundled with the app, never refreshed') +
      '. Used by roster search so you never type a position or team by hand.'));
    var rb = el('button', 'btn pri', jobRunning('db') ? 'Refreshing…' : 'Refresh from ESPN (needs internet)');
    rb.disabled = jobRunning('db');
    rb.addEventListener('click', function () {
      rb.disabled = true; rb.textContent = 'Refreshing…';
      jobStart('db', 'Player database: starting…');
      PlayerDB.refresh(function (done, total, ab) {
        jobStep(done >= total ? 'Player database: saving…'
                              : ('Player database: ' + ab + '  ' + done + '/' + total),
                Math.round(done * 100 / total));
      }).then(function (r) {
        jobEnd();
        var msg = r.added || r.updated
          ? (r.total + ' players · ' + r.added + ' new, ' + r.updated + ' changed')
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

    c.appendChild(el('p', 'hint',
      'Not modelled: the three league-wide +5 bonuses for longest completion, ' +
      'reception and rush are awarded once per week across the whole league and ' +
      'cannot be derived from a box score alone. Tap any player on the Live tab ' +
      'to add one by hand as a labelled adjustment.'));
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

  /* ---------- Data: what the key has cost ----------
   * There is no endpoint a normal API key can call to ask how much credit is
   * left — Anthropic's Usage and Cost API needs an ADMIN key, which can read
   * the whole organisation's spend and manage keys, and does not belong typed
   * into a phone. So this counts what the app spent itself, from the usage each
   * response reports about itself, and says plainly that it is doing that. */
  function usageCard() {
    Usage.load();
    var t = Usage.totals();
    var c = el('div', 'card');
    c.appendChild(el('h2', null, 'Claude spend'));

    if (!t.calls) {
      c.appendChild(el('p', 'muted',
        'Nothing spent yet. Every Claude call reports its own token and search ' +
        'counts, so once you run Sync advice this becomes an exact running ' +
        'total of what the tracker has cost.'));
    } else {
      var big = el('div', 'bigfig', Usage.money(t.spend));
      c.appendChild(big);
      c.appendChild(el('p', 'muted',
        t.calls + ' call' + (t.calls === 1 ? '' : 's') + ' · ' + t.syncs + ' advice sync' +
        (t.syncs === 1 ? '' : 's') + ' · ' + t.searches + ' web searches · since ' +
        new Date(t.since).toISOString().slice(0, 10)));

      if (t.budget) {
        var bar = el('div', 'bar'); bar.style.height = '10px'; bar.style.marginTop = '10px';
        var fill = el('i');
        fill.style.width = Math.max(1, t.pct) + '%';
        fill.style.background = t.pct > 90 ? 'var(--bad)' : (t.pct > 70 ? 'var(--accent)' : 'var(--good)');
        bar.appendChild(fill);
        c.appendChild(bar);
        var kv = el('div', 'kv'); kv.style.marginTop = '6px';
        kv.appendChild(el('span', null, Usage.money(t.remaining) + ' left of ' +
          Usage.money(t.budget)));
        kv.appendChild(el('b', null, Math.round(t.pct) + '% used'));
        c.appendChild(kv);
        if (t.syncsLeft !== null) {
          c.appendChild(el('p', 'muted', 'At ' + Usage.money(t.perSync) +
            ' per sync, that is about ' + t.syncsLeft + ' more advice syncs — ' +
            'roughly ' + Math.floor(t.syncsLeft / 1) + ' weeks at one a week.'));
        }
      }

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

    var lab = el('label', 'f', 'Credit you loaded onto the key (US$, 0 to hide the meter)');
    var inp = el('input'); inp.type = 'number'; inp.step = '1'; inp.min = '0';
    inp.value = String(S.settings.aiBudget || 0);
    inp.addEventListener('change', function () {
      S.settings.aiBudget = Number(this.value) || 0; Store.save(); render();
    });
    c.appendChild(lab); c.appendChild(inp);

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
      'Defaults are Claude Sonnet 5\'s published prices' +
      (t.usingDefaults ? '' : ' (you have changed these)') +
      '. They are editable because prices and model names both change, and a ' +
      'wrong number baked into the app would be worse than one you can correct. ' +
      'If you switch models on the card above, update these to match.'));
    c.appendChild(rd);

    var rs = el('button', 'btn sm dan'); rs.textContent = 'Reset the meter';
    rs.style.marginTop = '8px';
    rs.addEventListener('click', function () {
      confirmModal('Zero the spend total?',
        'Resets this app\'s running estimate only. It does not touch your API key and ' +
        'it does not touch your actual Anthropic balance.', 'Zero it', function () {
        Usage.reset(); render(); toast('Meter reset');
      });
    });
    c.appendChild(rs);

    c.appendChild(el('p', 'hint',
      'This counts THIS APP ONLY. There is no way for an ordinary API key to ' +
      'ask Anthropic what its balance is — that needs an admin key, which can ' +
      'read your whole organisation and manage keys, so the app deliberately ' +
      'does not want one. If you spend the key anywhere else, this reads low. ' +
      'The authoritative number is always the Anthropic Console.'));
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
      'expensive. Everything that needs judgement stays in the Advice tab where ' +
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
    t.addEventListener('click', function () {
      var r;
      try { r = Native.alertsTest(); }
      catch (e) {
        modal('The check could not run', ((e && e.message) ? e.message : String(e)) +
          '\n\nNothing else is affected — every other tab still works.');
        return;
      }
      modal('Lineup check', r + '\n\nA notification was posted as well. If you ' +
        'did not see one, Android is blocking notifications for this app — ' +
        'turn them on in Settings → Apps → League Tracker.');
      render();
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
    if (!quiet) jobStart('sync', 'Week ' + week + ': loading schedule…');
    function step(t, p) { if (!quiet) jobStep(t, p); }
    var season = S.settings.season, allLines = [], oppMap = {}, twoPtSeen = 0, stSource = 'groups';
    var meta = { games: 0, allFinal: true, estFG: false, inProgress: 0 };
    return Espn.weekGames(season, week, week > 18 ? 3 : 2).then(function (games) {
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
      if (gcache.season !== season || gcache.week !== week) {
        gcache = { season: season, week: week, byId: {} };
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
      if (!want.length) step('Week ' + week + ': every game already final', 100);

      /* Three at a time: the Java side runs a 3-thread pool that used to sit
         two-thirds idle while the page waited for one box score at a time. */
      return Espn.pool(want, 3, function (g) {
        return Espn.gameStats(g.id).then(function (r) {
          gcache.byId[g.id] = { final: g.state === 'post', r: r };
          return r;
        });
      }, function (n, total) {
        step('Week ' + week + ': box score ' + n + ' of ' + total +
             (reused ? ' · ' + reused + ' final reused' : ''),
             Math.round(n * 100 / Math.max(1, total)));
      }).then(function () {
        var perGame = [], failed = 0;
        games.forEach(function (g) {
          var c = gcache.byId[g.id];
          if (c && c.r) perGame.push({ g: g, r: c.r });
          else if (g.state !== 'pre') failed++;
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
      var stats = Store.getStats(week), matched = 0, seenPid = {};
      /* A hand-entered adjustment must survive the wipe below, or every
         re-sync (which a live poll does every 45s) silently erases it. This
         capture used to be missing entirely — `keepAdj[pid]` below referenced
         a variable that was never declared, so it threw a ReferenceError on
         the FIRST matched player of EVERY sync since the v4.2 baseline,
         leaving the "0 of N matched" banner stuck no matter what. */
      var keepAdj = {};
      Object.keys(stats).forEach(function (k) {
        if (stats[k] && stats[k].manualAdj) keepAdj[k] = stats[k].manualAdj;
      });
      /* wipe this week's lines so a re-sync is idempotent */
      Object.keys(stats).forEach(function (k) { delete stats[k]; });

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

      /* league-wide longest-play bonuses, only once every game is final */
      if (meta.allFinal && allLines.length) {
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
      Store.setBook(week, book);

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
        if (ab3 && oppMap[ab3] !== undefined) expected++;
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
      var prevOpp = S.weekMeta[String(week)] ? S.weekMeta[String(week)].opponents : null;
      S.weekMeta[String(week)] = {
        synced: true, at: new Date().toISOString(), games: meta.games,
        allFinal: meta.allFinal, estFG: meta.estFG, matched: matched,
        inProgress: meta.inProgress, twoPt: twoPtSeen, stSource: stSource,
        rostered: Store.allPlayers().length, unmatched: unmatched,
        opponents: (prevOpp && Object.keys(prevOpp).length) ? prevOpp : oppMap,
        expected: expected, feedWarn: feedWarn, shapeMissing: shapeMissing,
        fetched: meta.fetched, reused: meta.reused, failed: meta.failed,
        bookSize: Object.keys(book).length
      };
      S.settings.lastSync = new Date().toISOString();
      live.at = Date.now(); live.inProgress = meta.inProgress;
      Store.save();
      /* only spend a Downloads write on a settled week — a live poll every 45s
         would otherwise fill the folder with near-identical copies */
      if (!quiet || meta.allFinal) Store.autoBackup(true);
      autoFillWeek(week);
      /* projections and measured spread both just changed */
      if (window.Sim) Sim.invalidate();
      busy = false; if (!quiet) jobEnd();
      render();
      if (!quiet) {
        toast('Week ' + week + ': ' + matched + ' players scored' +
              (meta.allFinal ? ' (final)' : ' (live)'));
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
      else if (view === 'lineups') viewLineups(root);
      else if (view === 'rosters') viewRosters(root);
      else if (view === 'wire') viewWire(root);
      else if (view === 'advice') viewAdvice(root);
      else viewData(root);
    } catch (e) {
      var bad = el('div', 'card warn');
      bad.appendChild(el('h2', null, 'This screen hit an error'));
      bad.appendChild(el('p', null, (e && e.message) ? e.message : String(e)));
      bad.appendChild(el('p', 'muted', 'Every other tab still works, and nothing ' +
        'has been lost — the season is on disk and Data → Export a backup will ' +
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
