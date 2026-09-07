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
    /* WHY THE STOP REASON IS KEPT (v4.3).
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
   */
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

  function ask(ctx, onStep) {
    if (!configured()) return Promise.reject(new Error('no API key set'));
    var mdl = depth() === 'cheap' ? cheapModel() : model();
    /* SEARCHES ARE THE BILL, not the tokens. One web search costs about what
       ten thousand input tokens cost, so the number of searches is sized to the
       number of players actually being researched rather than fixed at 8.
       Two per player is what a designation check needs; the ceiling stays 8. */
    var n = ctx.players.length;
    var budget = Math.max(2, Math.min(8, Math.ceil(n * 1.2)));
    if (depth() === 'full') budget = 8;
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
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: budget }],
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
      var byName = {}, i;
      var arr = parsed.players || [];
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
      }
      var spent = null;
      if (root.Usage) spent = root.Usage.record('advice sync', mdl, j.usage);
      return {
        at: Date.now(), model: mdl, byName: byName, searchBudget: budget,
        summary: String(parsed.summary || ''),
        count: arr.length,
        /* A rescued answer is USED but never presented as complete. The
           searches were already paid for, so throwing away the fourteen
           players that did arrive because three did not is the worst of both
           outcomes — but so is letting a partial answer look whole. */
        truncated: !!parsed._truncated,
        asked: n,
        usage: j.usage || null,
        spent: spent
      };
    });
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
    lines.push('TASK.');
    lines.push('1. The AVAILABLE block below is the complete set of players not on any of');
    lines.push('   the ten rosters in this league, with the app\'s own projection already');
    lines.push('   converted to the scoring above. Treat availability as settled fact and');
    lines.push('   the projection as the baseline you are adjusting.');
    lines.push('2. Search the web for this week\'s waiver-wire and injury news relevant to');
    lines.push('   those players and to the positions marked as needs. Prefer the last 7');
    lines.push('   days. You are looking for the things a stat line cannot show: a starter');
    lines.push('   ahead of them getting hurt or benched, a new role, a snap-count or');
    lines.push('   touch trend, a coach naming a starter, a suspension ending.');
    lines.push('3. Rank the best adds FOR THIS ROSTER, by position. A player who would not');
    lines.push('   crack the starting lineup is worth less than his raw points suggest;');
    lines.push('   a player who would replace a weak starter is worth more.');
    lines.push('');
    lines.push('Answer with JSON ONLY, no prose outside it, in exactly this shape:');
    lines.push('{"adds":[{"name":"<exact name>","pos":"QB|RB|WR|TE|K|DEF",');
    lines.push('  "nfl":"<team abbr>","rank":1,');
    lines.push('  "overStarter":"<name of the starter he beats, or empty string>",');
    lines.push('  "confidence":"high|medium|low",');
    lines.push('  "why":"<the NEWS or role reason, dated, with the outlet named, and what');
    lines.push('    it means under THIS scoring. Two sentences maximum.>"}],');
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

  function askWaivers(ctx, onStep) {
    if (!configured()) return Promise.reject(new Error('no API key set'));
    /* Searches are the bill. This one is sized to the POSITIONS OF NEED, not
       to the size of the wire: two searches per thin position covers "who just
       got hurt / who just took the job" at that position, which is the only
       question the app cannot answer for itself. */
    var nNeed = Math.max(1, (ctx.needs || []).length);
    var budget = Math.max(3, Math.min(10, nNeed * 2));
    if (depth() === 'cheap') budget = Math.max(2, Math.min(5, nNeed));
    if (depth() === 'full') budget = 12;
    var mdl = depth() === 'cheap' ? cheapModel() : model();
    var body = {
      model: mdl,
      /* same reasoning as the advice call: a cap costs nothing unused, and
         running out mid-answer is the failure that actually happens */
      max_tokens: 8000,
      messages: [{ role: 'user', content: [
        /* the fixed half — scoring table, task, JSON shape — is identical every
           week, so it is re-read at a tenth of the price inside the window */
        { type: 'text', text: waiverPrefix(), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: waiverBlock(ctx) }
      ] }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: budget }],
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
      var known = {}, k, i;
      for (k in ctx.pool) {
        if (!Object.prototype.hasOwnProperty.call(ctx.pool, k)) continue;
        for (i = 0; i < ctx.pool[k].length; i++) {
          known[root.Names.canon(ctx.pool[k][i].name)] = ctx.pool[k][i];
        }
      }
      var adds = [], arr = parsed.adds || [];
      for (i = 0; i < arr.length; i++) {
        var a = arr[i];
        if (!a || !a.name) continue;
        var nn = root.Names.canon(a.name);
        var src = known[nn] || null;
        adds.push({
          name: String(a.name),
          pos: String(a.pos || (src ? src.pos : '')).toUpperCase(),
          nfl: String(a.nfl || (src ? src.nfl : '')),
          rank: (typeof a.rank === 'number' && isFinite(a.rank)) ? a.rank : 99,
          overStarter: String(a.overStarter || ''),
          confidence: String(a.confidence || 'low').toLowerCase(),
          why: String(a.why || ''),
          verified: !!src,                 /* was he in the block we sent? */
          proj: src ? src.v : null,
          vor: src ? src.vor : null,
          bye: src ? src.bye : null,
          onBye: src ? !!src.onBye : false
        });
      }
      adds.sort(function (x, y) { return x.rank - y.rank; });
      var spent = null;
      if (root.Usage) spent = root.Usage.record('waiver sync', mdl, j.usage);
      return {
        at: Date.now(), week: ctx.week, model: mdl, searchBudget: budget,
        adds: adds,
        needs: String(parsed.needs || ''),
        summary: String(parsed.summary || ''),
        usage: j.usage || null, spent: spent
      };
    });
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
              _waiverPrefix: waiverPrefix, _waiverBlock: waiverBlock,
              FALLBACK_MODELS: FALLBACK,
              _staticPrefix: staticPrefix, _rosterBlock: rosterBlock, _parseSse: parseSse, configured: configured, model: model,
              DEFAULT_MODEL: DEFAULT_MODEL, buildPrompt: buildPrompt,
              _jsonOf: jsonOf, _textOf: textOf };
})(typeof window !== 'undefined' ? window : this);
