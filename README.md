# codequiz

Ambient understanding check for your own code. Install once; from then on, every response in every repo ends with **one open-ended question** — code or product, alternating — about what you're actually working on.

No quiz sessions, no multiple choice, no scores. Answer it and get graded in one line. Ignore it and it disappears.

```
---
Why does the mute state get written with a temp file and a rename instead of a plain write?

answer it · ignore it · `/codequiz off 20` (prompts) · `/codequiz off 2h` (time) · `/codequiz off` · `/codequiz on`
```

## Install

```
/plugin marketplace add danielh-official/codequiz
/plugin install codequiz@codequiz
```

Local development: `/plugin marketplace add ~/GitHub/codequiz` instead of the first line.

## Controls

| Command | Effect |
|---|---|
| `/codequiz off 20` | Silent for the next 20 prompts |
| `/codequiz off 2h` | Silent for 2 hours — `30s` `45m` `2h` `1d` |
| `/codequiz off` | Silent indefinitely |
| `/codequiz on` | Resume |
| `/codequiz status` | Remaining mute |

`stop codequiz` and `quiz me later` also mute indefinitely.

## How it works

- `hooks/hooks.json` registers a `UserPromptSubmit` hook.
- `hooks/codequiz-nag.js` parses the mute commands out of your prompt, tracks state, and otherwise injects the ask-a-question instruction.
- `skills/codequiz/SKILL.md` governs how the question is written and how your answer is graded.
- State: `~/.claude/.codequiz-state.json` (override with `CODEQUIZ_STATE_PATH`).

Node stdlib only, no dependencies. Every failure path in the hook exits silently — it can never block a prompt.

```
node --test tests/hooks.test.js
```

## License

MIT — see [LICENSE](LICENSE).
