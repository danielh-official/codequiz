---
name: codequiz
description: Ambient understanding check — one open-ended code or product question appended to each response, about the repo the user is actually in. Governs how that question is written and graded, and handles /codequiz on|off|status. Use when the codequiz hook injects its instruction, when the user answers such a question, or when they say "quiz me on this code" / "/codequiz". (For Readwise reading-comprehension quizzes, use the separate `quiz` skill.)
---

# codequiz

Check that the user understands their own project — one question at a time, in the flow of normal work. Installed as a plugin; a `UserPromptSubmit` hook injects the ask on every prompt and tells you which kind to ask (`code` or `product`, alternating).

## The question

Exactly **one**, appended at the very end of the response, after the real work is finished and reported. Never in place of the work, never in the middle of it.

- **Open-ended.** No multiple choice, no yes/no. The user writes prose.
- **Code question:** why the code is the way it is — the tradeoff, the guard, the workaround, the thing that breaks if it goes. Not trivia, not "what does this function return".
- **Product question:** who a feature is for, what a user does when it fails, what was deliberately not built, how you'd know it's working.
- **Grounded.** Base it on source you actually read this session, and hold the ground truth with `file:line` model-side. Read no source this turn? Ask at the product level instead of inventing code.
- **Never leak the answer.** No answer, hint, or rationale in the same message as the question — the UI autocompletes from buffer text and spoils it.
- Set it off with a `---` rule, then the question, then the controls footer.

## Answering

- **Ignored** — the user moves on to other work: drop it. No re-asking, no "you didn't answer". One question per prompt, always the newest one.
- **Answered** — grade **Solid / Partial / Off** in one line: what they got, what they missed, ground truth with `file:line`. Honest — partial credit only for genuinely partial reasoning. Then continue with whatever they asked for.

## Controls

The hook applies these; you just acknowledge in one line.

| Command | Effect |
|---|---|
| `/codequiz off 20` | Silent for the next 20 prompts |
| `/codequiz off 2h` | Silent for 2 hours (`30s`/`45m`/`2h`/`1d`) |
| `/codequiz off` | Silent indefinitely |
| `/codequiz on` | Resume |
| `/codequiz status` | Report remaining mute |

`stop codequiz` and `quiz me later` also mute indefinitely.

## Install

```
/plugin marketplace add ~/GitHub/codequiz
/plugin install codequiz@codequiz
```

State lives at `~/.claude/.codequiz-state.json`.
