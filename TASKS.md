# TASKS — the 2026-09-14d request, in Tj's words

> "Actually can you style it like the following, which came from another
> Claude project? These links work: 'v7.22 is shipped. Run #22 went green,
> the release is published, and it's recorded in BUILDLOG.md. Grab it here:
> https://github.com/tjshea90/Portfolio/releases/tag/v7.22'"

## What this actually requires (checked, not assumed)

The example link is `.../releases/tag/v7.22` — a real **GitHub Release**
(a tagged, published release object with a downloadable asset attached).
That is a different mechanism from what this repo does today: `ship.sh`
commits the versioned APK as a plain file under `releases/` in the repo
tree and pushes it — confirmed earlier this session that this repo has
**zero** GitHub Releases published (the "Releases" section on the repo
homepage read "No releases published"). Just changing the LINK TEXT to
`.../releases/tag/v5.7` without creating that release would 404 — the exact
class of mistake this whole conversation has been fixing. Not doing that
again.

`ship.sh` itself cannot create a GitHub Release: it is a bash script in the
build container, and this session's system prompt is explicit — "You do NOT
have access to the `gh` CLI, `hub` CLI, or direct GitHub API access. Instead,
use the GitHub MCP server tools (prefixed with `mcp__github__`) for ALL
GitHub interactions." So release creation has to be a step the Claude
session takes itself, using its MCP GitHub tools, after `ship.sh` finishes —
not something baked into the shell script.

- [ ] 1. Find the right `mcp__github__` tool(s) for creating a tagged release
      and attaching a binary asset (search the deferred tool list — likely
      candidates: something under `create_release`/`releases`, or
      `push_files` + a separate release-asset upload path). Confirm what is
      actually available before promising this works.
- [ ] 2. Create a real GitHub Release for v5.7 (the version already shipped
      this session) as the first instance, with the APK attached as a
      release asset, so `.../releases/tag/v5.7` actually resolves — prove it
      works before writing it into the standing rule.
- [ ] 3. Update the CLAUDE.md standing rule (`## After every ship`) to
      describe this as an explicit step after `ship.sh`, in a message styled
      like Tj's example (version, what went green, where it's recorded,
      the tag link in a copyable code block) — and say plainly if any part
      of his example (a CI "Run #" reference) doesn't map onto how this
      repo's own checks work, rather than copying wording that would be
      inaccurate here.
- [ ] 4. Confirm the new release link actually downloads on his phone before
      calling this done.

Ticking a box means: written, tested, committed (where code changes), and
verified. **Never tick a box you have not verified.**
