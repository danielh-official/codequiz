#!/usr/bin/env node
// codequiz — Claude Code adapter: UserPromptSubmit hook.
// The only host with a push injection point, so this is the only adapter that
// can guarantee a question every turn. All it does is translate Claude Code's
// stdin/stdout shapes to and from core/decide.

// Vendored copies of core/, kept in sync by `npm run sync`. The plugin has to
// be self-contained: Claude Code org sync packages this directory alone, so a
// require reaching up to the repo root would resolve to nothing there.
const { decide } = require('../core/decide');
const { readState, writeState } = require('../core/state');

function writeHookOutput(additionalContext, systemMessage) {
  const out = {};
  if (systemMessage) out.systemMessage = systemMessage;
  if (additionalContext) {
    out.hookSpecificOutput = {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    };
  }
  process.stdout.write(JSON.stringify(out));
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

module.exports = { main, writeHookOutput };
