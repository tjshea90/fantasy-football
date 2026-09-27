/* test_checkpoint.js — the resume/checkpoint system itself (Tj, 2026-09-27:
 * "the Claude resume checkpoint system completely failed. Most of these tasks
 * are already completed in a prior Claude session. The checkpoint system is
 * important and I must be able to resume Claude work without losing data or
 * wasting usage").
 *
 * What failed: the session that took the 2026-09-27 request pushed "ckpt 52"
 * at 17:21Z, then worked ~9 more minutes and hit the usage cap. Nothing after
 * 17:21 reached GitHub — autosave saves FILES, and an analysis that has not
 * edited a file yet has none. The next account started cold and paid for the
 * whole analysis again.
 *
 * Drives the REAL scripts (autosave.sh, push.sh, secretscan.sh, sessionlog.py,
 * note.sh, resume.sh) in a scratch clone whose "GitHub" is a local bare repo,
 * with a fake session transcript in Claude Code's JSONL shape. Nothing here
 * touches this repo or the network.
 *
 * CKPT_TOOLS_FROM=<dir> runs it against other copies of the scripts (that is
 * how it was confirmed to fail on the pre-fix ones).
 */
'use strict';
var fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
var fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }

var REPO = path.join(__dirname, '..');
var FROM = process.env.CKPT_TOOLS_FROM || path.join(REPO, 'tools');
var TOOLS = ['autosave.sh', 'push.sh', 'secretscan.sh', 'sessionlog.py', 'note.sh', 'resume.sh'];
var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ckpt-test-'));
var ENV = Object.assign({}, process.env, {
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_NOSYSTEM: '1', HOME: TMP
});

function run(cmd, args, o) {
  o = o || {};
  var r = cp.spawnSync(cmd, args, { cwd: o.cwd, input: o.input === undefined ? '' : o.input,
                                     env: ENV, encoding: 'utf8', timeout: 120000 });
  return { code: r.status, out: (r.stdout || ''), err: (r.stderr || '') };
}
function git(dir) { return run('git', Array.prototype.slice.call(arguments, 1), { cwd: dir }).out.trim(); }
function sh(dir, script, input, args) { return run('bash', [path.join(dir, 'tools', script)].concat(args || []), { cwd: dir, input: input }); }

/* ---- a scratch "GitHub" and a clone of it -------------------------------- */
var BARE = path.join(TMP, 'origin.git'), W = path.join(TMP, 'work');
run('git', ['init', '-q', '--bare', '-b', 'main', BARE]);
run('git', ['clone', '-q', BARE, W]);
git(W, 'checkout', '-q', '-b', 'main');
fs.mkdirSync(path.join(W, 'tools'));
TOOLS.forEach(function (t) {
  var src = path.join(FROM, t);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(W, 'tools', t));
});
/* resume.sh ends by running bootstrap.sh; the real one checks this repo's
   manifest, which a scratch repo does not have */
fs.writeFileSync(path.join(W, 'bootstrap.sh'), 'echo "== bootstrap stub =="\n');
fs.writeFileSync(path.join(W, 'app.txt'), 'v1\n');
git(W, 'add', '-A'); git(W, 'commit', '-qm', 'ckpt 1: start');
git(W, 'push', '-q', 'origin', 'main');
git(W, 'checkout', '-q', '-b', 'claude/session-a');
git(W, 'push', '-q', '-u', 'origin', 'claude/session-a');

/* a transcript in Claude Code's own shape */
var TR = path.join(TMP, 'transcript.jsonl');
function iso(offsetMin) { return new Date(Date.now() + (offsetMin || 0) * 60000).toISOString(); }
function addTurn(text, tool, input, offsetMin) {
  var content = [];
  if (text) content.push({ type: 'text', text: text });
  content.push({ type: 'thinking', thinking: 'PRIVATE REASONING MUST NOT BE COPIED' });
  if (tool) content.push({ type: 'tool_use', name: tool, input: input || {} });
  fs.appendFileSync(TR, JSON.stringify({ type: 'assistant', isSidechain: false, timestamp: iso(offsetMin),
    message: { role: 'assistant', content: content } }) + '\n');
  fs.appendFileSync(TR, JSON.stringify({ type: 'user', timestamp: iso(offsetMin),
    message: { role: 'user', content: [{ type: 'tool_result', content: 'file body' }] } }) + '\n');
}
function hook(event, sid, tool) {
  return JSON.stringify({ session_id: sid || 'aaaa1111-session', transcript_path: TR,
                          hook_event_name: event, tool_name: tool || 'Read', cwd: W });
}
function remote(ref, file) {
  var r = run('git', ['--git-dir', BARE, 'show', ref + ':' + file]);
  return r.code === 0 ? r.out : null;
}
function parse(out) { try { return JSON.parse(out.trim().split('\n').pop()); } catch (e) { return null; } }

