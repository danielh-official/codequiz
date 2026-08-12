const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');
const HOOK = path.join(__dirname, '..', 'core', 'hook.js');

// Codex's user-prompt-submit.command.input schema marks all of these required.
// Sending less would not prove the hook survives a real Codex payload.
const CODEX_INPUT = {
  cwd: '/repo',
  hook_event_name: 'UserPromptSubmit',
  model: 'gpt-5',
  permission_mode: 'default',
  prompt: 'fix the parser',
  session_id: 'sess_1',
  transcript_path: null,
  turn_id: 'turn_1',
};

// The output schema sets additionalProperties: false — an unknown key is a
// hard parse failure on the Codex side, not a warning.
const ALLOWED_TOP = new Set([
  'continue', 'decision', 'hookSpecificOutput', 'reason', 'stopReason', 'suppressOutput', 'systemMessage',
]);
const ALLOWED_HSO = new Set(['additionalContext', 'hookEventName']);

const tmpState = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'codequiz-')), 'state.json');

function hook(payload, statePath) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    env: { ...process.env, CODEQUIZ_STATE_PATH: statePath },
    encoding: 'utf8',
  });
  return out ? JSON.parse(out) : {};
}

test('codex payload produces schema-valid output', () => {
  const statePath = tmpState();
  const out = hook(CODEX_INPUT, statePath);

  for (const key of Object.keys(out)) assert.ok(ALLOWED_TOP.has(key), `unexpected top-level key: ${key}`);
  for (const key of Object.keys(out.hookSpecificOutput)) {
    assert.ok(ALLOWED_HSO.has(key), `unexpected hookSpecificOutput key: ${key}`);
  }
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.equal(typeof out.hookSpecificOutput.additionalContext, 'string');
  assert.match(out.hookSpecificOutput.additionalContext, /Repo: \/repo/);

  // Muted turns emit `{}`, which is valid and tells Codex to do nothing.
  hook({ ...CODEX_INPUT, prompt: '/codequiz off' }, statePath);
  assert.deepEqual(hook(CODEX_INPUT, statePath), {});
});

test('installer merges into hooks.json without eating other hooks', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codequiz-home-'));
  const hooksFile = path.join(home, '.codex', 'hooks.json');
  fs.mkdirSync(path.dirname(hooksFile), { recursive: true });
  fs.writeFileSync(
    hooksFile,
    JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: '^Bash$', hooks: [{ type: 'command', command: 'echo mine' }] }],
        UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'echo also-mine' }] }],
      },
    })
  );

  const { installCodex } = require('../bin/cli.js');
  installCodex(home);
  const first = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));

  assert.equal(first.hooks.PreToolUse.length, 1, 'unrelated event survives');
  assert.equal(first.hooks.UserPromptSubmit.length, 2, 'unrelated same-event hook survives');
  const ours = first.hooks.UserPromptSubmit.filter((g) => g.hooks[0].command.includes('codequiz'));
  assert.equal(ours.length, 1);
  assert.match(ours[0].hooks[0].command, /^node \/.*core\/hook\.js$/);

  // Re-install must replace, not stack.
  installCodex(home);
  const second = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
  assert.deepEqual(second, first);

  const agents = fs.readFileSync(path.join(home, '.codex', 'AGENTS.md'), 'utf8');
  assert.equal(agents.match(/<!-- codequiz -->/g).length, 2, 'exactly one fenced block');
  assert.match(agents, /Never leak the answer/);
});

test('installer refuses to clobber unparseable hooks.json', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codequiz-home-'));
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(home, '.codex', 'hooks.json'), '{ broken');

  const { installCodex } = require('../bin/cli.js');
  assert.throws(() => installCodex(home), /not valid JSON/);
  assert.equal(fs.readFileSync(path.join(home, '.codex', 'hooks.json'), 'utf8'), '{ broken');
});

test('cli usage exits non-zero on an unknown host', () => {
  assert.throws(() =>
    execFileSync(process.execPath, [CLI, 'install', 'cursor'], { encoding: 'utf8', stdio: 'pipe' })
  );
});
