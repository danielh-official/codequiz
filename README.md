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

| Host | Install | Fidelity |
|---|---|---|
| **Claude Code** | `/plugin marketplace add danielh-official/codequiz`<br>`/plugin install codequiz@codequiz` | **Guaranteed** — a hook fires every prompt |
| **Codex** | `npx codequiz install codex` | Best effort |
| **Cursor** | `npx codequiz install cursor` (run in the project) | Best effort, per-project |
| **Any MCP host** | `npx codequiz install mcp` | Best effort |

Local development on the Claude Code plugin: `/plugin marketplace add ~/GitHub/codequiz`.

### Guaranteed vs best effort

Claude Code has a `UserPromptSubmit` hook — a **push** injection point that fires whether or not the model cooperates. No other host has one. Everywhere else the question is **pull**: an `AGENTS.md` line asks the model to call the `codequiz_next` MCP tool before it ends a turn, and sometimes it won't. Same logic, same questions, fewer of them.

Cursor is the weakest of the three: its rule files are per-project, so `install cursor` covers one repo. For every repo, paste `adapters/agents-snippet.md` into Cursor Settings → Rules by hand.

## Controls

| Command | Effect |
|---|---|
| `/codequiz off 20` | Silent for the next 20 prompts |
| `/codequiz off 2h` | Silent for 2 hours — `30s` `45m` `2h` `1d` |
| `/codequiz off` | Silent indefinitely |
| `/codequiz on` | Resume |
| `/codequiz status` | Remaining mute |

`stop codequiz` and `quiz me later` also mute indefinitely.

Mute state is shared across every host — mute in Claude Code and Codex goes quiet too.

## Updating

Static files are pinned; refresh them deliberately.

- **Claude Code:** `/plugin marketplace update codequiz`. Nothing auto-pulls.
- **Codex / Cursor / MCP:** the MCP entry runs `npx -y codequiz@latest mcp`, so the server updates itself. Re-run `npx codequiz install <host>` to refresh the prompt and rule files.

## How it works

```
core/          decide.js (pure), state.js, rules.md — no host knowledge
mcp/server.js  MCP adapter: codequiz_next tool + codequiz prompt
bin/cli.js     npx codequiz install <host> | npx codequiz mcp
adapters/      claude-code (hook, command, skill), codex, cursor
scripts/sync.js  regenerates the claude-code adapter's copies of core/
```

`core/decide.js` holds the whole decision — mute parsing, code/product alternation, the instruction text — as one pure function of `(prompt, state, now, cwd)`. Every adapter is a translator around it: the Claude Code hook converts stdin JSON to and from Claude Code's shapes, the MCP server converts tool arguments to and from MCP's. Neither contains a copy of the logic.

`core/rules.md` is the single source for how a question is written and graded. The MCP server ships that text inline with each ask, because no other host has a skill mechanism.

The Claude Code plugin has to be self-contained — org sync packages `adapters/claude-code/` on its own, so it cannot require its way up to `core/`. It carries generated copies instead: `npm run sync` rebuilds `SKILL.md` and `adapters/claude-code/core/` from `core/`, and `npm test` fails if they drift. Edit `core/`, never the copies.

State: `~/.codequiz-state.json` (override with `CODEQUIZ_STATE_PATH`).

The Claude Code path has no dependencies and every failure exits silently — it can never block a prompt. The MCP server depends on `@modelcontextprotocol/sdk`.

```
npm test
```

## License

MIT — see [LICENSE](LICENSE).
