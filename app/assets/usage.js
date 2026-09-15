/* usage.js — what this app has spent on the Anthropic key. ES2018 only.
 *
 * WHY THIS IS A LOCAL LEDGER AND NOT A BALANCE LOOKUP
 * There is no endpoint a normal API key can call to ask "how much credit is
 * left". Anthropic's Usage and Cost API exists, but it needs an ADMIN key
 * (sk-ant-admin...), which is organisation-scoped: it can read every workspace's
 * spend and manage keys. That is not a credential to type into a phone app for
 * the sake of a progress bar, so this app does not ask for one and cannot show
 * a true balance.
 *
 * What it CAN do is count exactly what it spent itself. Every Messages response
 * reports its own token usage and web-search count, so each call is priced to
 * the cent as it happens and added to a running total. Give it the amount you
 * loaded onto the key and it can show the rest as a meter.
 *
 * THE HONEST CAVEAT, WHICH THE UI ALSO STATES: this counts THIS APP ONLY. Spend
 * the key anywhere else and the meter will read low. The authoritative number is
 * the Anthropic Console; this is a running estimate of what the tracker cost.
 */
(function (root) {
  'use strict';

  var KEY = 'fftracker_usage_v1';
  var MAX_CALLS = 200;          /* keep the ledger from growing without bound */

  /* Rates are per MILLION tokens, and per 1000 web searches. Found in the
   * 2026-09-15e sweep: this used to be ONE flat table (Sonnet 5's prices)
   * applied to every call regardless of which model actually ran it — but
   * ai.js picks the model per call (depth()==='cheap' sends Haiku 4.5;
   * 'weekly recap' always uses CHEAP_MODEL), so a Haiku call was silently
   * priced at roughly double its real cost, and any Opus call at roughly a
   * fifth. Tiered by model now; searchPer1000 stays flat because Anthropic
   * prices the web-search server tool per use, not per model. Each is still
   * editable in settings, per field, because prices and model names both
   * change and a wrong constant baked into an APK is worse than a field
   * someone can correct — an override wins over whichever tier a given call
   * used. Verified against Anthropic's published prices this session. */
  var RATE_TIERS = {
    opus:   { inPerM: 5.00, outPerM: 25.00, cacheReadPerM: 0.50, cacheWritePerM: 6.25 },
    sonnet: { inPerM: 2.00, outPerM: 10.00, cacheReadPerM: 0.20, cacheWritePerM: 2.50 },
    haiku:  { inPerM: 1.00, outPerM: 5.00,  cacheReadPerM: 0.10, cacheWritePerM: 1.25 }
  };
  var DEFAULT_RATES = {
    inPerM: RATE_TIERS.sonnet.inPerM,
    outPerM: RATE_TIERS.sonnet.outPerM,
    cacheReadPerM: RATE_TIERS.sonnet.cacheReadPerM,
    cacheWritePerM: RATE_TIERS.sonnet.cacheWritePerM,
    searchPer1000: 10.00
  };
  /* Classified by substring rather than an exact-id map, so a future dot
   * release (e.g. a 5.1) keeps pricing at the right tier without an edit
   * here — and anything unrecognised (a custom id Tj typed into settings)
   * falls back to the sonnet tier, the same default this always had. */
  function tierFor(model) {
    var m = String(model || '').toLowerCase();
    if (m.indexOf('opus') >= 0) return RATE_TIERS.opus;
    if (m.indexOf('haiku') >= 0) return RATE_TIERS.haiku;
    return RATE_TIERS.sonnet;
  }

  var led = { calls: [], spend: 0, tokensIn: 0, tokensOut: 0, searches: 0, since: 0 };

  function load() {
    try {
      var s = (root.Native && root.Native.load) ? root.Native.load(KEY)
              : root.localStorage.getItem(KEY);
      if (s) { var o = JSON.parse(s); if (o && o.calls) led = o; }
    } catch (e) { /* the ledger is a convenience, never load-bearing */ }
    if (!led.since) led.since = Date.now();
    return led;
  }
  function save() {
    try {
      var s = JSON.stringify(led);
      if (root.Native && root.Native.save) root.Native.save(KEY, s);
      else root.localStorage.setItem(KEY, s);
    } catch (e) { /* ditto */ }
  }

  function settings() {
    var S = root.Store && root.Store.get ? root.Store.get() : null;
    return (S && S.settings) ? S.settings : {};
  }
  function rates() {
    var s = settings(), r = {}, k;
    for (k in DEFAULT_RATES) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_RATES, k)) continue;
      var v = s['rate_' + k];
      r[k] = (typeof v === 'number' && isFinite(v) && v >= 0) ? v : DEFAULT_RATES[k];
    }
    return r;
  }
  function n(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }

  /* Price one Messages response from its own reported usage. */
  /* v3.10: this took a second `r` parameter that no caller ever passed, and
     the body then did `r = r || rates()` — an assignment to an undeclared
     name once the parameter was removed. Declared locally instead. */
  function priceOf(u) {
    if (!u) return { cost: 0, parts: [] };
    var r = rates();
    var inTok = n(u.input_tokens);
    var outTok = n(u.output_tokens);
    var cr = n(u.cache_read_input_tokens);
    var cw = n(u.cache_creation_input_tokens);
    var searches = (u.server_tool_use && n(u.server_tool_use.web_search_requests)) || 0;
    var parts = [];
    function add(label, amount) {
      if (amount > 0) parts.push({ label: label, cost: amount });
      return amount;
    }
    var cost = 0;
    cost += add(inTok + ' input tokens', inTok / 1e6 * r.inPerM);
    cost += add(outTok + ' output tokens', outTok / 1e6 * r.outPerM);
    cost += add(cr + ' cached tokens read', cr / 1e6 * r.cacheReadPerM);
    cost += add(cw + ' tokens written to cache', cw / 1e6 * r.cacheWritePerM);
    cost += add(searches + ' web search' + (searches === 1 ? '' : 'es'),
                searches / 1000 * r.searchPer1000);
    return { cost: cost, parts: parts, searches: searches,
             tokensIn: inTok + cr + cw, tokensOut: outTok };
  }

  /* Record one call. `what` is a short label ('advice sync', 'key test'). */
  function record(what, model, usage) {
    if (!led.since) load();
    var p = priceOf(usage);
    var entry = { at: Date.now(), what: what, model: model || '',
                  cost: p.cost, tokensIn: p.tokensIn, tokensOut: p.tokensOut,
                  searches: p.searches };
    led.calls.unshift(entry);
    if (led.calls.length > MAX_CALLS) led.calls.length = MAX_CALLS;
    led.spend = n(led.spend) + p.cost;
    led.tokensIn = n(led.tokensIn) + p.tokensIn;
    led.tokensOut = n(led.tokensOut) + p.tokensOut;
    led.searches = n(led.searches) + p.searches;
    save();
    return entry;
  }

  /* v6.2: dropped the budget/remaining/pct/syncsLeft fields this used to
   * return — "how much is left" stopped being answerable the day Tj removed
   * his key (see estimate() below, and CLAUDE.md's Claude-usage note). No
   * caller reads them any more; kept the historical totals, which are a
   * factual record rather than a claim about what is left. */
  function totals() {
    if (!led.since) load();
    var last = led.calls.length ? led.calls[0] : null;
    /* average over real syncs only — a two-token key test is not a sync */
    var syncs = 0, syncCost = 0, i;
    for (i = 0; i < led.calls.length; i++) {
      if (led.calls[i].what === 'advice sync') { syncs++; syncCost += led.calls[i].cost; }
    }
    return {
      spend: n(led.spend), calls: led.calls.length, since: led.since,
      tokensIn: n(led.tokensIn), tokensOut: n(led.tokensOut),
      searches: n(led.searches), last: last,
      syncs: syncs, perSync: syncs ? syncCost / syncs : 0,
      rates: rates(), usingDefaults: JSON.stringify(rates()) === JSON.stringify(DEFAULT_RATES)
    };
  }

  /* Estimate what a call would cost from its REAL inputs — the exact prompt
   * text length and search budget the call would actually send, computed by
   * the same functions the real call uses (Ai.adviceSearchBudget /
   * Ai.waiverSearchBudget) — never a number invented separately from what
   * the app would really do. ~4 characters per token is the standard rough
   * approximation for English prose and JSON, which is what every prompt
   * here is; outputTokens is necessarily rougher (there is no formula for
   * it the way there is for search count), but per ai.js's own comment
   * ("SEARCHES ARE THE BILL, not the tokens") search cost dominates the
   * total, so an imprecise output figure costs the estimate little.
   *
   * Tj, 2026-09-15: "I no longer have the API key... put an estimate of
   * what each request would cost." There is no historical average worth
   * trusting once the key is gone — nothing will ever add a new data point
   * to led.calls again — so a live number grounded in TODAY's real prompt
   * and triage size is the accurate answer, not a frozen average from
   * before he removed the key. */
  function estimate(promptChars, searches, outputTokens) {
    var r = rates();
    var inTok = n(promptChars) / 4;
    return inTok / 1e6 * r.inPerM + n(outputTokens) / 1e6 * r.outPerM +
           n(searches) / 1000 * r.searchPer1000;
  }

  function history(limit) { if (!led.since) load(); return led.calls.slice(0, limit || 20); }
  function reset() {
    led = { calls: [], spend: 0, tokensIn: 0, tokensOut: 0, searches: 0, since: Date.now() };
    save();
  }

  function money(x) {
    if (x >= 10) return '$' + x.toFixed(2);
    if (x >= 0.01) return '$' + x.toFixed(3);
    if (x <= 0) return '$0';
    return 'under a cent';
  }

  root.Usage = { load: load, record: record, totals: totals, history: history,
                 reset: reset, priceOf: priceOf, rates: rates, money: money,
                 estimate: estimate, DEFAULT_RATES: DEFAULT_RATES };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Usage;
})(typeof window !== 'undefined' ? window : this);
