---
name: codequiz
description: Ambient understanding check — one open-ended code or product question appended to each response, about the repo the user is actually in. Governs how that question is written and graded, and handles /codequiz on|off|status. Use when the codequiz hook injects its instruction, when the user answers such a question, or when they say "quiz me on this code" / "/codequiz". (For Readwise reading-comprehension quizzes, use the separate `quiz` skill.)
---

# codequiz

Check that the user understands their own project — one question at a time, in the flow of normal work. The host tells you which kind to ask (`code` or `product`, alternating): on Claude Code a `UserPromptSubmit` hook injects the ask on every prompt; on every other host you call the `codequiz_next` MCP tool and it returns the same ask.

## The question

Exactly **one**, appended at the very end of the response, after the real work is finished and reported. Never in place of the work, never in the middle of it.

- **Open-ended.** No multiple choice, no yes/no. The user writes prose.
- **Code question:** why the code is the way it is — the tradeoff, the guard, the workaround, the thing that breaks if it goes. Not trivia, not "what does this function return".
- **Product question:** who a feature is for, what a user does when it fails, what was deliberately not built, how you'd know it's working.
- **Grounded.** Base it on source you actually read this session, and hold the ground truth with `file:line` model-side. Read no source this turn? Ask at the product level instead of inventing code.
- **Never leak the answer.** No answer, hint, or rationale in the same message as the question — the UI autocompletes from buffer text and spoils it.
- Set it off with a `---` rule, then the question, then the controls footer.

## Answering

The ask fires every turn, so it cannot tell whether the open question was answered. You can. Classify the prompt first, then act:

- **Answered** — grade **Solid / Partial / Off** in one line: what they got, what they missed, ground truth with `file:line`. Honest — partial credit only for genuinely partial reasoning. Then continue with whatever they asked for, and ask a new question.
- **Clarifying** — they're asking what the question means, which code it points at, or whether an assumption holds. Answer that, then **re-ask the same question, rewritten to be clearer**: narrower scope, the file or function named, the shape of answer you want. Still no answer, hint, or rationale. Keep its original kind; ignore the kind named this turn. This is the only case where re-asking is right.
- **Ignored** — the user moves on to other work: drop it. No "you didn't answer", no nagging. Ask a new one.

## Controls

| Command | Effect |
|---|---|
| `/codequiz off 20` | Silent for the next 20 prompts |
| `/codequiz off 2h` | Silent for 2 hours (`30s`/`45m`/`2h`/`1d`) |
| `/codequiz off` | Silent indefinitely |
| `/codequiz on` | Resume |
| `/codequiz status` | Report remaining mute |

`stop codequiz` and `quiz me later` also mute indefinitely.

On Claude Code the hook applies these before you see the prompt — just acknowledge in one line. On other hosts, pass the command through to `codequiz_next` and report what it returns.

Mute state is shared across every host: `~/.codequiz-state.json`, override with `CODEQUIZ_STATE_PATH`.
