const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HOOK = path.join(__dirname, '..', 'adapters', 'claude-code', 'hooks', 'codequiz-nag.js');

// Runs the vendored copies under adapters/, not core/ — the whole point is to
// catch a bad vendoring, which a text comparison in sync.test.js cannot see.
function hook(payload, statePath) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    env: { ...process.env, CODEQUIZ_STATE_PATH: statePath },
    encoding: 'utf8',
  });
  return out ? JSON.parse(out) : {};
}

test('claude code hook: asks, mutes, stays silent on bad input', () => {
  const statePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'codequiz-')), 'state.json');

  const ask = hook({ prompt: 'fix the parser', cwd: '/repo' }, statePath);
  assert.match(ask.hookSpecificOutput.additionalContext, /codequiz is active/);
  assert.match(ask.hookSpecificOutput.additionalContext, /Repo: \/repo/);

  const off = hook({ prompt: '/codequiz off 2h' }, statePath);
  assert.equal(off.systemMessage, 'CODEQUIZ OFF for 2h');

  assert.deepEqual(hook({ prompt: 'anything' }, statePath), {});

  // Never break a prompt, whatever arrives on stdin.
  assert.deepEqual(hook('not json', statePath), {});
});