/* ============ 1. a session that only READS still leaves its findings ======= */
console.log('\n-- 1. read-only analysis reaches GitHub (the 2026-09-27 failure) --');
addTurn('Found the cause: setSlot marks only one slot manual, so autoFillWeek re-picks the rest on boot.',
        'Read', { file_path: path.join(W, 'app/assets/store.js') });
var r1 = sh(W, 'autosave.sh', hook('PostToolUse'));
ok(r1.code === 0, 'autosave exits 0');
var log = fs.existsSync(path.join(W, 'SESSIONLOG.md')) ? fs.readFileSync(path.join(W, 'SESSIONLOG.md'), 'utf8') : '';
ok(/Found the cause: setSlot marks only one slot manual/.test(log),
   'SESSIONLOG.md holds what the session SAID it found  <-- autosave saved files only, so this died with the cap');
ok(/Read app\/assets\/store\.js/.test(log), 'and which files it read');
ok(!/PRIVATE REASONING/.test(log), 'thinking is never copied (public repo)');
var onBranch = remote('refs/heads/claude/session-a', 'SESSIONLOG.md');
ok(onBranch && /Found the cause/.test(onBranch), 'it is committed and pushed to the session\'s branch');
var onMain = remote('refs/heads/main', 'SESSIONLOG.md');
ok(onMain && /Found the cause/.test(onMain),
   'AND to main, where the next session starts  <-- autosave never moved main; new sessions never saw it');

/* ============ 2. redaction ================================================== */
console.log('\n-- 2. credentials and emails never reach the public log --');
var KEY = 'sk-ant-api03-' + 'Ab9_'.repeat(20);
addTurn('Testing with key ' + KEY + ' for someone@example.com', 'Bash', { description: 'try the key' }, 0.1);
var r2 = sh(W, 'autosave.sh', hook('Stop'));
log = fs.readFileSync(path.join(W, 'SESSIONLOG.md'), 'utf8');
ok(log.indexOf(KEY) < 0 && /\[redacted\]/.test(log), 'the key is redacted');
ok(!/someone@example\.com/.test(log) && /\[email\]/.test(log), 'the email is redacted');
ok(!/AUTOSAVE BLOCKED/.test(r2.out) && /\[redacted\]/.test(remote('refs/heads/main', 'SESSIONLOG.md') || ''),
   'so the secret scan never trips on the log and the save still lands');

/* ============ 3. the throttle ============================================== */
console.log('\n-- 3. the log costs nothing per tool call --');
var head0 = git(W, 'rev-parse', 'HEAD');
addTurn('A newer message inside the throttle window.', 'Grep', { pattern: 'applyAuto' }, 0.2);
sh(W, 'autosave.sh', hook('PostToolUse'));
ok(git(W, 'rev-parse', 'HEAD') === head0, 'a PostToolUse inside 60s does not rewrite or commit the log');
sh(W, 'autosave.sh', hook('Stop'));
ok(/A newer message inside the throttle window/.test(remote('refs/heads/main', 'SESSIONLOG.md') || ''),
   'Stop always writes it (the last chance before the session ends)');
var t0 = Date.now(); for (var q = 0; q < 5; q++) sh(W, 'autosave.sh', hook('PostToolUse'));
var per = (Date.now() - t0) / 5;
ok(per < 1500, 'a quiet tool call costs ' + Math.round(per) + ' ms');

/* ============ 4. the nudge =================================================== */
console.log('\n-- 4. a long research run is told to save a note --');
var nudged = [], i, rr;
for (i = 1; i <= 14; i++) {
  rr = sh(W, 'autosave.sh', hook('PostToolUse', 'bbbb2222-session', 'Grep'));
  var j = parse(rr.out);
  if (j && j.hookSpecificOutput && /CHECKPOINT NUDGE/.test(j.hookSpecificOutput.additionalContext || '')) nudged.push(i);
}
/* a session's first call sets the baseline; 12 quiet calls after it = one nudge */
ok(nudged.length === 1 && nudged[0] === 13, 'exactly one nudge, after 12 quiet calls (call ' + nudged.join(',') + ')');
j = parse(rr.out);
ok(!j || !j.hookSpecificOutput || j.hookSpecificOutput.hookEventName === 'PostToolUse',
   'delivered as PostToolUse additionalContext (the documented channel to Claude)');
