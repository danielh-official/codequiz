const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PLUGIN_HOOK = path.join(__dirname, '..', 'adapters', 'claude-code', 'hooks', 'codequiz-nag.js');
const CORE_HOOK = path.join(__dirname, '..', 'core', 'hook.js');

const tmpState = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'codequiz-')), 'state.json');

function run(script, payload, statePath) {
  const out = execFileSync(process.execPath, [script], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    env: { ...process.env, CODEQUIZ_STATE_PATH: statePath },
    encoding: 'utf8',
  });
  return out ? JSON.parse(out) : {};
}

// Runs the vendored copy under adapters/, not core/ — the point is to catch a
// bad vendoring, which the text comparison in sync.test.js cannot see.
test('claude code entry point: asks, mutes, stays silent on bad input', () => {
  const statePath = tmpState();

  const ask = run(PLUGIN_HOOK, { prompt: 'fix the parser', cwd: '/repo' }, statePath);
  assert.match(ask.hookSpecificOutput.additionalContext, /codequiz is active/);
  assert.match(ask.hookSpecificOutput.additionalContext, /Repo: \/repo/);

  const off = run(PLUGIN_HOOK, { prompt: '/codequiz off 2h' }, statePath);
  assert.equal(off.systemMessage, 'CODEQUIZ OFF for 2h');

  assert.deepEqual(run(PLUGIN_HOOK, { prompt: 'anything' }, statePath), {});

  // Never break a prompt, whatever arrives on stdin.
  assert.deepEqual(run(PLUGIN_HOOK, 'not json', statePath), {});
});

test('both hosts get identical output from the same input', () => {
  const payload = { prompt: 'fix the parser', cwd: '/repo' };
  const viaPlugin = run(PLUGIN_HOOK, payload, tmpState());
  const viaCore = run(CORE_HOOK, payload, tmpState());
  assert.deepEqual(viaPlugin, viaCore);
});
