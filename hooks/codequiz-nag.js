#!/usr/bin/env node
// codequiz — UserPromptSubmit hook.
// Every prompt: append one open-ended code-or-product question to the response,
// unless muted. Also parses the mute commands out of the prompt itself.

const {
  humanRemaining,
  parseDuration,
  readState,
  writeHookOutput,
  writeState,
} = require('./codequiz-runtime');

const FOOTER =
  'answer it · ignore it · `/codequiz off 20` (prompts) · `/codequiz off 2h` (time) · `/codequiz off` · `/codequiz on`';

function instructions(kind, cwd) {
  return [
    'codequiz is active. After you finish the actual work in this response, append exactly ONE open-ended question that checks the user understands their own project.',
    '',
    `- Ask a **${kind}** question this turn.`,
    kind === 'code'
      ? '- Code question: why the code is the way it is — a tradeoff, a guard, a workaround, what breaks if it is removed. Ground it in a file you actually read this session and hold the answer plus `file:line` model-side.'
      : '- Product question: who a feature is for, what a user does when it fails, what is deliberately not built, how you would know it is working. Ground it in this repo.',
    `- Repo: ${cwd || 'unknown'}. If you read no source this turn, ask at the product level instead of inventing code.`,
    '- One question. Open-ended. No multiple choice, no yes/no, no answer or hint in the same message.',
    '- Set it off from the work: a `---` rule, then the question, then this footer verbatim on its own line:',
    `  ${FOOTER}`,
    '- If the user ignores it and moves on, drop it silently. Never re-ask, never nag.',
    '- If the user answers, grade it Solid / Partial / Off in one line with the ground truth and `file:line`, then move on.',
  ].join('\n');
}

// Pure so tests can drive it without stdin or a real clock.
function decide(prompt, state, now, cwd) {
  const text = String(prompt || '').trim();
  const lower = text.toLowerCase();

  const cmd = /^[/@$]?codequiz(?::codequiz)?\s+(on|off|status)\b\s*(\S+)?/i.exec(lower);
  const stopPhrase = /\b(stop codequiz|quiz me later)\b/i.test(lower);

  if (cmd || stopPhrase) {
    const verb = cmd ? cmd[1] : 'off';
    const arg = cmd ? cmd[2] : undefined;
    const next = { ...state };

    if (verb === 'on') {
      next.enabled = true;
      next.offUntil = 0;
      next.skip = 0;
      return { action: 'command', state: next, message: 'CODEQUIZ ON' };
    }
    if (verb === 'status') {
      return { action: 'command', state, message: `CODEQUIZ ${humanRemaining(state, now).toUpperCase()}` };
    }

    const d = arg ? parseDuration(arg) : null;
    if (d && d.kind === 'prompts') {
      next.enabled = true;
      next.offUntil = 0;
      next.skip = d.value;
      return { action: 'command', state: next, message: `CODEQUIZ OFF for ${d.value} prompts` };
    }
    if (d && d.kind === 'time') {
      next.enabled = true;
      next.skip = 0;
      next.offUntil = now + d.value;
      return { action: 'command', state: next, message: `CODEQUIZ OFF for ${d.label}` };
    }
    next.enabled = false;
    next.offUntil = 0;
    next.skip = 0;
    return { action: 'command', state: next, message: 'CODEQUIZ OFF — `/codequiz on` to resume' };
  }

  if (!state.enabled) return { action: 'muted', state };
  if (state.offUntil > now) return { action: 'muted', state };
  if (state.skip > 0) return { action: 'muted', state: { ...state, skip: state.skip - 1 } };

  const kind = state.lastKind === 'code' ? 'product' : 'code';
  return {
    action: 'ask',
    state: { ...state, lastKind: kind },
    context: instructions(kind, cwd),
  };
}

function main(raw) {
  const data = JSON.parse(String(raw).replace(/^﻿/, ''));
  const result = decide(data.prompt, readState(), Date.now(), data.cwd);

  if (result.state) writeState(result.state);
  if (result.action === 'command') writeHookOutput(`codequiz: ${result.message}. Acknowledge in one short line.`, result.message);
  else if (result.action === 'ask') writeHookOutput(result.context);
}

if (require.main === module) {
  let input = '';
  process.stdin.on('data', (c) => { input += c; });
  process.stdin.on('end', () => {
    try {
      main(input);
    } catch (e) {
      // Silent. The nagger must never break a prompt.
    }
  });
}

module.exports = { FOOTER, decide, instructions };
