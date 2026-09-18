/* ai.js — optional Claude reasoning over the roster. ES2018 only.
 *
 * WHAT THIS IS AND IS NOT
 * The app works completely without this file. Everything in recommend.js is
 * arithmetic on measured and projected stat lines, and it stands on its own.
 * What Claude adds is the part arithmetic cannot do: reading this week's news
 * for each specific player — a practice report, a snap-count restriction, a
 * suspension, a coach saying "we'll ease him back in" — and saying whether the
 * projection should be trusted.
 *
 * It is opt-in. Tj pastes an Anthropic API key on the Data tab; nothing is
 * sent anywhere until he does, and the key never leaves the phone except in
 * the Authorization header of the call it is for.
 *
 * The prompt hands Claude this league's ACTUAL scoring table, generated from
 * Scoring.describe() rather than retyped, because a model reasoning about a
 * standard-scoring league would be wrong about this one in a specific and
 * expensive way: a completion is worth a point here, which is most of a QB's
 * score and none of anyone else's.
 */
(function (root) {
  'use strict';

  var API = 'https://api.anthropic.com/v1/messages';
  var VERSION = '2023-06-01';
  var DEFAULT_MODEL = 'claude-sonnet-5';

  function settings() {
    var S = root.Store && root.Store.get ? root.Store.get() : null;
    return (S && S.settings) ? S.settings : {};
  }
  function key() { var k = settings().aiKey; return k ? String(k).trim() : ''; }
  function model() { var m = settings().aiModel; return m ? String(m).trim() : DEFAULT_MODEL; }
  function configured() { return key().length > 10; }

  /* ---- the model list --------------------------------------------------
   * The model field used to be a free-text box, which is a trap: a typo is
   * indistinguishable from a retired model id, and both come back as the same
   * unhelpful 404 in the middle of a sync. But a hard-coded dropdown is a
   * worse trap — it goes stale the day Anthropic ships a new model and the
   * app has to be rebuilt to reach it.
   *
   * So: ask the API. GET /v1/models is documented, takes the same key and
   * anthropic-version header as everything else, and returns
   * { data: [ { id, display_name, created_at }, ... ], has_more }. The result
   * is cached in settings so the picker is populated offline, and FALLBACK is
   * only what to show before the list has ever been fetched. A Custom entry
   * stays in the UI so a model newer than the cache is still reachable. */
  var MODELS_API = 'https://api.anthropic.com/v1/models?limit=1000';
  var FALLBACK = [
    { id: 'claude-opus-5',    display_name: 'Claude Opus 5 (most capable, dearest)' },
    { id: 'claude-sonnet-5',  display_name: 'Claude Sonnet 5 (default balance)' },
    { id: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5 (cheapest, fastest)' }
  ];
  function cachedModels() {
    var m = settings().aiModelList;
    return (m && m.length) ? m : FALLBACK;
  }
  /* 2026-09-15e sweep: both web_search tool calls below were pinned to
   * web_search_20250305, the basic (non-dynamic-filtering) tool version —
   * stale even when this app shipped it, verified this session against
   * current Anthropic documentation. The newer web_search_20260209 is
   * confirmed supported on Opus 5 and Sonnet 5, but NOT documented as
   * available on Haiku 4.5 — and depth()==='cheap' sends exactly this call
   * to cheapModel(), which defaults to Haiku 4.5 and can be set to it
   * explicitly in settings. Picking the tool version by an ALLOWLIST of
   * models confirmed to support it (rather than excluding only the ones
   * confirmed not to) means an unrecognised model — a custom id Tj typed in,
   * or a future one this file has never heard of — gets the always-safe
   * older version instead of a guess that could 400 the whole call. */
  function searchToolType(mdl) {
    var m = String(mdl || '').toLowerCase();
    return (m.indexOf('opus-5') >= 0 || m.indexOf('sonnet-5') >= 0)
      ? 'web_search_20260209' : 'web_search_20250305';
  }
  /* Resolves to the list AND writes it into settings. Rejects with a readable
     reason; the caller shows it rather than silently falling back. */
  function listModels() {
    if (!configured()) {
      return Promise.reject(new Error('No API key set — paste one above first.'));
    }
    /* raw:true matters: without it Espn.request already parses the body and
       hands back an OBJECT, JSON.parse stringifies it to "[object Object]" and
       throws — so every refresh failed with a misleading "not JSON" and the
       picker could never leave its 3-entry fallback. */
    return root.Espn._httpGetH(MODELS_API, {
      'x-api-key': key(), 'anthropic-version': VERSION
    }, { timeout: 20000, raw: true }).then(function (txt) {
      var j;
      if (txt && typeof txt === 'object') j = txt;
      else {
        try { j = JSON.parse(txt); } catch (e) {
          throw new Error('the model list was not JSON');
        }
      }
      if (j && j.error) throw new Error(j.error.message || 'the API refused the request');
      if (!j || !j.data || !j.data.length) throw new Error('the model list came back empty');
      var out = [], i, d;
      for (i = 0; i < j.data.length; i++) {
        d = j.data[i];
        if (!d || !d.id) continue;
        out.push({ id: d.id, display_name: d.display_name || d.id, created_at: d.created_at || '' });
      }
      /* newest first — that is the order somebody picking a model wants */
      out.sort(function (a, b) {
        if (a.created_at && b.created_at) return a.created_at < b.created_at ? 1 : -1;
        return 0;
      });
      var S = root.Store && root.Store.get ? root.Store.get() : null;
      if (S && S.settings) {
        S.settings.aiModelList = out;
        S.settings.aiModelListAt = Date.now();
        if (root.Store.save) root.Store.save();
      }
      return out;
    });
  }

  function headers() {
    return {
      'x-api-key': key(),
      'anthropic-version': VERSION,
      'content-type': 'application/json'
    };
  }

  /* Pull the model's text out of a Messages response, ignoring the
     web_search_tool_result blocks that come back alongside it. */
  function textOf(j) {
    var out = [], c = (j && j.content) ? j.content : [], i;
    for (i = 0; i < c.length; i++) {
      if (c[i] && c[i].type === 'text' && c[i].text) out.push(c[i].text);
    }
    return out.join('\n');
  }

  /* ---- streaming ------------------------------------------------------
   * WHY THIS CALL STREAMS.
   * v2.0 sent a normal request and got back
   *   IOException: unexpected end of stream on com.android.okhttp.Address@…
   * A non-streaming Messages request with web search on sends NOTHING back for
   * a minute or more while the model searches. Over cellular that silent
   * connection is fair game: the carrier or an intermediary closes it, and
   * Android reports exactly that error. Streaming keeps a trickle of bytes
   * flowing the whole time, so nothing ever looks idle.
   *
   * Java reads the SSE body to completion and hands it over as text; this
   * function reassembles it into the same shape a normal response has, so
   * everything downstream is unchanged. */
  function mergeUsage(into, from) {
    var k;
    for (k in from) {
      if (!Object.prototype.hasOwnProperty.call(from, k)) continue;
      if (from[k] === null || from[k] === undefined) continue;
      into[k] = from[k];       /* delta counts are cumulative, so last wins */
    }
    return into;
  }
  function parseSse(rawText) {
    var lines = String(rawText || '').split(/\r?\n/);
    var text = [], usage = null, err = null, stopped = false, i;
    /* WHY THE STOP REASON IS KEPT (v4.5).
       It used to set `stopped` and throw the reason away. That single discard
       is what made "the model did not return usable JSON" unactionable: by far
       the likeliest cause is stop_reason === 'max_tokens', i.e. the answer was
       cut off mid-object, and at that point NO parser can recover the closing
       braces because they were never sent. The cause was known right here and
       then dropped, so the failure surfaced two functions later as a generic
       parse error with the diagnosis already lost. */
    var stopReason = '';
    for (i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (ln.indexOf('data:') !== 0) continue;
      var payload = ln.slice(5).replace(/^\s+/, '');
      if (!payload || payload === '[DONE]') continue;
      var ev;
      try { ev = JSON.parse(payload); } catch (e) { continue; }
      if (!ev || !ev.type) continue;
      if (ev.type === 'error') {
        err = (ev.error && ev.error.message) ? ev.error.message : 'stream error';
      } else if (ev.type === 'content_block_delta' && ev.delta) {
        /* text_delta is the model writing; input_json_delta is it filling in a
           tool call, which is not part of the answer we want */
        if (ev.delta.type === 'text_delta' && ev.delta.text) text.push(ev.delta.text);
      } else if (ev.type === 'message_delta') {
        /* MERGE, never replace. message_start carries input_tokens;
           message_delta carries the cumulative output_tokens and, on the last
           one, the web-search count. Overwriting would silently drop the input
           side and the cost meter would read about half of what was spent. */
        if (ev.usage) { usage = mergeUsage(usage || {}, ev.usage); }
        if (ev.delta && ev.delta.stop_reason) {
          stopped = true; stopReason = String(ev.delta.stop_reason);
        }
      } else if (ev.type === 'message_start' && ev.message && ev.message.usage) {
        usage = mergeUsage(usage || {}, ev.message.usage);
      }
    }
    if (err) throw new Error(err);
    var joined = text.join('');
    if (!joined) {
      throw new Error(stopped
        ? 'the stream finished without any text (the model may have only searched)'
        : 'the stream ended early — no text was received');
    }
    return { content: [{ type: 'text', text: joined }], usage: usage,
             stop_reason: stopReason };
  }
  /* ---- finding the JSON in a model's answer -----------------------------
   * THE BUG THIS REPLACES (Tj's screenshot, 2026-09-07: "Claude FAILED: the
   * model did not return usable JSON"). The old implementation was:
   *
   *     var a = s.indexOf('{'), b = s.lastIndexOf('}');
   *     while (a >= 0 && b > a) {
   *       try { return JSON.parse(s.slice(a, b + 1)); }
   *       catch (e) { b = s.lastIndexOf('}', b - 1); }
   *     }
   *
   * Three separate defects, any one of which produces that message:
   *
   * 1. `a` IS COMPUTED ONCE AND NEVER MOVES. Only `b` retracts. So the scan is
   *    permanently anchored to the FIRST '{' in the whole response. This call
   *    runs with web search on, and between searches the model narrates — that
   *    narration arrives as text_delta and lands in the same buffer as the
   *    answer. One brace anywhere in it (a quoted snippet, an example) and
   *    every attempt starts at the wrong character. A response containing
   *    perfectly good JSON is rejected.
   *
   * 2. A TRUNCATED ANSWER IS UNRECOVERABLE BY CONSTRUCTION. If the model hit
   *    max_tokens the closing braces were never sent, so retracting `b` can
   *    never find a balanced span — it just walks every '}' in the text and
   *    fails. And truncation is the likeliest cause of all: max_tokens was
   *    400 + 260/player, and the search narration is spent from the same
   *    budget before the JSON even starts.
   *
   * 3. IT IS QUADRATIC. Every retraction re-parses a near-full-length string.
   *    On a 40 KB answer with a few hundred '}' that is hundreds of parses of
   *    tens of kilobytes on the renderer's JS thread, straight after a
   *    two-minute wait.
   *
   * What replaces it: ONE left-to-right pass that is string- and escape-aware
   * (so a brace inside a "reason" cannot fool it), collecting every balanced
   * top-level value; then, only if none of them is the answer, a repair of the
   * unterminated tail. The repair matters more than it looks — the searches in
   * a truncated response have already been PAID FOR, and recovering fourteen
   * players out of seventeen is worth far more than reporting total failure. */

  /* One pass. Returns every balanced top-level {...} / [...] span, and — if
     the text ends inside one — where it started, what brackets are still open,
     and whether it ended inside a string. */
  function scanJson(s) {
    var out = [], stack = [], start = -1, inStr = false, esc = false;
    var i, n = s.length, ch;
    for (i = 0; i < n; i++) {
      ch = s.charAt(i);
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{' || ch === '[') {
        if (stack.length === 0) start = i;
        stack.push(ch === '{' ? '}' : ']');
      } else if (ch === '}' || ch === ']') {
        if (!stack.length) continue;              /* stray closer in prose */
        stack.pop();
        if (!stack.length && start >= 0) { out.push([start, i + 1]); start = -1; }
      }
    }
    return { spans: out, openAt: stack.length ? start : -1,
             stack: stack, inStr: inStr };
  }

  /* Does this parsed value look like the answer we asked for, rather than some
     other object the model happened to write? `want` is the key that must be
     present — 'players' for the advice call, 'adds' for the waiver call. */
  function shapeOk(v, want) {
    if (!v || typeof v !== 'object') return false;
    if (!want) return true;
    return Object.prototype.hasOwnProperty.call(v, want);
  }

  /* Close an answer that was cut off mid-flight. Cuts the incomplete trailing
     element, re-derives which brackets are still open from what is LEFT (so
     the closers can never disagree with the body), and retries. Bounded. */
  function repairTail(body) {
    var guard = 0;
    while (body.length > 2 && guard++ < 200) {
      var st = scanJson(body), cand = body, k;
      if (st.inStr) cand += '"';       /* a reason cut mid-sentence still reads */
      cand = cand.replace(/[,\s]+$/, '')
                 .replace(/,?\s*"[^"\\]*"\s*:\s*$/, '')   /* a key with no value */
                 .replace(/[,\s]+$/, '');
      for (k = st.stack.length - 1; k >= 0; k--) cand += st.stack[k];
      try { return JSON.parse(cand); } catch (e) { /* cut further back */ }
      var cut = body.lastIndexOf(',');
      if (cut <= 0) cut = Math.max(body.lastIndexOf('['), body.lastIndexOf('{'));
      if (cut <= 0) break;
      body = body.slice(0, cut);
    }
    return null;
  }

  /* opts.want  — the key the answer must carry, so a stray object in the
                  narration is never mistaken for the answer.
     opts.stop  — the stream's stop_reason, used only to explain a failure.
     Returns the parsed object. On a salvaged answer it carries a
     non-enumerable _truncated flag so the caller can say so on screen without
     the flag riding along into anything that gets saved or re-serialised. */
  function jsonOf(txt, opts) {
    var s = String(txt || ''), want = (opts && opts.want) ? opts.want : null;
    var stop = (opts && opts.stop) ? String(opts.stop) : '';
    var sc = scanJson(s), i, v, loose = null;
    /* widest first: the answer object encloses anything the model wrote inside
       it, and a stray object in the narration is necessarily smaller */
    var spans = sc.spans.slice().sort(function (a, b) {
      return (b[1] - b[0]) - (a[1] - a[0]);
    });
    for (i = 0; i < spans.length; i++) {
      try { v = JSON.parse(s.slice(spans[i][0], spans[i][1])); } catch (e) { continue; }
      if (shapeOk(v, want)) return v;
      if (!loose && v && typeof v === 'object') loose = v;
    }
    /* nothing complete matched — try to rescue an answer that was cut off */
    if (sc.openAt >= 0) {
      v = repairTail(s.slice(sc.openAt));
      if (shapeOk(v, want)) {
        try {
          Object.defineProperty(v, '_truncated', { value: true, enumerable: false });
        } catch (e) { /* an old WebView without defineProperty on plain objects */ }
        return v;
      }
    }
    /* an object was found but it is not the answer — say which, it is a much
       better clue than "no JSON" when the contract has drifted */
    if (loose && want) {
      throw new Error('Claude returned JSON but without a "' + want + '" list — '
        + 'it answered with { ' + Object.keys(loose).slice(0, 4).join(', ') + ' }');
    }
    if (stop === 'max_tokens') {
      throw new Error('Claude ran out of output room mid-answer (stop_reason '
        + 'max_tokens) and not enough arrived to rescue. Research fewer players '
        + '(Data → depth: Smart) or raise the limit.');
    }
    if (stop === 'refusal') throw new Error('Claude declined to answer this one.');
    if (!s.replace(/\s/g, '')) throw new Error('Claude sent no text at all.');
    throw new Error('Claude did not return usable JSON'
      + (stop ? ' (stopped: ' + stop + ')' : '')
      + '. It answered with ' + s.replace(/\s+/g, ' ').trim().slice(0, 120) + '…');
  }

  function rulesText() {
    var d = root.Scoring.describe(), out = [], i, k;
    for (i = 0; i < d.length; i++) {
      out.push(d[i].title);
      for (k = 0; k < d[i].rows.length; k++) {
        out.push('  ' + d[i].rows[k][0] + ': ' + d[i].rows[k][1]);
      }
    }
    return out.join('\n');
  }

  /* One call for the whole roster. Per-player calls would be 17x the cost and
     17x the latency for no more insight. */
  /* ---- the prompt, in two halves -----------------------------------------
   * v2.4 splits it deliberately. Everything that NEVER changes — this league's
   * scoring table, the slots, the task, the JSON contract — is one block with
   * a cache breakpoint on it, so a second sync inside the cache window re-reads
   * it at a tenth of the price instead of paying full freight to say the same
   * thing again. Everything that changes every time — the week, the date, the
   * roster — is a separate block after it. Anything volatile in the first block
   * would invalidate the cache on every call and the split would be pointless.
   *
   * 2026-09-15e sweep — measured, not just assumed: this block is ~900 tokens
   * (~3.6K chars / 4). Anthropic will not write a cache breakpoint at all
   * below a per-model floor (Sonnet 5: 1024 tokens; Opus 5: 512; Haiku 4.5:
   * 4096 — verified this session), so at the default (non-'cheap') depth,
   * which sends this to Sonnet 5, this block sits BELOW that floor and the
   * breakpoint above silently never engages — every call pays full price for
   * these tokens, the exact thing this comment claims does not happen.
   * askWaivers()'s own static block (waiverPrefix(), ~1.8K tokens) clears
   * Sonnet's floor fine; this one alone falls short by roughly 130 tokens.
   * Deliberately NOT padded to clear it: the only honest way to add ~130
   * tokens here is more real task guidance, which changes what Claude is
   * actually told on every future sync — a live prompt-behavior change this
   * sweep has no way to verify against the real API (no key configured in
   * this environment) and is exactly the kind of change this sweep's own
   * "no major changes unless approved" boundary is for. It is also a small
   * saving even fixed: Tj syncs advice a few times a week at most, and the
   * cache TTL here is the 5-minute default, so back-to-back calls close
   * enough to ever hit a warm cache are the exception, not the rule. Left as
   * a known, measured, low-priority gap rather than a silent one. */
  function staticPrefix() {
    var lines = [];
    lines.push('You are helping set a fantasy football lineup. A roster follows in the');
    lines.push('next block; everything here is fixed and true every week.');
    lines.push('');
    lines.push('THIS LEAGUE DOES NOT USE STANDARD SCORING. Its exact table:');
    lines.push(rulesText());
    lines.push('');
    lines.push('The single most important difference: a completed pass is worth 1 point.');
    lines.push('A starting QB throwing 25 completions banks 25 points before yards or');
    lines.push('touchdowns, so volume passers are far more valuable here than in a');
    lines.push('normal league, and a QB rushing score matters comparatively less.');
    lines.push('Passing yards are 1 per 20 (not 1 per 25), receptions are full PPR,');
    lines.push('missed field goals are PENALISED on a distance ladder, and forced');
    lines.push('fumbles score nothing — only recoveries.');
    lines.push('');
    lines.push('Starting slots: QB, RB, RB, WR, WR, WR, TE, FLEX (RB/WR/TE only), K, DEF/ST.');
    lines.push('A player on a bye scores exactly 0 and is never substituted automatically.');
    lines.push('');
    lines.push('TASK. Search the web for current news on each player in the roster block —');
    lines.push('this week\'s practice participation, injury designations, suspensions, snap');
    lines.push('or touch restrictions, depth-chart changes, weather, and anything else that');
    lines.push('would change whether he plays a normal workload. Prefer sources from the');
    lines.push('last 7 days. Then judge the matchup he is actually facing.');
    lines.push('');
    lines.push('Answer with JSON ONLY, no prose outside it, in exactly this shape:');
    lines.push('{"players":[{"name":"<exactly as given in the roster block>",');
    lines.push('  "status":"clear|questionable|limited|out",');
    lines.push('  "willPlay":true,');
    lines.push('  "adjust":1.0,');
    lines.push('  "confidence":"high|medium|low",');
    lines.push('  "reason":"<what you found, dated, and what it means for his points UNDER');
    lines.push('    THIS SCORING. Name the source outlet and the date. Two or three');
    lines.push('    sentences if there is news; ONE short sentence if there is not.>"}],');
    lines.push(' "summary":"<2 sentences on the lineup as a whole>"}');
    lines.push('');
    lines.push('RULES FOR THE FIELDS:');
    lines.push('- "adjust" multiplies the app projection. Stay within 0.6 to 1.4 unless');
    lines.push('  something specific and cited justifies more. 1.0 means "the projection');
    lines.push('  is right"; use it freely rather than inventing small edges.');
    lines.push('- "status":"out" for ruled out, suspended, IR, or on bye. Set willPlay');
    lines.push('  false and adjust 0. The app will refuse to start him.');
    lines.push('- "status":"limited" for anyone expected to play with a real restriction');
    lines.push('  (snap count, pitch count, returning from injury). Say the restriction.');
    lines.push('- If you found nothing current on a player, say so plainly in "reason",');
    lines.push('  set confidence "low" and adjust 1.0. Do not invent news.');
    lines.push('- Include every player from the roster block exactly once, and nobody else.');
    return lines.join('\n');
  }

  function rosterBlock(ctx) {
    var lines = [], i;
    lines.push('NFL week ' + ctx.week + ' of the ' + ctx.season + ' season. Today is ' +
               ctx.today + '.');
    lines.push('');
    lines.push('ROSTER TO RESEARCH. "proj" is this app\'s own projection already converted');
    lines.push('to the scoring above, so it is in the right units — treat it as the');
    lines.push('baseline you are adjusting, not as a number to replace.');
    for (i = 0; i < ctx.players.length; i++) {
      var p = ctx.players[i];
      lines.push('- ' + p.name + ' | ' + p.pos + ' | ' + p.nfl +
                 (p.opp ? ' vs ' + p.opp : ' | opponent unknown') +
                 (p.onBye ? ' | ON BYE week ' + ctx.week : '') +
                 ' | proj ' + p.proj.toFixed(1) +
                 (p.feedStatus ? ' | ESPN injury feed: ' + p.feedStatus : '') +
                 (p.why ? ' | why now: ' + p.why : ''));
    }
    /* Players the app has already settled are named but explicitly walled off,
       because a search spent on a man who is on a bye is a search wasted and
       the model would otherwise wonder where he went. */
    if (ctx.settled && ctx.settled.length) {
      lines.push('');
      lines.push('ALREADY SETTLED — do NOT research these and do NOT include them in the');
      lines.push('JSON. They are handled deterministically by the app:');
      for (i = 0; i < ctx.settled.length; i++) {
        lines.push('- ' + ctx.settled[i].name + ' (' + ctx.settled[i].why + ')');
      }
    }
    if (ctx.carried && ctx.carried.length) {
      lines.push('');
      lines.push('ALREADY CHECKED RECENTLY — also not yours to research this time:');
      lines.push('  ' + ctx.carried.join(', '));
    }
    lines.push('');
    lines.push('Research every player in the ROSTER TO RESEARCH list, and only those.');
    return lines.join('\n');
  }

  /* kept for the tests and the on-screen "show me the prompt" view */
  function buildPrompt(ctx) { return staticPrefix() + '\n\n' + rosterBlock(ctx); }

  /* The cheap model is a real Anthropic model id, not a nickname: the setting
     stores whatever Tj typed, and 'cheap' only overrides it when he asked for
     the cheap depth. */
  var CHEAP_MODEL = 'claude-haiku-4-5';
  /* the routine pass is now pickable too — same reasoning as the main model,
     and it is the setting that actually controls what a sync costs */
  function cheapModel() {
    var m = settings().aiCheapModel;
    return m ? String(m).trim() : CHEAP_MODEL;
  }
  function depth() {
    var d = settings().aiDepth;
    return (d === 'full' || d === 'cheap') ? d : 'smart';
  }

  /* SEARCHES ARE THE BILL, not the tokens. One web search costs about what
     ten thousand input tokens cost, so the number of searches is sized to the
     number of players actually being researched rather than fixed at 8.
     Two per player is what a designation check needs; the ceiling stays 8.
     Pulled out to its own function (v6.2) so the on-screen cost estimate
     (usageCard, the Advice/Wire tab buttons) computes the SAME number the
     real call actually sends — two implementations of this would drift, and
     the whole point of an estimate is that it not lie. */
  function adviceSearchBudget(n) {
    var budget = Math.max(2, Math.min(8, Math.ceil(n * 1.2)));
    if (depth() === 'full') budget = 8;
    return budget;
  }
  function ask(ctx, onStep) {
    if (!configured()) return Promise.reject(new Error('no API key set'));
    var mdl = depth() === 'cheap' ? cheapModel() : model();
    var n = ctx.players.length;
    var budget = adviceSearchBudget(n);
    var body = {
      model: mdl,
      /* max_tokens IS A CAP, NOT AN ALLOCATION — an unused ceiling costs
         nothing, and output is billed on what is actually generated. The old
         400 + 260/player gave 4,820 for a 17-man roster, which sounds ample
         until you remember that with web search on the model NARRATES between
         searches and that narration is spent from this same budget before the
         JSON even starts. Running out mid-object is the likeliest single cause
         of the "did not return usable JSON" failure Tj hit, and it was being
         economised on for no saving whatsoever. */
      max_tokens: Math.max(3000, Math.min(16000, 1500 + n * 320)),
      messages: [{ role: 'user', content: [
        /* the cache breakpoint: everything before it — tools, and this whole
           block — is re-read at a tenth of the price on the next call inside
           the window. It must contain nothing that changes between calls. */
        { type: 'text', text: staticPrefix(), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: rosterBlock(ctx) }
      ] }],
      tools: [{ type: searchToolType(mdl), name: 'web_search', max_uses: budget }],
      /* see parseSse(): a silent minute-long connection gets closed on mobile */
      stream: true
    };
    if (onStep) onStep('Claude is reading this week\'s news…', 60);
    /* A search-backed call runs for a minute or two. That is fine now that the
       bridge is async — the page keeps painting while it waits — but the
       transport still needs a budget bigger than its 60s default. */
    return root.Espn._httpPost(API, headers(), JSON.stringify(body),
                               { timeout: 300000, raw: true }).then(function (rawText) {
      /* an error before the stream opens comes back as an ordinary JSON body */
      if (rawText.charAt(0) === '{') {
        var errJ;
        try { errJ = JSON.parse(rawText); } catch (e) { errJ = null; }
        if (errJ && errJ.error) throw new Error(errJ.error.message || JSON.stringify(errJ.error));
      }
      var j = parseSse(rawText);
      var parsed = jsonOf(textOf(j), { want: 'players', stop: j.stop_reason });
      var norm = normalizeAdvice(parsed, ctx, mdl);
      var byName = norm.byName;
      var spent = null;
      if (root.Usage) spent = root.Usage.record('advice sync', mdl, j.usage);
      return {
        at: Date.now(), model: mdl, byName: byName, searchBudget: budget,
        summary: norm.summary,
        count: norm.count,
        /* A rescued answer is USED but never presented as complete. The
           searches were already paid for, so throwing away the fourteen
           players that did arrive because three did not is the worst of both
           outcomes — but so is letting a partial answer look whole. */
        truncated: norm.truncated,
        asked: n,
        usage: j.usage || null,
        spent: spent
      };
    });
  }

  /* ---- turning a parsed answer into the app's shape ----------------------
   * SHARED ON PURPOSE. The API path above and the offline Claude-app handoff
   * (handoff.js) both end up holding a parsed reply object that has to become
   * the same in-app records. Two copies of this loop would drift the moment
   * one of them gained a field — and the failure would be silent, because each
   * path is exercised separately. One implementation, called twice.
   * `mdl` is a provenance label, not a request: for the handoff it is
   * "Claude app (handoff)" so the UI can say where a verdict came from. */
  function normalizeAdvice(parsed, ctx, mdl) {
    var byName = {}, i, arr = (parsed && parsed.players) || [];
    var kept = 0;
    for (i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (!p || !p.name) continue;
      byName[root.Names.canon(p.name)] = {
        status: String(p.status || '').toLowerCase(),
        willPlay: p.willPlay !== false,
        adjust: (typeof p.adjust === 'number' && isFinite(p.adjust))
                ? Math.max(0, Math.min(1.6, p.adjust)) : 1,
        confidence: String(p.confidence || 'low').toLowerCase(),
        reason: String(p.reason || ''),
        /* stamped so a later sync can carry this verdict forward instead of
           paying for the same search again — and so the UI can say how old
           the reasoning it is showing actually is */
        at: Date.now(), week: ctx.week, model: mdl
      };
      kept++;
    }
    return {
      byName: byName, count: kept,
      summary: String((parsed && parsed.summary) || ''),
      truncated: !!(parsed && parsed._truncated)
    };
  }

  /* ==== THE WAIVER WIRE (v3.4) ==========================================
   * The division of labour here is the whole design, and getting it backwards
   * would be both expensive and wrong.
   *
   * What the APP knows and no website does: who is actually unrostered in THIS
   * ten-team league, and what each of them is worth IN THIS SCORING. Every
   * "top waiver adds" list on the internet is computed in half-PPR standard,
   * where a completion pays nothing and here it pays a point — those lists are
   * wrong about quarterbacks by roughly a factor of two, and they have no idea
   * which of the 32 teams' backups are already on somebody's bench in a league
   * they have never heard of.
   *
   * What CLAUDE knows and the app cannot: that the starter ahead of a backup
   * got hurt on Sunday, that a rookie just took over the third-down role, that
   * a coach named a new closer. That is news, and news is not in a stat line.
   *
   * So the app hands over the candidate list, already filtered to genuinely
   * available players and already priced in league points, and asks Claude to
   * re-rank them on news and role — not to discover them. That is also what
   * keeps the call cheap: the search budget is sized to the positions of need,
   * not to the size of the wire. */
  /* Shared with handoff.js's buildWaivers() for the identical reason
   * rulesText() already is: Tj, 2026-09-18, asked that the same rule apply
   * to "the claude chat export and import system to ask Claude for advice
   * also" — one paragraph written once, not two hand-copied ones that can
   * quietly drift apart the next time either gets edited. */
  function qbSkepticismText() {
    return [
      'QUARTERBACK SWAPS: BE SKEPTICAL, NOT ENTHUSIASTIC. A completed pass is',
      'worth a full point in this league, so an accurate, high-volume passer',
      'already has a strong, stable floor under this scoring even in a quiet',
      'week for yards or touchdowns — that is real value, not a name to be',
      'casually upgraded. Do not suggest replacing my starting quarterback',
      'because a free agent had one good week, fits a favorable one-week',
      'matchup, or carries a generic season projection nobody has actually',
      'lived up to yet. Only suggest a QB add ahead of my own starter if it',
      'is a genuine SEASON-LONG edge: the free agent has real, measured games',
      'this season — not a projection alone — that are clearly and',
      'consistently better under THIS scoring, by several points a game, not',
      'a rounding margin. A good starting QB already outscores every other',
      'position here by a wide margin under a full-point-per-completion',
      'rule, so a small gap is noise at this position\'s scale even where it',
      'would be a real edge at running back or receiver. When you do compare',
      'quarterbacks, weigh completions and accuracy heavily — that is what',
      'this league actually pays for, more than yardage or a rushing',
      'ceiling. If you are not confident the edge holds up over the rest of',
      'the season, leave QB off your answer entirely rather than suggesting',
      'a marginal swap.'
    ].join('\n');
  }

  function waiverPrefix() {
    var lines = [];
    lines.push('You are advising on fantasy football waiver-wire pickups.');
    lines.push('');
    lines.push('THIS LEAGUE DOES NOT USE STANDARD SCORING. Its exact table:');
    lines.push(rulesText());
    lines.push('');
    lines.push('READ THAT TABLE BEFORE RANKING ANYBODY. Public waiver-wire lists,');
    lines.push('"top adds" articles and expert rankings are written for half-PPR');
    lines.push('standard scoring. In this league a completed pass is worth 1 point, so a');
    lines.push('starting quarterback is worth roughly TWICE what those lists imply, and a');
    lines.push('high-volume passer on a bad team can outscore a good rushing QB. Passing');
    lines.push('yards are 1 per 20, receptions are full PPR, missed field goals are');
    lines.push('penalised on a distance ladder, and forced fumbles score nothing.');
    lines.push('You may use those articles as NEWS. Never use their rankings as VALUE.');
    lines.push('');
    lines.push('Starting slots: QB, RB, RB, WR, WR, WR, TE, FLEX (RB/WR/TE only), K, DEF/ST.');
    lines.push('');
    lines.push('FRESHNESS. Today\'s date is given below with the roster — treat it as the');
    lines.push('only date that matters. An article, forum thread or "waiver wire rankings"');
    lines.push('page that reads like it describes an earlier week — a designation that');
    lines.push('would already have resolved by now, a "questionable for Week N" where N');
    lines.push('is not this week, a ranking published before this week\'s injury news broke —');
    lines.push('is STALE. Do not use it and do not let it anchor your judgement even as');
    lines.push('background; search again for something dated THIS week instead. Prefer');
    lines.push('sources from the last 7 days, and say so if the best you found is older.');
    lines.push('');
    lines.push('TASK.');
    lines.push('1. The AVAILABLE block below is the complete set of players not on any of');
    lines.push('   the ten rosters in this league, with the app\'s own projection already');
    lines.push('   converted to the scoring above. Treat availability as settled fact and');
    lines.push('   the projection as the baseline you are adjusting.');
    lines.push('2. Search the web for THIS WEEK\'s waiver-wire and injury news relevant to');
    lines.push('   those players and to the positions marked as needs. You are looking for');
    lines.push('   the things a stat line cannot show: a starter ahead of them getting hurt');
    lines.push('   or benched, a new role, a snap-count or touch trend, a coach naming a');
    lines.push('   starter, a suspension ending.');
    lines.push('3. MY ROSTER — INJURIES below lists my own players carrying an ESPN');
    lines.push('   designation or a bye this week. For each one NOT on a bye, search for');
    lines.push('   his rest-of-season outlook — severity, body part, expected timeline —');
    lines.push('   and report it in the "injuries" list even if you conclude he does not');
    lines.push('   need replacing. The bye-week ones need no research; just echo the');
    lines.push('   reason already given.');
    lines.push('4. Rank the best adds FOR THIS ROSTER, by position. A player who would not');
    lines.push('   crack the starting lineup is worth less than his raw points suggest;');
    lines.push('   a player who would replace a weak or injured starter is worth more.');
    lines.push('');
    lines.push('PRIORITY: SEASON OVER WEEK. An add that fills a role for the rest of the');
    lines.push('year — the starter ahead of him is hurt for multiple weeks, a permanent');
    lines.push('depth-chart move, a rookie who has clearly taken over — is worth far more');
    lines.push('than one that only helps THIS single week (a bye-week fill-in, a');
    lines.push('matchup-only spot start). Set every add\'s "priority" accordingly, and rank');
    lines.push('season-long roster improvements ahead of small weekly changes within the');
    lines.push('same position even when the raw weekly projection is close.');
    lines.push('');
    lines.push('K/DEF: LOW PRIORITY. A streamed kicker or defense for one good matchup is');
    lines.push('exactly the kind of small weekly change that matters least here. The KDEF');
    lines.push('NEED line below says whether my own kicker and defense are genuinely');
    lines.push('unavailable this week (on bye or ruled out). Rank a K or DEF add ONLY when');
    lines.push('that flag is true for the position being replaced — otherwise omit K and');
    lines.push('DEF entirely, even if you found a decent one. The app will discard any K');
    lines.push('or DEF add that is not actually needed, so ranking one you were not asked');
    lines.push('for wastes your own search budget.');
    lines.push('');
    lines.push(qbSkepticismText());
    lines.push('');
    lines.push('Answer with JSON ONLY, no prose outside it, in exactly this shape:');
    lines.push('{"adds":[{"name":"<exact name>","pos":"QB|RB|WR|TE|K|DEF",');
    lines.push('  "nfl":"<team abbr>","rank":1,');
    lines.push('  "overStarter":"<name of the starter he beats, or empty string>",');
    lines.push('  "priority":"season|week",');
    lines.push('  "recentStat":"<his exact stat line from his most recent game, dated —');
    lines.push('    e.g. \'3 rec, 34 yds vs DAL (Wk 2)\'. Empty string if no box score was');
    lines.push('    found.>",');
    lines.push('  "dropCandidate":"<the exact name of ONE player from THAT SAME POSITION\'s');
    lines.push('    entry in DROP CANDIDATES below, or an empty string if my roster has no');
    lines.push('    fair swap at this position (e.g. an open bench spot). NEVER a name at a');
    lines.push('    different position and never a name you invented — pick only from the');
    lines.push('    list given.>",');
    lines.push('  "confidence":"high|medium|low",');
    lines.push('  "why":"<the NEWS or role reason, dated, with the outlet named, and what');
    lines.push('    it means under THIS scoring. When the opportunity comes from an injury');
    lines.push('    or benching ahead of him, NAME that player and the date it happened —');
    lines.push('    e.g. "the new starter after <name>\'s <date> injury". Two sentences');
    lines.push('    maximum.>"}],');
    lines.push(' "injuries":[{"name":"<exact name from MY ROSTER — INJURIES>",');
    lines.push('  "extent":"<what you found: severity, body part, how it happened>",');
    lines.push('  "timeline":"<expected return / rest-of-season outlook, dated and cited —');
    lines.push('    say plainly if you found nothing beyond the app\'s own designation>",');
    lines.push('  "replace":true}],');
    lines.push(' "needs":"<one sentence: where this roster is actually thin, and why>",');
    lines.push(' "summary":"<two sentences: what to do first>"}');
    lines.push('');
    lines.push('RULES FOR THE FIELDS:');
    lines.push('- "rank" is 1 = best add overall. Rank WITHIN each position too by');
    lines.push('  listing that position\'s players in order.');
    lines.push('- Return the best few at EACH position that has any credible option, not');
    lines.push('  a single global list. A list of nothing but quarterbacks is useless even');
    lines.push('  though quarterbacks score most here.');
    lines.push('- "overStarter" ONLY when you actually believe he beats that named starter');
    lines.push('  this week under this scoring. Empty string otherwise. Do not guess.');
    lines.push('- Prefer players from the AVAILABLE block. You may add at most 2 players');
    lines.push('  who are NOT in it if the news is strong; mark those with');
    lines.push('  "confidence":"low" so the app can warn that it cannot verify they are');
    lines.push('  free in this league.');
    lines.push('- If a position has no credible add, omit it rather than padding.');
    lines.push('- "injuries" — one entry per name in MY ROSTER — INJURIES that is not on a');
    lines.push('  bye. If you found nothing beyond the app\'s own designation, say so');
    lines.push('  plainly in "timeline" rather than inventing a timetable.');
    lines.push('- Never invent news. If you found nothing on a player, do not rank him.');
    return lines.join('\n');
  }

  function waiverBlock(ctx) {
    var lines = [], i, k;
    lines.push('NFL week ' + ctx.week + ' of the ' + ctx.season + ' season. Today is ' +
               ctx.today + '.');
    lines.push('');
    lines.push('MY STARTING LINEUP as the app currently projects it, in league points:');
    for (i = 0; i < ctx.starters.length; i++) {
      var s = ctx.starters[i];
      lines.push('- ' + s.slot + ': ' + s.name + ' (' + s.pos + ') proj ' +
                 (typeof s.proj === 'number' ? s.proj.toFixed(1) : '?'));
    }
    lines.push('');
    lines.push('MY BENCH: ' + (ctx.bench.length ? ctx.bench.join(', ') : '(empty)'));
    lines.push('');
    if (ctx.injuries && ctx.injuries.length) {
      lines.push('MY ROSTER — INJURIES (see TASK 3 above — research the non-bye ones):');
      for (i = 0; i < ctx.injuries.length; i++) {
        var inj = ctx.injuries[i];
        lines.push('- ' + inj.name + ' (' + inj.pos + ', ' + inj.nfl + ') — ' + inj.status +
                   (inj.note ? ': ' + inj.note : ''));
      }
      lines.push('');
    }
    lines.push('KDEF NEED — whether a K or DEF add is worth ranking at all: K ' +
               ((ctx.kdefNeed && ctx.kdefNeed.K)
                 ? 'NEEDED — mine is unavailable this week'
                 : 'not needed — my kicker is available') +
               '; DEF ' +
               ((ctx.kdefNeed && ctx.kdefNeed.DEF)
                 ? 'NEEDED — mine is unavailable this week'
                 : 'not needed — my defense is available') + '.');
    lines.push('');
    if (ctx.dropCandidates) {
      var any = false;
      for (k in ctx.dropCandidates) {
        if (Object.prototype.hasOwnProperty.call(ctx.dropCandidates, k) &&
            ctx.dropCandidates[k].length) { any = true; break; }
      }
      if (any) {
        lines.push('DROP CANDIDATES — my own weakest player at each position, ranked by');
        lines.push('rest-of-season value (worst first). "dropCandidate" on an add MUST be');
        lines.push('chosen from the matching position\'s list here, or left an empty string:');
        for (k in ctx.dropCandidates) {
          if (!Object.prototype.hasOwnProperty.call(ctx.dropCandidates, k)) continue;
          if (!ctx.dropCandidates[k].length) continue;
          lines.push('  ' + k + ': ' + ctx.dropCandidates[k].map(function (d) {
            return d.name + ' (ROS value ' + d.ros.toFixed(1) + ')';
          }).join(', '));
        }
        lines.push('');
      }
    }
    if (ctx.needs && ctx.needs.length) {
      lines.push('POSITIONS OF NEED, weakest first, with the starter who would be');
      lines.push('replaced and the app\'s projection for him:');
      for (i = 0; i < ctx.needs.length; i++) {
        lines.push('- ' + ctx.needs[i].pos + ': ' + ctx.needs[i].name + ' proj ' +
                   ctx.needs[i].proj.toFixed(1) +
                   (ctx.needs[i].note ? ' — ' + ctx.needs[i].note : ''));
      }
      lines.push('');
    }
    lines.push('AVAILABLE — nobody in this list is on any of the ten rosters. "proj" is');
    lines.push('this week in league points; "vor" is points above the next best free agent');
    lines.push('at the same position, which is the only number here comparable ACROSS');
    lines.push('positions. Grouped by position, best first.');
    for (k in ctx.pool) {
      if (!Object.prototype.hasOwnProperty.call(ctx.pool, k)) continue;
      if (!ctx.pool[k].length) continue;
      lines.push('  ' + k + ':');
      for (i = 0; i < ctx.pool[k].length; i++) {
        var f = ctx.pool[k][i];
        lines.push('   - ' + f.name + ' | ' + f.nfl + ' | proj ' + f.v.toFixed(1) +
                   ' | vor ' + (typeof f.vor === 'number' ? f.vor.toFixed(1) : '0') +
                   (f.onBye ? ' | ON BYE' : '') +
                   (f.usage ? ' | recent usage: ' + f.usage : ''));
      }
    }
    lines.push('');
    lines.push('Rank the best adds for THIS roster, by position, using the JSON shape above.');
    return lines.join('\n');
  }

  function buildWaiverPrompt(ctx) {
    return waiverPrefix() + '\n\n' + waiverBlock(ctx);
  }

  /* Searches are the bill. Sized to the POSITIONS OF NEED (two per thin
     position covers "who just got hurt / who just took the job") plus one
     per non-bye injury on my own roster, since that is real research too —
     the app cannot look up an injury timeline itself, only Claude can.
     Pulled out for the same reason as adviceSearchBudget above — the on-
     screen cost estimate must use this exact function, not a second copy. */
  function waiverSearchBudget(needs, injuries) {
    var nNeed = Math.max(1, (needs || []).length);
    var nInj = (injuries || []).filter(function (x) { return !x.onBye; }).length;
    var budget = Math.max(3, Math.min(10, nNeed * 2 + Math.min(3, nInj)));
    if (depth() === 'cheap') budget = Math.max(2, Math.min(5, nNeed));
    if (depth() === 'full') budget = 12;
    return budget;
  }
  function askWaivers(ctx, onStep) {
    if (!configured()) return Promise.reject(new Error('no API key set'));
    var budget = waiverSearchBudget(ctx.needs, ctx.injuries);
    var nInj = (ctx.injuries || []).filter(function (x) { return !x.onBye; }).length;
    var mdl = depth() === 'cheap' ? cheapModel() : model();
    var body = {
      model: mdl,
      /* same reasoning as the advice call: a cap costs nothing unused, and
         running out mid-answer is the failure that actually happens. Bumped
         over the flat 8000 because every add now carries three more fields
         and there is a whole second "injuries" array on top. */
      max_tokens: 8000 + Math.min(5, nInj) * 400,
      messages: [{ role: 'user', content: [
        /* the fixed half — scoring table, task, JSON shape — is identical every
           week, so it is re-read at a tenth of the price inside the window */
        { type: 'text', text: waiverPrefix(), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: waiverBlock(ctx) }
      ] }],
      tools: [{ type: searchToolType(mdl), name: 'web_search', max_uses: budget }],
      stream: true
    };
    if (onStep) onStep('Claude is reading the waiver wire…', 60);
    return root.Espn._httpPost(API, headers(), JSON.stringify(body),
                               { timeout: 300000, raw: true }).then(function (rawText) {
      if (rawText.charAt(0) === '{') {
        var errJ;
        try { errJ = JSON.parse(rawText); } catch (e) { errJ = null; }
        if (errJ && errJ.error) throw new Error(errJ.error.message || JSON.stringify(errJ.error));
      }
      var j = parseSse(rawText);
      var parsed = jsonOf(textOf(j), { want: 'adds', stop: j.stop_reason });
      /* Which names were actually in the block we sent? Anything else is a
         suggestion the app cannot verify is free in this league, and it is
         labelled that way rather than quietly presented as equivalent. */
      var adds = normalizeWaivers(parsed, poolIndex(ctx.pool),
                                   dropCandidateIndex(ctx.dropCandidates),
                                   ctx.kdefNeed).adds;
      var injuries = normalizeInjuries(parsed, ctx.injuries);
      var spent = null;
      if (root.Usage) spent = root.Usage.record('waiver sync', mdl, j.usage);
      return {
        at: Date.now(), week: ctx.week, model: mdl, searchBudget: budget,
        adds: adds,
        injuries: injuries,
        needs: String(parsed.needs || ''),
        summary: String(parsed.summary || ''),
        truncated: !!parsed._truncated,
        usage: j.usage || null, spent: spent
      };
    });
  }

  /* The waiver twin of normalizeAdvice, and shared with handoff.js for the
     same reason. `known` is the canonical-name index of the pool the app
     actually sent; anything outside it is a name the app cannot confirm is
     free in this league, and that distinction is the whole safety property of
     this screen — it must be computed in exactly one place.
     `dropIdx` (optional) is the canonical-name index of the drop-candidate
     list the app offered, keyed to a position — a `dropCandidate` is kept
     ONLY when it names a real candidate AT THE SAME POSITION as the add, so
     "drop the kicker, add a receiver" cannot happen even if a model ignores
     the instruction; anything else is silently cleared rather than shown,
     because a wrong pairing is worse than none.
     `kdefNeed` (optional) is {K,DEF} — when supplied, a K or DEF add is kept
     only when the app itself says that position is actually short this
     week. Both are optional so older callers (tests, a handoff reply built
     before this existed) are unaffected: no data, no filtering.

     QB gets the same treatment as K/DEF, for the opposite reason (Tj,
     2026-09-18: "only recommend a replacement qb if it is truly a season
     edge" over an accurate, high-completion QB already rostered). The
     prompt already asks Claude for this; this is the backstop for when it
     does not comply. `src.n` (measured games behind THIS free agent's own
     number — only known for a player the app actually priced and sent, in
     `known`) has to clear `Value.QB_MIN_MEASURED`, the exact same bar
     value.js's own deterministic board holds a QB free agent to — one
     number, read from value.js rather than copied here, so the two paths
     cannot quietly drift apart. An unverified QB suggestion (a name Claude
     added that was not in the pool sent) cannot be checked this way and is
     left to its own "confidence" field, same as before. */
  function normalizeWaivers(parsed, known, dropIdx, kdefNeed) {
    dropIdx = dropIdx || {};
    var qbMinMeasured = (root.Value && typeof root.Value.QB_MIN_MEASURED === 'number')
      ? root.Value.QB_MIN_MEASURED : 3;
    var adds = [], arr = (parsed && parsed.adds) || [], i;
    for (i = 0; i < arr.length; i++) {
      var a = arr[i];
      if (!a || !a.name) continue;
      var src = known[root.Names.canon(a.name)] || null;
      var pos = String(a.pos || (src ? src.pos : '')).toUpperCase();
      if ((pos === 'K' || pos === 'DEF') && kdefNeed && !kdefNeed[pos]) continue;
      if (pos === 'QB' && src && typeof src.n === 'number' && src.n < qbMinMeasured) continue;
      var dcName = String(a.dropCandidate || '').trim();
      var dcRec = dcName ? dropIdx[root.Names.canon(dcName)] : null;
      var dropCandidate = (dcRec && dcRec.pos === pos) ? dcRec.name : '';
      adds.push({
        name: String(a.name),
        pos: pos,
        nfl: String(a.nfl || (src ? src.nfl : '')),
        rank: (typeof a.rank === 'number' && isFinite(a.rank)) ? a.rank : 99,
        overStarter: String(a.overStarter || ''),
        priority: (a.priority === 'season') ? 'season' : 'week',
        recentStat: String(a.recentStat || ''),
        dropCandidate: dropCandidate,
        confidence: String(a.confidence || 'low').toLowerCase(),
        why: String(a.why || ''),
        verified: !!src,                 /* was he in the block we sent? */
        proj: src ? src.v : null,
        vor: src ? src.vor : null,
        bye: src ? src.bye : null,
        onBye: src ? !!src.onBye : false
      });
    }
    adds.sort(function (x, y) {
      /* season-priority first, so "entire season over small weekly changes"
         holds even where the model's own rank numbers do not fully reflect
         it — this is also what puts season-priority adds ahead of week-only
         ones once the UI groups the flat list back out by position. */
      var pa = x.priority === 'season' ? 0 : 1, pb = y.priority === 'season' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return x.rank - y.rank;
    });
    return { adds: adds };
  }

  /* ================= TEAM ANALYSIS (2026-09-17b) =========================
   * Tj: "ask Claude its overall take on my team versus every other team in
   * the league and recommendations on how to improve my team." Unlike the
   * advice/waiver calls above, there is deliberately NO web_search tool here.
   * Every fact this prompt hands over — a rest-of-season price, an injury
   * flag, a standing — is already fresh from the app's own feeds (that is
   * exactly what TeamReport.context assembles); a search cannot improve on
   * a number the app already computed, and Claude has no way to research
   * what a specific other owner would actually trade away — that is private
   * league information no search engine has. What Claude adds here is
   * JUDGMENT over given facts, not research, so this call is plain text in,
   * plain text out — cheaper and faster than the advice/waiver calls, and
   * the on-screen cost estimate should say so. */
  function teamAnalysisPrefix() {
    var lines = [];
    lines.push('You are giving a fantasy football team owner your honest, professional');
    lines.push('read on his team versus every other team in his league. A standings table');
    lines.push('and every roster in the league follow in the next block, already priced in');
    lines.push('this league\'s own scoring and already flagged for current injuries — that');
    lines.push('part is done; your job is judgment, not further research.');
    lines.push('');
    lines.push('THIS LEAGUE DOES NOT USE STANDARD SCORING. Its exact table:');
    lines.push(rulesText());
    lines.push('');
    lines.push('The single most important difference: a completed pass is worth 1 point.');
    lines.push('A starting QB throwing 25 completions banks 25 points before yards or');
    lines.push('touchdowns, so volume passers are far more valuable here than in a normal');
    lines.push('league. Every public "team power ranking" assumes standard or half-PPR');
    lines.push('scoring and is wrong here in a specific, sizeable way — judge every roster');
    lines.push('only by the "pts/gm" numbers given below, which are already in this');
    lines.push('league\'s own points.');
    lines.push('');
    lines.push('TASK.');
    lines.push('1. Read the standings and every roster in the next block.');
    lines.push('2. Form an honest overall verdict: where this team genuinely ranks in this');
    lines.push('   specific league, and why — strengths, weaknesses, roster construction.');
    lines.push('3. Compare it to each other team, briefly — one sentence per team naming');
    lines.push('   the actual matchup (a real position battle, not a generic compliment).');
    lines.push('4. Give concrete recommendations to improve it: a realistic trade to');
    lines.push('   explore (naming a specific player on a specific other roster, and what');
    lines.push('   to offer for him), a waiver add worth pursuing, or a lineup/roster-');
    lines.push('   construction fix — whichever actually applies. Ground every player you');
    lines.push('   name in the rosters or the AVAILABLE list given. Never invent a player');
    lines.push('   or a team, and never claim to know what another owner would accept —');
    lines.push('   frame a trade as worth OFFERING, never as something that will happen.');
    lines.push('5. Write the answer as the JSON file described below.');
    lines.push('');
    lines.push('Answer with JSON ONLY, no prose outside it, in exactly this shape:');
    lines.push('{"overall":{"rank":1,"of":10,');
    lines.push('   "verdict":"<a few honest sentences: where this team really stands and');
    lines.push('     why>"},');
    lines.push(' "teamComparisons":[{"team":"<exact team name from the standings table>",');
    lines.push('   "note":"<one or two sentences on that specific matchup>"}],');
    lines.push(' "strengths":["<short phrase>"],');
    lines.push(' "weaknesses":["<short phrase>"],');
    lines.push(' "recommendations":[{"type":"trade|waiver|lineup|general",');
    lines.push('   "action":"<one short imperative sentence>",');
    lines.push('   "targetPlayer":"<exact name from a roster or AVAILABLE, or empty');
    lines.push('     string>",');
    lines.push('   "fromTeam":"<exact team name, only when targetPlayer is a trade target');
    lines.push('     on another roster, else empty string>",');
    lines.push('   "giveUp":"<exact name from MY OWN roster to offer, trade only, else');
    lines.push('     empty string>",');
    lines.push('   "dropCandidate":"<exact name from MY DROP CANDIDATES, waiver only, else');
    lines.push('     empty string>",');
    lines.push('   "why":"<the reasoning, one or two sentences>"}],');
    lines.push(' "summary":"<two or three sentence bottom line: what to do first>"}');
    lines.push('');
    lines.push('RULES FOR THE FIELDS:');
    lines.push('- "rank"/"of" — your honest read of where this team truly stands among all');
    lines.push('  the teams in the league, 1 = best. Weigh roster strength and depth as');
    lines.push('  given, not only the standings — a team can be lucky or unlucky so far.');
    lines.push('- "team" in teamComparisons — copy the name EXACTLY as given in the');
    lines.push('  standings table. Cover every other team once.');
    lines.push('- "targetPlayer"/"fromTeam"/"giveUp"/"dropCandidate" — copy names EXACTLY');
    lines.push('  as given. Never invent a player or a team; leave a field an empty string');
    lines.push('  rather than guess.');
    lines.push('- A trade recommendation needs both "targetPlayer" and "fromTeam". A');
    lines.push('  waiver recommendation should set "dropCandidate" when there is a fair');
    lines.push('  swap at the same position.');
    lines.push('- Do not pad the list — 3 to 6 real recommendations beat 10 padded ones.');
    return lines.join('\n');
  }

  function teamAnalysisBlock(ctx) {
    var lines = [], i, k;
    lines.push('NFL week ' + ctx.week + ' of the ' + ctx.season + ' season. Today is ' +
               ctx.today + '.');
    lines.push('');
    lines.push('STANDINGS, best record first ("(you)" marks your own team):');
    lines.push('| rank | team | record | points |');
    lines.push('|---|---|---|---|');
    for (i = 0; i < ctx.rosters.length; i++) {
      var s = ctx.rosters[i];
      lines.push('| ' + s.rankWL + ' | ' + s.name + (s.mine ? ' (you)' : '') + ' | ' +
                 s.w + '-' + s.l + (s.t ? '-' + s.t : '') + ' | ' + s.pts.toFixed(1) + ' |');
    }
    lines.push('');
    lines.push('EVERY ROSTER IN THE LEAGUE. "pts/gm" is a rest-of-season per-game price,');
    lines.push('already in this league\'s scoring — judge every player by this number, not');
    lines.push('by reputation. A status tag flags a current injury/inactive designation;');
    lines.push('no tag means clear.');
    lines.push('');
    for (i = 0; i < ctx.rosters.length; i++) {
      var t = ctx.rosters[i];
      lines.push('### ' + t.name + (t.mine ? ' (YOUR TEAM)' : '') + ' — ' +
                 t.w + '-' + t.l + (t.t ? '-' + t.t : '') + ', ' + t.pts.toFixed(1) +
                 ' pts, rank ' + t.rankWL + ' of ' + ctx.rosters.length);
      for (k = 0; k < t.players.length; k++) {
        var p = t.players[k];
        lines.push('- ' + p.name + ' | ' + p.pos + ' | ' + (p.nfl || '?') + ' | ' +
                   p.ros.toFixed(1) + ' pts/gm' +
                   (p.onBye ? ' | ON BYE wk ' + ctx.week : (p.health ? ' | ' + p.health : '')));
      }
      lines.push('');
    }
    lines.push('MY BENCH: ' + (ctx.bench.length ? ctx.bench.join(', ') : '(empty)'));
    lines.push('');
    if (ctx.injuries && ctx.injuries.length) {
      lines.push('MY ROSTER — INJURIES:');
      for (i = 0; i < ctx.injuries.length; i++) {
        var inj = ctx.injuries[i];
        lines.push('- ' + inj.name + ' (' + inj.pos + ', ' + inj.nfl + ') — ' + inj.status +
                   (inj.note ? ': ' + inj.note : ''));
      }
      lines.push('');
    }
    if (ctx.dropCandidates) {
      var any = false;
      for (k in ctx.dropCandidates) {
        if (Object.prototype.hasOwnProperty.call(ctx.dropCandidates, k) &&
            ctx.dropCandidates[k].length) { any = true; break; }
      }
      if (any) {
        lines.push('MY DROP CANDIDATES — weakest player at each position, worst first. A');
        lines.push('waiver recommendation\'s "dropCandidate" MUST come from here:');
        for (k in ctx.dropCandidates) {
          if (!Object.prototype.hasOwnProperty.call(ctx.dropCandidates, k)) continue;
          if (!ctx.dropCandidates[k].length) continue;
          lines.push('  ' + k + ': ' + ctx.dropCandidates[k].map(function (d) {
            return d.name + ' (ROS value ' + d.ros.toFixed(1) + ')';
          }).join(', '));
        }
        lines.push('');
      }
    }
    if (ctx.needs && ctx.needs.length) {
      lines.push('WHERE MY ROSTER IS THINNEST, weakest first:');
      for (i = 0; i < ctx.needs.length; i++) {
        lines.push('- ' + ctx.needs[i].pos + ': ' + ctx.needs[i].name + ' proj ' +
                   ctx.needs[i].proj.toFixed(1) +
                   (ctx.needs[i].note ? ' — ' + ctx.needs[i].note : ''));
      }
      lines.push('');
    }
    lines.push('AVAILABLE — nobody in this list is on any of the ' + ctx.rosters.length +
               ' rosters. A waiver recommendation\'s "targetPlayer" may come from here:');
    for (k in ctx.pool) {
      if (!Object.prototype.hasOwnProperty.call(ctx.pool, k)) continue;
      if (!ctx.pool[k].length) continue;
      lines.push('  ' + k + ': ' + ctx.pool[k].map(function (f) {
        return f.name + ' (' + f.v.toFixed(1) + ' pts/gm)';
      }).join(', '));
    }
    lines.push('');
    lines.push('Give your overall verdict, the team-by-team comparisons and concrete');
    lines.push('recommendations, using the JSON shape above.');
    return lines.join('\n');
  }

  function buildTeamAnalysisPrompt(ctx) {
    return teamAnalysisPrefix() + '\n\n' + teamAnalysisBlock(ctx);
  }

  function askTeamAnalysis(ctx, onStep) {
    if (!configured()) return Promise.reject(new Error('no API key set'));
    var mdl = depth() === 'cheap' ? cheapModel() : model();
    var body = {
      model: mdl,
      max_tokens: Math.max(2000, Math.min(8000, 1200 + ctx.rosters.length * 200)),
      messages: [{ role: 'user', content: [
        { type: 'text', text: teamAnalysisPrefix(), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: teamAnalysisBlock(ctx) }
      ] }],
      /* no `tools` at all — see the file-section comment above */
      stream: true
    };
    if (onStep) onStep('Claude is comparing your team to the league…', 60);
    return root.Espn._httpPost(API, headers(), JSON.stringify(body),
                               { timeout: 180000, raw: true }).then(function (rawText) {
      if (rawText.charAt(0) === '{') {
        var errJ;
        try { errJ = JSON.parse(rawText); } catch (e) { errJ = null; }
        if (errJ && errJ.error) throw new Error(errJ.error.message || JSON.stringify(errJ.error));
      }
      var j = parseSse(rawText);
      var parsed = jsonOf(textOf(j), { want: 'overall', stop: j.stop_reason });
      var norm = normalizeTeamAnalysis(parsed, ctx);
      var spent = null;
      if (root.Usage) spent = root.Usage.record('team analysis', mdl, j.usage);
      return {
        at: Date.now(), model: mdl, week: ctx.week, season: ctx.season,
        overall: norm.overall, teamComparisons: norm.teamComparisons,
        strengths: norm.strengths, weaknesses: norm.weaknesses,
        recommendations: norm.recommendations, summary: norm.summary,
        count: norm.count, usage: j.usage || null, spent: spent
      };
    });
  }

  /* Shared with handoff.js for the same reason normalizeAdvice/
     normalizeWaivers are: one implementation of what a reply MEANS, called
     from both the live path and the offline round trip, so the two can never
     silently drift apart. `verified` mirrors normalizeWaivers' own
     property — was this name actually somewhere the app told Claude to
     look? — computed against the SAME rosters/pool/dropCandidates the
     prompt itself carried, never invented rules of its own. */
  /* Team names are owner-chosen arbitrary strings ("JR", "Tim", ...), not
     player names — Names.canon() must never touch one. It folds standalone
     suffix tokens ("jr"/"sr"/"ii"/"iii"/"iv"/"v") to nothing so "Odell
     Beckham Jr." and "Odell Beckham" match, which is exactly right for a
     player and exactly wrong here: a real team literally named "JR" would
     canonicalize to '', the same key an EMPTY (no team given) field maps
     to — silently pairing every field-with-no-team-named onto a real team.
     A plain lowercase/trim is the whole normalization a team name needs. */
  function teamKey(s) { return String(s || '').toLowerCase().trim().replace(/\s+/g, ' '); }

  /* No `mdl` parameter, unlike normalizeAdvice — that one stamps it onto
     every per-player record, but a team-analysis reply has no per-item
     provenance to carry; the caller stamps `model` once at the top level
     instead (see askTeamAnalysis's return object and handoff.js's
     savedT.model), so a parameter here would go unused. */
  function normalizeTeamAnalysis(parsed, ctx) {
    var o = parsed || {};
    var overall = o.overall || {};

    /* Unlike a player name (a huge, open-ended universe where "not in this
       league" is a real and common case — see `verified` below), a team
       name is a closed set of exactly the names this prompt handed over. A
       team that does not match one of them is not "found something outside
       what we sent", it is invented outright, and displaying a comparison
       against a team that does not exist is worse than dropping it. */
    var teamNameIdx = {}, i, k;
    if (ctx && ctx.rosters) {
      for (i = 0; i < ctx.rosters.length; i++) {
        teamNameIdx[teamKey(ctx.rosters[i].name)] = ctx.rosters[i].name;
      }
    }
    var teamComparisons = Array.isArray(o.teamComparisons) ? o.teamComparisons.map(function (x) {
      var team = String((x && x.team) || '').trim();
      var real = team ? teamNameIdx[teamKey(team)] : null;
      return real ? { team: real, note: String((x && x.note) || '') } : null;
    }).filter(function (x) { return !!x; }) : [];
    var strengths = Array.isArray(o.strengths) ? o.strengths.map(String).filter(Boolean) : [];
    var weaknesses = Array.isArray(o.weaknesses) ? o.weaknesses.map(String).filter(Boolean) : [];

    var rosterIdx = {};
    if (ctx && ctx.rosters) {
      for (i = 0; i < ctx.rosters.length; i++) {
        for (k = 0; k < ctx.rosters[i].players.length; k++) {
          rosterIdx[root.Names.canon(ctx.rosters[i].players[k].name)] = {
            name: ctx.rosters[i].players[k].name, team: ctx.rosters[i].name,
            mine: ctx.rosters[i].mine
          };
        }
      }
    }
    var poolIdx = poolIndex((ctx && ctx.pool) || {});
    var dropIdx = dropCandidateIndex((ctx && ctx.dropCandidates) || {});

    var recs = Array.isArray(o.recommendations) ? o.recommendations.map(function (r) {
      r = r || {};
      var targetPlayer = String(r.targetPlayer || '').trim();
      var fromRoster = targetPlayer ? rosterIdx[root.Names.canon(targetPlayer)] : null;
      var fromPool = targetPlayer ? poolIdx[root.Names.canon(targetPlayer)] : null;
      var giveUp = String(r.giveUp || '').trim();
      var giveUpRec = giveUp ? rosterIdx[root.Names.canon(giveUp)] : null;
      var dropCandidate = String(r.dropCandidate || '').trim();
      var dropRec = dropCandidate ? dropIdx[root.Names.canon(dropCandidate)] : null;
      var fromTeamRaw = String(r.fromTeam || (fromRoster ? fromRoster.team : '')).trim();
      return {
        type: String(r.type || 'general').toLowerCase(),
        action: String(r.action || ''),
        targetPlayer: targetPlayer,
        /* same closed-set reasoning as teamComparisons above — a trade
           source must be a real team or blank, never an invented one */
        fromTeam: fromTeamRaw ? (teamNameIdx[teamKey(fromTeamRaw)] || '') : '',
        /* giveUp only ever names a player confirmed on MY OWN roster — a
           model naming somebody else's player here would otherwise read as
           "trade away a player you do not own", which the app must never
           display as an actionable step */
        giveUp: (giveUpRec && giveUpRec.mine) ? giveUpRec.name : '',
        dropCandidate: dropRec ? dropRec.name : '',
        why: String(r.why || ''),
        verified: !targetPlayer || !!fromRoster || !!fromPool
      };
    }).filter(function (r) { return r.action; }) : [];

    return {
      overall: {
        rank: (typeof overall.rank === 'number' && isFinite(overall.rank)) ? overall.rank : 0,
        of: (typeof overall.of === 'number' && isFinite(overall.of)) ? overall.of
            : ((ctx && ctx.rosters) ? ctx.rosters.length : 0),
        verdict: String(overall.verdict || '')
      },
      teamComparisons: teamComparisons,
      strengths: strengths, weaknesses: weaknesses,
      recommendations: recs,
      summary: String(o.summary || ''),
      count: recs.length
    };
  }

  /* The canonical-name index of a waiver pool, so handoff.js can build the
     same `known` map ask/askWaivers builds internally. */
  function poolIndex(pool) {
    var known = {}, k, i;
    for (k in pool) {
      if (!Object.prototype.hasOwnProperty.call(pool, k)) continue;
      for (i = 0; i < pool[k].length; i++) {
        known[root.Names.canon(pool[k][i].name)] = pool[k][i];
      }
    }
    return known;
  }

  /* Same idea, for Value.dropCandidates: {POS:[{name,pos,ros},...]} ->
     canonical name -> {name, pos}. */
  function dropCandidateIndex(dropCandidates) {
    var idx = {}, k, i;
    if (!dropCandidates) return idx;
    for (k in dropCandidates) {
      if (!Object.prototype.hasOwnProperty.call(dropCandidates, k)) continue;
      var list = dropCandidates[k] || [];
      for (i = 0; i < list.length; i++) {
        idx[root.Names.canon(list[i].name)] = { name: list[i].name, pos: list[i].pos || k };
      }
    }
    return idx;
  }

  /* Claude's season-outlook read on MY ROSTER — INJURIES, keyed against the
     app's own list so an entry for a name that was never on it (invented, or
     misspelled) cannot slip through — same safety property as `known` above,
     applied to injuries instead of free agents. */
  function normalizeInjuries(parsed, myInjuries) {
    var known = {}, i;
    for (i = 0; i < (myInjuries || []).length; i++) {
      known[root.Names.canon(myInjuries[i].name)] = myInjuries[i];
    }
    var out = [], arr = (parsed && parsed.injuries) || [];
    for (i = 0; i < arr.length; i++) {
      var it = arr[i];
      if (!it || !it.name) continue;
      var base = known[root.Names.canon(it.name)];
      if (!base) continue;
      out.push({ name: base.name, pos: base.pos, status: base.status,
                 extent: String(it.extent || ''), timeline: String(it.timeline || ''),
                 replace: it.replace !== false });
    }
    return out;
  }

  /* A recap write-up. No web search, no tools, small output: this is the one
     Claude call in the app that costs about a cent, because it is not
     researching anything — the facts are already computed and handed over.
     v3.3: it now ALWAYS uses the routine model. This is the one place where
     the cheap model costs nothing in accuracy, because there is no judgement
     in the task — every fact is supplied verbatim and the job is phrasing. A
     top-tier model writing 120 words of chat banter is money set on fire. */
  function recap(factText, week) {
    if (!configured()) return Promise.reject(new Error('no API key set'));
    var body = {
      model: cheapModel(),
      max_tokens: 700,
      messages: [{ role: 'user', content:
        'Here are the settled facts of week ' + week + ' of a fantasy football league. ' +
        'Write a short, dry, funny recap for the league chat: 120 words at most, no ' +
        'headings, no bullet points, no emoji, and invent NOTHING — every name and ' +
        'number must come from the facts below. This league pays 1 point per ' +
        'completion, so a big quarterback week is normal here and is not worth ' +
        'remarking on as if it were absurd.\n\n' + factText }]
    };
    return root.Espn._httpPost(API, headers(), JSON.stringify(body),
                               { timeout: 90000 }).then(function (j) {
      if (j && j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      if (root.Usage) root.Usage.record('weekly recap', body.model, j.usage);
      return textOf(j).trim();
    });
  }

  /* Cheapest possible round trip, to tell "the key is wrong" apart from
     "the roster prompt is wrong". */
  /* Deliberately NOT streaming and deliberately tiny: it returns in a second,
     which is what makes it a clean test of the key rather than of the network. */
  function test() {
    if (!configured()) return Promise.reject(new Error('no API key set'));
    var body = {
      model: model(), max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }]
    };
    return root.Espn._httpPost(API, headers(), JSON.stringify(body),
                               { timeout: 45000 }).then(function (j) {
      if (j && j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      if (root.Usage) root.Usage.record('key test', model(), j.usage);
      return 'Model ' + model() + ' replied: ' + textOf(j).trim().slice(0, 60);
    });
  }

  root.Ai = { ask: ask, test: test, recap: recap, depth: depth, CHEAP_MODEL: CHEAP_MODEL,
              cheapModel: cheapModel, listModels: listModels, cachedModels: cachedModels,
              askWaivers: askWaivers, buildWaiverPrompt: buildWaiverPrompt,
              askTeamAnalysis: askTeamAnalysis, buildTeamAnalysisPrompt: buildTeamAnalysisPrompt,
              adviceSearchBudget: adviceSearchBudget, waiverSearchBudget: waiverSearchBudget,
              searchToolType: searchToolType,
              _waiverPrefix: waiverPrefix, _waiverBlock: waiverBlock,
              _teamAnalysisPrefix: teamAnalysisPrefix, _teamAnalysisBlock: teamAnalysisBlock,
              FALLBACK_MODELS: FALLBACK,
              _staticPrefix: staticPrefix, _rosterBlock: rosterBlock, _parseSse: parseSse, configured: configured, model: model,
              DEFAULT_MODEL: DEFAULT_MODEL, buildPrompt: buildPrompt,
              /* shared with handoff.js so the offline round trip and the API
                 path can never disagree about what a reply means */
              normalizeAdvice: normalizeAdvice, normalizeWaivers: normalizeWaivers,
              normalizeTeamAnalysis: normalizeTeamAnalysis,
              normalizeInjuries: normalizeInjuries, dropCandidateIndex: dropCandidateIndex,
              poolIndex: poolIndex, parseAnswer: jsonOf, rulesText: rulesText,
              _jsonOf: jsonOf, _textOf: textOf };
})(typeof window !== 'undefined' ? window : this);