var other = sh(W, 'autosave.sh', hook('PostToolUse', 'cccc3333-session', 'Grep'));
ok(!/NUDGE/.test(other.out), 'counted per session — another session\'s calls do not add up');
fs.writeFileSync(path.join(W, 'app.txt'), 'v2\n');
sh(W, 'autosave.sh', hook('PostToolUse', 'bbbb2222-session', 'Edit'));
var after = [];
for (i = 1; i <= 11; i++) {
  rr = sh(W, 'autosave.sh', hook('PostToolUse', 'bbbb2222-session', 'Read'));
  if (/NUDGE/.test(rr.out)) after.push(i);
}
ok(after.length === 0, 'a real edit resets the count');
var stopOut = sh(W, 'autosave.sh', hook('Stop', 'bbbb2222-session'));
var sj = parse(stopOut.out);
ok(!sj || !sj.hookSpecificOutput, 'no additionalContext on Stop (not valid there)');

/* ============ 5. main fast-forwards; a diverged main is left alone ========= */
console.log('\n-- 5. every save moves main — but never over someone else\'s work --');
fs.writeFileSync(path.join(W, 'app.txt'), 'v3\n');
sh(W, 'autosave.sh', '');
ok(git(W, 'rev-parse', 'HEAD') === run('git', ['--git-dir', BARE, 'rev-parse', 'refs/heads/main']).out.trim(),
   'origin/main == this session\'s HEAD after an autosave');
/* someone else moves main to a commit this branch does not have */
var W2 = path.join(TMP, 'other');
run('git', ['clone', '-q', '-b', 'main', BARE, W2]);
fs.writeFileSync(path.join(W2, 'theirs.txt'), 'x\n');
git(W2, 'add', '-A'); git(W2, 'commit', '-qm', 'their work'); git(W2, 'push', '-q', 'origin', 'main');
var theirMain = git(W2, 'rev-parse', 'HEAD');
fs.writeFileSync(path.join(W, 'app.txt'), 'v4\n');
var r5 = sh(W, 'autosave.sh', '');
ok(run('git', ['--git-dir', BARE, 'rev-parse', 'refs/heads/main']).out.trim() === theirMain,
   'a diverged main is NOT overwritten (fast-forward only)');
ok(remote('refs/heads/claude/session-a', 'app.txt') === 'v4\n', 'the session\'s own branch still got the save');
ok(!/FAILING/.test(r5.out), 'and that is not reported as a failed push');

/* ============ 6. worktrees ================================================ */
console.log('\n-- 6. edits made in a git worktree are saved too --');
var WT = path.join(TMP, 'wt');
git(W, 'worktree', 'add', '-q', '-b', 'claude/subagent-wt', WT);
fs.writeFileSync(path.join(WT, 'from-worktree.txt'), 'subagent edit\n');
sh(W, 'autosave.sh', '');
ok(remote('refs/heads/claude/subagent-wt', 'from-worktree.txt') === 'subagent edit\n',
   'a worktree\'s edit is committed and pushed to its own branch  <-- autosave only ever looked at one checkout');

/* ============ 7. note.sh =================================================== */
console.log('\n-- 7. one line saves a finding --');
var r7 = sh(W, 'note.sh', '', ['cause: applyAuto empties a slot whose pick is already held']);
ok(r7.code === 0 && /noted \+ pushed/.test(r7.out), 'note.sh says it reached GitHub: ' + r7.out.trim());
ok(/cause: applyAuto empties a slot/.test(remote('refs/heads/claude/session-a', 'WORKLOG.md') || ''),
   'WORKLOG.md carries the line on GitHub');

/* ============ 8. a failed push is still loud ================================= */
console.log('\n-- 8. a failed push is still said out loud --');
git(W, 'remote', 'set-url', 'origin', path.join(TMP, 'nowhere.git'));
fs.writeFileSync(path.join(W, 'app.txt'), 'v5\n');
var r8 = sh(W, 'autosave.sh', hook('PostToolUse'));
var j8 = parse(r8.out);
ok(j8 && /PUSH TO GITHUB IS FAILING/.test(j8.systemMessage || ''), 'systemMessage: PUSH TO GITHUB IS FAILING');
git(W, 'remote', 'set-url', 'origin', BARE);
sh(W, 'autosave.sh', '');

