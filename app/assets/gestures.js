/* gestures.js — swipe between tabs, pull down to refresh. v4.7. ES2018 only.
 *
 * WHAT TJ ASKED FOR
 * "make it so I can gesture swipe left and right to the different tabs in
 *  addition to the bottom tab buttons. and also a gesture to pull down to
 *  refresh anywhere in the app."
 *
 * WHY THIS IS A SEPARATE MODULE
 * ui.js is already 145 KB and the one file nothing in the suite could execute
 * until test_lifecycle.js. Gesture code is exactly the kind that looks right
 * and is wrong on a real thumb, so it lives behind a small seam it can be
 * driven through: init() takes callbacks, holds no opinion about tabs or
 * syncing, and tools/test_gestures.js feeds it synthetic touches against a DOM
 * stub. Nothing here reads Store, Schedule or the view state directly.
 *
 * THE THREE THINGS THAT MAKE A SWIPE HANDLER GOOD OR UNUSABLE
 *
 * 1. AXIS LOCK, DECIDED ONCE. The first few pixels of a touch decide whether
 *    this is a scroll or a swipe, and the decision must then STICK for the
 *    rest of the gesture. Re-deciding every move event is what produces a
 *    screen that scrolls and slides at the same time and does neither. Below
 *    AXIS_PX nothing is claimed at all, so a tap is never a gesture.
 *
 * 2. GIVE THE PAGE ITS SCROLL BACK. A vertical drag must reach the browser
 *    untouched. preventDefault is called only once this module has claimed the
 *    gesture horizontally — never speculatively — which is why touchmove is
 *    registered non-passive but returns immediately in the common case.
 *
 * 3. KNOW WHAT YOU ARE ON TOP OF. A <select> owns its own drag. A table that
 *    scrolls sideways owns a horizontal drag. A modal owns everything. Each of
 *    those has to be checked before the gesture starts, not after it has
 *    already moved something.
 *
 * PULL TO REFRESH is the same machinery with the axis flipped, plus one extra
 * condition: the page must ALREADY be at the top. Anywhere else a downward
 * drag is a scroll, and stealing it is the single most irritating thing a
 * pull-to-refresh implementation can do.
 */
