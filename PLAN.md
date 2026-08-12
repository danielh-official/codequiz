# codequiz → ambient quizzer, shipped as an installable plugin

## Context

`codequiz` today is a personal skill at `~/.claude/skills/codequiz/SKILL.md` (git repo, one commit `b6d19f5`, no remote). It is on-demand: user asks, Claude emits a 6–10 question multiple-choice or "why" quiz, waits, grades.

Wanted instead: **activate once, then on every prompt in any repo Claude appends one open-ended question** — code or product — that the user can answer, ignore, or mute for N prompts / N time.

Two things follow:

1. A skill alone can't do per-prompt behavior — skills load only when invoked. Per-prompt injection needs a `UserPromptSubmit` hook.
2. Hooks ship the official way via a **plugin** (`.claude-plugin/plugin.json` + `hooks/hooks.json`), installable through a marketplace — exactly how `caveman` and `ponytail` do it (`~/.claude/plugins/marketplaces/ponytail/`). That is the model to copy.

Decisions taken: repo moves to `~/GitHub/codequiz`; hooks in **Node** (matches caveman/ponytail, `commandWindows` variants, zero deps); the old batch MC/`why` quiz is **dropped** — ambient one-question-at-a-time only.

## Target repo layout (`~/GitHub/codequiz`)

```
.claude-plugin/plugin.json       # name, version, description, author
.claude-plugin/marketplace.json  # single plugin, source "./"
hooks/hooks.json                 # UserPromptSubmit → codequiz-nag.js
hooks/codequiz-nag.js            # the ambient nagger + mute controls
hooks/codequiz-runtime.js        # state read/write + hook output helper
commands/codequiz.toml           # /codequiz on|off|status|off <N|2h>
skills/codequiz/SKILL.md         # question style + grading spec
PLAN.md                          # this plan, committed so context survives
README.md, LICENSE
tests/hooks.test.js              # node:test, no framework
```

## Steps

### 1. Move the repo

`git mv`-style move of the whole directory: `mv ~/.claude/skills/codequiz ~/GitHub/codequiz` (preserves `.git`). Leaves nothing behind in `~/.claude/skills/` — important, otherwise the personal skill and the plugin skill would both load.

Then **write this plan to `~/GitHub/codequiz/PLAN.md`** as the first act in the new location, and commit, so the design survives context loss.

### 2. `hooks/codequiz-runtime.js`

State file `~/.claude/.codequiz-state.json`:

```json
{ "enabled": true, "offUntil": 0, "skip": 0, "lastKind": "code" }
```

Exports:
- `readState()` / `writeState(s)` — `writeFileSync` to a `.tmp` then `renameSync`. Any error → return defaults / swallow. The nagger must never break a prompt.
- `parseDuration(arg)` — bare integer = **prompts**; `30m`/`2h`/`1d` = time; returns `{kind:'prompts'|'time', value}` or null.
- `writeHookOutput(context, systemMessage)` — emits `{ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } }` on stdout, plus `systemMessage` for the visible mute confirmations. (ponytail's `hooks/ponytail-runtime.js:writeHookOutput` is the reference shape.)

### 3. `hooks/codequiz-nag.js`

Reads hook JSON on stdin (`prompt`, `cwd`), strips BOM (ponytail hits this), then in order:

1. **Control command** — `/codequiz`, `codequiz`, `/codequiz:codequiz` prefix, or the phrases `stop codequiz` / `quiz me later`:
   - `off 20` → `skip = 20` prompts · `off 2h` → `offUntil = now + Δ` · `off` → `enabled = false` · `on` → clear all · `status` → report remaining mute.
   - Write state, emit a one-line confirmation, exit 0.
2. **Muted** — `!enabled`, or `offUntil > now`, or `skip > 0` (decrement, persist) → exit 0 silent, no output.
3. **Otherwise** — emit `additionalContext` telling Claude to end its response with exactly one open-ended question per the SKILL.md rules, alternating code/product via `lastKind` (flip and persist), and to close with the mute footer: `answer · ignore · /codequiz off 20 · /codequiz off 2h`.

Whole body in try/catch → exit 0 on any throw. `// ponytail:` comments mark the deliberate shortcuts (single JSON state file, no locking — one user, one machine).

### 4. `hooks/hooks.json`

Mirror ponytail's file exactly, one event:

```json
{ "hooks": { "UserPromptSubmit": [ { "hooks": [ {
  "type": "command",
  "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/codequiz-nag.js\"",
  "commandWindows": "node \"%CLAUDE_PLUGIN_ROOT%\\hooks\\codequiz-nag.js\"",
  "timeout": 5,
  "statusMessage": "codequiz..."
} ] } ] } }
```

No `SessionStart` hook — nothing to announce every session; the plugin being installed *is* the activation.

### 5. `skills/codequiz/SKILL.md` (rewrite)

Frontmatter description → ambient quizzer + controls; keep the "not the Readwise `quiz` skill" note.

Rules (replacing the whole `what`/`why` split, letter-shuffle rules, and batch flow):
- Exactly **one** question, appended at the end of the response, after the real work is done.
- Open-ended. No multiple choice, no yes/no.
- Alternate **code** ("why does X do Y instead of Z?", "what breaks if this guard goes?") and **product** ("who is this for?", "what happens when a user does X?"), following the `kind` the hook passes.
- Grounded in files actually read this session; if nothing was read, ask about the repo at product level. Never invent code.
- Never leak the answer in the same message — hold ground truth model-side with `file:line`.
- User ignores it → drop it, never re-ask or nag.
- User answers → grade **Solid / Partial / Off**, one line of ground truth with `file:line`, move on.

Kept from the current file: read-source-first, never-leak-the-key, Solid/Partial/Off grading. Cut: MC mode, correct-letter distribution, 6–10 batching, the flow section.

### 6. `commands/codequiz.toml`

`description` + `prompt` for `/codequiz {{args}}` — mirrors `commands/ponytail.toml`. The hook is what actually applies the mute; the command exists so the slash form is discoverable and so `/codequiz status` reads naturally.

### 7. Install (official path)

```
/plugin marketplace add ~/GitHub/codequiz
/plugin install codequiz@codequiz
```

User scope. Nothing hand-edited in `~/.claude/settings.json` — the plugin registry handles it (`~/.claude/plugins/installed_plugins.json`).

## Verification

1. `node --test tests/hooks.test.js` — duration parser (`20`, `2h`, `90m`, junk) and the mute state machine (counts down, expires, `on` clears).
2. `echo '{"prompt":"hi","cwd":"/tmp"}' | node hooks/codequiz-nag.js` → JSON containing the question instruction.
3. `echo '{"prompt":"/codequiz off 3","cwd":"/tmp"}' | node hooks/codequiz-nag.js` → confirmation; next 3 plain events silent; 4th nags again.
4. `/codequiz off 1m`, wait, confirm silence then resumption.
5. Install, restart, prompt in an unrelated repo (`~/GitHub/site`) → response ends with one open-ended question + mute footer, and the question references code actually read that turn.
6. `/plugin uninstall codequiz@codequiz` → nagging stops cleanly.
