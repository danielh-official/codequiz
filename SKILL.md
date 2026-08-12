---
name: codequiz
description: Quiz the user on their own codebase/docs/project to check understanding. Two modes — multiple-choice ("what") and reasoning ("why"). Use when the user says "quiz me on the code", "test me on how X works", "/codequiz", or asks to be checked on their own work. (For Readwise reading-comprehension quizzes, use the separate `quiz` skill.)
---

# codequiz

Quiz the user to verify understanding of their own code/project. Read the real source first — never quiz from memory or assumption. Every question and answer must be grounded in code/docs you actually read this session.

## Modes

- **`what` (multiple-choice)** — default. 4 options each, one unambiguously correct. Tests recall of mechanism.
- **`why` (reasoning)** — open-ended. Ask *why* the code is the way it is (design rationale, tradeoff, the failure it avoids). User writes their top-level reasoning; you evaluate against ground truth. Use when the user wants to prove they understand their own decisions, not just recall facts.

Pick from the user's phrasing: "why quiz" / "ask why" / "test my reasoning" → `why`. Otherwise `what`.

## Hard rules (both modes)

1. **Read source first.** Grep/Read the actual implementation before writing any question. Hold `file:line` for every answer.
2. **Never leak the answer key.** Do NOT print correct answers, hints, or rationale in the same message as the questions — the UI autocompletes from buffer text and spoils it. Hold the key model-side. Reveal only after the user submits answers.

## `what` mode rules

3. **Shuffle correct positions.** Randomize which letter is correct per question. Enforce spread: no single letter is correct for more than ~40% of questions (max 2 of 6, 3 of 7-8, 4 of 9-10). Before emitting, tally the correct letter across all questions; if any letter exceeds the cap, reassign that question's correct answer to an under-used letter (move the content, not just relabel — rewrite distractors so the new correct slot still reads naturally) and re-tally. Repeat until compliant. All-B is a broken quiz — pattern alone answers it, no knowledge needed.
4. **Plausible distractors.** Wrong options must be things a real person could believe: a prior approach the code moved away from, a common misconception, an adjacent-but-wrong mechanism. No lazy filler.
5. **One unambiguous correct answer.** No "all of the above", no two-defensible-options.
6. 6–10 questions, ordered easy→hard.

## `why` mode rules

3. Ask *why*, not *what*: "Why does X use Y instead of Z?", "Why is this weighted/guarded/split this way?", "What breaks if you remove this?"
4. Target the non-obvious decisions — the guards, the workarounds, the "old way was slow" comments, the delimiter/identity choices. Skip trivia the answer key would make obvious.
5. Each question has a ground-truth rationale you hold model-side (with `file:line`). User answers in prose.
6. 5–8 questions.

## Grading (only after the user submits)

- `what`: score X/N. For each miss: correct letter + one-line why + `file:line`.
- `why`: rate each answer **Solid / Partial / Off**. State what they got, what they missed, and the ground-truth rationale with `file:line`. Honest — partial credit only for genuinely partial reasoning.
- End with one line naming the weakest spot to revisit.

## Flow

1. Confirm topic + mode (default `what`).
2. Read the relevant source.
3. (`what` mode only) Tally correct-letter distribution against the cap in rule 3 above; fix before continuing.
4. Emit questions ONLY — no key.
5. Wait for answers.
6. Grade against the held key.