(function (root) {
  'use strict';

  /* How far before the axis is decided. Below this a touch is still a tap. */
  var AXIS_PX = 10;
  /* How much more horizontal than vertical a drag must be to count as a swipe.
     1.3 rather than 1.0: a thumb arcs, so a genuine horizontal swipe is never
     purely horizontal, and a genuine scroll often has 20-30px of sideways
     drift over its length. */
  var AXIS_RATIO = 1.3;
  /* Fraction of the screen a swipe must cover to change tab, and the speed at
     which a shorter one counts anyway. Both, because a slow deliberate drag
     and a quick flick are the same intention. */
  var SWIPE_FRACTION = 0.22;
  var SWIPE_MIN_PX = 56;
  var FLICK_VELOCITY = 0.45;        /* px per ms */
  /* A flick needs SPEED AND DISTANCE. Velocity alone is not enough: a 25px
     twitch at the start of a scroll is over in a few milliseconds, which is a
     very high px/ms, and the first version of this changed tab on it. The
     floor is what makes "fast" mean a deliberate flick rather than a jerk. */
  var FLICK_MIN_PX = 40;
  /* Pull-to-refresh: where it triggers, and how far it can be dragged. */
  var PULL_TRIGGER = 72;
  var PULL_MAX = 128;
  /* Resistance past the first and last tab, and past PULL_TRIGGER. Rubber
     banding is the only honest way to say "there is nothing more this way". */
  var RUBBER = 0.32;

  var cfg = null;
  var t = null;          /* the live gesture, or null */
  var pullEl = null, pullSpin = null, pullText = null;
  var refreshing = false;
  var enabled = true;

  function noop() { }
  function now() { return Date.now(); }

  /* ---- what is under the finger ------------------------------------------
   * Walks up from the touch target. Returns true if something on the way to
   * the root wants this gesture more than we do. */
  function ownedBySomethingElse(node, horizontal) {
    var n = node, depth = 0;
    while (n && n.nodeType === 1 && depth++ < 40) {
      var tag = (n.tagName || '').toUpperCase();
      /* Controls with their own drag semantics. A range slider is the one that
         actually breaks: swiping it would both move the value and change tab. */
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA' ||
          tag === 'OPTION') return true;
      if (n.getAttribute && n.getAttribute('data-nogesture') !== null &&
          n.getAttribute('data-nogesture') !== undefined) return true;
      if (horizontal && scrollsSideways(n)) return true;
      n = n.parentNode;
    }
    return false;
  }
  /* A container that can actually scroll sideways — a wide table, a code
     block. `scrollWidth > clientWidth` alone is not enough: almost every block
     element reports a 1px difference from sub-pixel layout. */
  function scrollsSideways(n) {
    if (!n.scrollWidth || !n.clientWidth) return false;
    if (n.scrollWidth - n.clientWidth < 8) return false;
    var ov = '';
    try {
      ov = (root.getComputedStyle ? root.getComputedStyle(n).overflowX : '') || '';
    } catch (e) { return false; }
    return ov === 'auto' || ov === 'scroll';
  }

  /* ---- the pull-to-refresh indicator -------------------------------------
   * Built once and reused. It sits above everything and is the only thing this
   * module puts in the document. */
  function ensurePull() {
    if (pullEl || !root.document || !root.document.body) return pullEl;
    var d = root.document;
    pullEl = d.createElement('div');
    pullEl.className = 'pullrefresh';
    pullEl.setAttribute('aria-hidden', 'true');
    pullSpin = d.createElement('i');
    pullText = d.createElement('span');
    pullEl.appendChild(pullSpin);
    pullEl.appendChild(pullText);
    d.body.appendChild(pullEl);
    return pullEl;
  }
  function paintPull(dist, armed) {
    if (!ensurePull()) return;
    var y = Math.min(dist, PULL_MAX);
    pullEl.style.transform = 'translate(-50%,' + Math.round(y) + 'px)';
    pullEl.style.opacity = String(Math.min(1, dist / 40));
    pullEl.className = 'pullrefresh' + (armed ? ' armed' : '');
    pullText.textContent = armed ? 'Release to refresh' : 'Pull to refresh';
  }
  function hidePull() {
    if (!pullEl) return;
    pullEl.className = 'pullrefresh';
    pullEl.style.transform = 'translate(-50%,-64px)';
    pullEl.style.opacity = '0';
  }
  function spinPull(on, label) {
    if (!ensurePull()) return;
    pullEl.className = 'pullrefresh' + (on ? ' spinning' : '');
    if (on) {
      pullEl.style.transform = 'translate(-50%,' + PULL_TRIGGER + 'px)';
      pullEl.style.opacity = '1';
      pullText.textContent = label || 'Refreshing…';
    } else hidePull();
  }

  /* ---- moving the view ---------------------------------------------------
   * The whole <main> slides under the finger. Only a transform — never a
   * layout property — so a 60fps drag costs no reflow on a Moto G. */
  function slide(px, animate) {
    var v = cfg.viewEl();
    if (!v) return;
    v.style.transition = animate ? 'transform .18s ease-out' : '';
    v.style.transform = px ? ('translateX(' + Math.round(px) + 'px)') : '';
  }
  function settle() {
    slide(0, true);
    var v = cfg.viewEl();
    if (!v) return;
    root.setTimeout(function () {
      /* clear the transition so the NEXT drag is not animated */
      if (v.style) { v.style.transition = ''; v.style.transform = ''; }
    }, 200);
  }

  function tabIndex() {
    var list = cfg.tabs(), cur = cfg.current(), i;
    for (i = 0; i < list.length; i++) if (list[i] === cur) return i;
    return 0;
  }
  /* dir -1 = swipe right (previous tab), +1 = swipe left (next tab) */
  function neighbour(dir) {
    var list = cfg.tabs(), i = tabIndex() + dir;
    if (i < 0 || i >= list.length) return null;
    return list[i];
  }

  /* ---- the gesture -------------------------------------------------------- */
  function onStart(e) {
    t = null;
    if (!enabled || refreshing) return;
    if (!e.touches || e.touches.length !== 1) return;   /* pinch/zoom is not ours */
    if (cfg.blocked && cfg.blocked()) return;           /* a modal is open */
    var p = e.touches[0];
    t = {
      x0: p.clientX, y0: p.clientY, x: p.clientX, y: p.clientY,
      t0: now(), axis: '', target: e.target,
      atTop: cfg.scrollTop() <= 0,
      dead: false
    };
  }

  function onMove(e) {
    if (!t || t.dead) return;
    if (!e.touches || e.touches.length !== 1) { t.dead = true; slide(0); hidePull(); return; }
    var p = e.touches[0];
    t.x = p.clientX; t.y = p.clientY;
    var dx = t.x - t.x0, dy = t.y - t.y0;
    var ax = Math.abs(dx), ay = Math.abs(dy);

    if (!t.axis) {
      if (ax < AXIS_PX && ay < AXIS_PX) return;         /* still a tap */
      if (ax > ay * AXIS_RATIO) {
        /* horizontal — but only if nothing under the finger owns it */
        if (ownedBySomethingElse(t.target, true)) { t.dead = true; return; }
        t.axis = 'x';
      } else if (dy > 0 && t.atTop && cfg.scrollTop() <= 0) {
        if (ownedBySomethingElse(t.target, false)) { t.dead = true; return; }
        t.axis = 'pull';
      } else {
        t.dead = true;                                   /* an ordinary scroll */
        return;
      }
    }

    if (t.axis === 'x') {
      /* claimed: stop the page from scrolling underneath */
      if (e.cancelable) e.preventDefault();
      var lim = dx < 0 ? neighbour(1) : neighbour(-1);
      slide(lim ? dx : dx * RUBBER);
    } else if (t.axis === 'pull') {
      if (cfg.scrollTop() > 0) { t.dead = true; hidePull(); slide(0); return; }
      if (e.cancelable) e.preventDefault();
      var d = dy > PULL_TRIGGER ? PULL_TRIGGER + (dy - PULL_TRIGGER) * RUBBER : dy;
      paintPull(d, dy >= PULL_TRIGGER);
    }
  }

  function onEnd() {
    if (!t) return;
    var g = t; t = null;
    if (g.dead || !g.axis) { return; }
    var dx = g.x - g.x0, dy = g.y - g.y0;
    var ms = Math.max(1, now() - g.t0);

    if (g.axis === 'x') {
      var width = (root.innerWidth || 360);
      var need = Math.max(SWIPE_MIN_PX, width * SWIPE_FRACTION);
      var vel = Math.abs(dx) / ms;
      var far = Math.abs(dx) >= need ||
                (vel >= FLICK_VELOCITY && Math.abs(dx) >= FLICK_MIN_PX);
      var to = far ? neighbour(dx < 0 ? 1 : -1) : null;
      if (to) {
        /* Snap back FIRST, then switch. render() rebuilds <main> wholesale, so
           animating the outgoing screen would be animating a node that is
           about to be replaced — it reads as a stutter. The transform is
           cleared in the same frame the new screen is built. */
        slide(0);
        cfg.go(to);
      } else {
        settle();
      }
      return;
    }

    if (g.axis === 'pull') {
      if (dy >= PULL_TRIGGER && !refreshing) {
        refreshing = true;
        spinPull(true, cfg.refreshLabel ? cfg.refreshLabel() : 'Refreshing…');
        var done = function () { refreshing = false; spinPull(false); };
        var pr;
        try { pr = cfg.refresh(); } catch (err) { done(); return; }
        if (pr && pr.then) pr.then(done, done);
        else root.setTimeout(done, 400);
      } else {
        hidePull();
      }
    }
  }

  function onCancel() {
    if (!t) return;
    t = null;
    slide(0); hidePull();
  }

  function init(options) {
    cfg = options || {};
    if (!cfg.tabs || !cfg.current || !cfg.go || !cfg.refresh || !cfg.viewEl) {
      throw new Error('Gestures.init needs tabs, current, go, refresh and viewEl');
    }
    if (!cfg.scrollTop) cfg.scrollTop = function () { return 0; };
    if (!cfg.blocked) cfg.blocked = function () { return false; };
    var d = root.document;
    if (!d || !d.addEventListener) return false;
    /* passive:false on touchmove ONLY — it is the one that ever calls
       preventDefault. touchstart stays passive so the browser can start
       scrolling immediately in the common case where this module wants
       nothing. */
    var opts = false;
    try {
      var probe = Object.defineProperty({}, 'passive', { get: function () { opts = true; return true; } });
      d.addEventListener('__gtest', noop, probe);
      d.removeEventListener('__gtest', noop, probe);
    } catch (e) { opts = false; }
    d.addEventListener('touchstart', onStart, opts ? { passive: true } : false);
    d.addEventListener('touchmove', onMove, opts ? { passive: false } : false);
    d.addEventListener('touchend', onEnd, opts ? { passive: true } : false);
    d.addEventListener('touchcancel', onCancel, opts ? { passive: true } : false);
    return true;
  }

  /* Suspended while the app is asleep, so a stray touch during teardown can
     neither switch a tab nor start a network call. */
  function enable(on) { enabled = !!on; if (!on) { t = null; slide(0); hidePull(); } }
  function busy() { return refreshing; }

  var API = { init: init, enable: enable, busy: busy,
              _onStart: onStart, _onMove: onMove, _onEnd: onEnd, _onCancel: onCancel,
              _state: function () { return t; },
              _consts: { AXIS_PX: AXIS_PX, AXIS_RATIO: AXIS_RATIO,
                         SWIPE_FRACTION: SWIPE_FRACTION, SWIPE_MIN_PX: SWIPE_MIN_PX,
                         FLICK_VELOCITY: FLICK_VELOCITY, FLICK_MIN_PX: FLICK_MIN_PX,
                         PULL_TRIGGER: PULL_TRIGGER } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.Gestures = API;
})(typeof window !== 'undefined' ? window : this);
