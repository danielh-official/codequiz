# codequiz

Ambient understanding check for your own code. Install once; from then on, every response ends with **one open-ended question** — code or product, alternating — about what you're actually working on.

I built this because I wanted to make sure I understand the technology and concepts I was working with while still employing an agent in my workflow.

## Example Question

```
---
Why does the mute state get written with a temp file and a rename instead of a plain write?

answer it · ignore it · `/codequiz off 20` (prompts) · `/codequiz off 2h` (time) · `/codequiz off` · `/codequiz on`
```

## Install

Both hosts use a `UserPromptSubmit` hook, so the question is guaranteed — it fires whether or not the model feels like cooperating.

**Claude Code**

```
/plugin marketplace add danielh-official/codequiz
/plugin install codequiz@codequiz
```

**Codex**

```
git clone https://github.com/danielh-official/codequiz
cd codequiz
node bin/cli.js install codex
```

Writes `~/.codex/hooks.json` (merging with any hooks already there) and appends the question rules to `~/.codex/AGENTS.md`. Codex asks you to trust the new hook the first time it fires.

No npm package, no MCP server, no dependencies — Node stdlib only.

### Why only these two

The whole thing rests on a **push** injection point: something that fires on every prompt without the model choosing to invoke it. Claude Code and Codex both expose one, with a byte-compatible contract — same `hooks.json` shape, same `hookSpecificOutput.additionalContext` output. `core/hook.js` serves both unchanged.

Cursor has hooks but no per-prompt injection: `beforeSubmitPrompt` can block a prompt, not add to it. A pull-based fallback — asking the model to call an MCP tool before it answers — was built and then removed, because a quizzer the model can silently skip is worse than no quizzer.

## Controls

| Command | Effect |
|---|---|
| `/codequiz off 20` | Silent for the next 20 prompts |
| `/codequiz off 2h` | Silent for 2 hours — `30s` `45m` `2h` `1d` |
| `/codequiz off` | Silent indefinitely |
| `/codequiz on` | Resume |
| `/codequiz status` | Remaining mute |

`stop codequiz` and `quiz me later` also mute indefinitely.

On Claude Code these are a real slash command. On Codex the hook reads them straight out of your prompt text — if Codex intercepts the leading `/`, type `codequiz off 2h` without it, or use `stop codequiz`.

Mute state is shared: mute in Claude Code and Codex goes quiet too.

## Updating

- **Claude Code:** `/plugin marketplace update codequiz`. Nothing auto-pulls.
- **Codex:** `git pull` in the clone. The hook runs from there, so that's the whole update.

## How it works

```
core/
  decide.js      the whole decision, pure: (prompt, state, now, cwd) -> action
  state.js       shared mute state
  hook.js        the UserPromptSubmit shim both hosts run
  rules.md       how a question is written and graded
adapters/
  claude-code/   plugin manifest, hooks.json, skill, vendored copy of core/
  codex/         reference hooks.json + generated AGENTS.md snippet
bin/cli.js       node bin/cli.js install codex
scripts/sync.js  regenerates everything derived from core/
```

`core/decide.js` holds the entire decision — mute parsing, code/product alternation, the instruction text — as one pure function with no I/O and no clock, which is why it can be tested against a fake `now`.

`core/hook.js` is the only part that knows a wire format, and it is the same format on both hosts.

The Claude Code plugin carries **generated copies** of `core/` and of `SKILL.md`, because org sync packages `adapters/claude-code/` on its own and it cannot require its way up to the repo root. Codex has no skill mechanism, so its rules go into `AGENTS.md` instead. All three derived files come from `npm run sync`, and `npm test` fails if they drift. Edit `core/`, never the copies.

State: `~/.codequiz-state.json` (override with `CODEQUIZ_STATE_PATH`).

Every failure path in the hook exits silently — both hosts block the prompt on it, so a broken quizzer must never cost you a turn.

```
npm test
```

## License

MIT — see [LICENSE](LICENSE).