/* ============ 9. resume.sh ================================================= */
console.log('\n-- 9. the next session is told what it needs, and nothing it does not --');
function resumeText(dir) {
  var r = run('bash', [path.join(dir, 'tools', 'resume.sh')], { cwd: dir });
  var j = parse(r.out);
  return (j && j.hookSpecificOutput) ? j.hookSpecificOutput.additionalContext : r.out;
}
/* a fresh session B, starting from main the way the platform starts one */
var B = path.join(TMP, 'sessionB');
run('git', ['clone', '-q', BARE, B]);
git(B, 'checkout', '-q', '-B', 'claude/session-b', 'origin/main');
var rb = resumeText(B);
ok(/OTHER BRANCHES CARRY RECENT COMMITS/.test(rb) && /claude\/session-a/.test(rb) && /claude\/subagent-wt/.test(rb),
   'stranded branches are named (session-a\'s saves past the diverged main, the worktree branch)');

/* inbox-only commits after a ckpt are not "interrupted" */
var C = path.join(TMP, 'sessionC');
run('git', ['clone', '-q', BARE, C]);
git(C, 'checkout', '-q', '-B', 'main', 'origin/main');
fs.writeFileSync(path.join(C, 'CHECKPOINT.md'), 'x\n');
git(C, 'add', '-A'); git(C, 'commit', '-qm', 'ckpt 2: clean stop');
fs.writeFileSync(path.join(C, 'INBOX.md'), '## msg\n');
git(C, 'add', '-A'); git(C, 'commit', '-qm', 'auto-checkpoint: inbox');
git(C, 'push', '-q', 'origin', 'HEAD:refs/heads/main', '--force');
var rc = resumeText(C);
ok(!/INTERRUPTED MID-CHANGE/.test(rc), 'an inbox-only commit after the ckpt is not "INTERRUPTED MID-CHANGE"  <-- it was');
fs.writeFileSync(path.join(C, 'app.txt'), 'half-written\n');
git(C, 'add', '-A'); git(C, 'commit', '-qm', 'auto-checkpoint: edit');
ok(/INTERRUPTED MID-CHANGE/.test(resumeText(C)), 'a real file change after the ckpt still is');
git(C, 'reset', '-q', '--hard', 'HEAD~1');

/* SESSIONLOG: warn only when the session kept calling tools after its ckpt */
function logWith(lastToolMin) {
  return '# SESSIONLOG\n\n## session dddd4444 · branch claude/x · log from ' + iso(-30) +
         ' · last tool ' + iso(lastToolMin) + ' · updated ' + iso(lastToolMin + 1).replace(/\.\d+Z$/, 'Z') +
         '\n\nClaude\'s messages, oldest first:\n\n- [17:25] Found it: the DEF tier is paid from the live score.\n\n' +
         'Last 1 tool calls: 17:25 Read app/assets/espn.js\n';
}
fs.writeFileSync(path.join(C, 'SESSIONLOG.md'), logWith(15));
var cut = resumeText(C);
ok(/KEPT WORKING AFTER ITS LAST CHECKPOINT/.test(cut) && /Found it: the DEF tier/.test(cut),
   'a session that kept working after its ckpt: its own words are in the briefing');
fs.writeFileSync(path.join(C, 'SESSIONLOG.md'), logWith(-5));
var clean = resumeText(C);
ok(!/KEPT WORKING/.test(clean) && !/Found it: the DEF tier/.test(clean),
   'a session that checkpointed after its last tool call costs the briefing one line, not the log');
fs.writeFileSync(path.join(C, 'WORKLOG.md'), '# WORKLOG\n\n- 2026-09-27T17:25Z · b — cause: DEF tier live\n');
ok(/WORKLOG\.md tail/.test(resumeText(C)) && /cause: DEF tier live/.test(resumeText(C)), 'WORKLOG.md findings are in the briefing');

/* ============ 10. the hooks are wired ====================================== */
console.log('\n-- 10. .claude/settings.json --');
var S = JSON.parse(fs.readFileSync(path.join(REPO, '.claude/settings.json'), 'utf8')).hooks;
var ptu = (S.PostToolUse || []).filter(function (h) { return /autosave\.sh/.test(JSON.stringify(h)); })[0];
ok(ptu && (ptu.matcher === '*' || ptu.matcher === ''),
   'autosave runs after EVERY tool, reads included (matcher "' + (ptu && ptu.matcher) + '")  <-- was Edit|Write|NotebookEdit|Bash');
ok(/autosave\.sh/.test(JSON.stringify(S.Stop || [])) && /autosave\.sh/.test(JSON.stringify(S.SessionEnd || [])),
   'and on Stop and SessionEnd');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { }
console.log(fails ? ('\n  ' + fails + ' checkpoint check(s) FAILED') : '\n  checkpoint checks pass');
process.exit(fails ? 1 : 0);
