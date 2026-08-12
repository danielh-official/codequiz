const test = require('node:test');
const assert = require('node:assert');

const { parseDuration, humanRemaining } = require('../hooks/codequiz-runtime');
const { decide } = require('../hooks/codequiz-nag');

const NOW = 1_000_000;
const on = (over = {}) => ({ enabled: true, offUntil: 0, skip: 0, lastKind: 'product', ...over });

test('parseDuration', () => {
  assert.deepEqual(parseDuration('20'), { kind: 'prompts', value: 20 });
  assert.equal(parseDuration('2h').value, 2 * 36e5);
  assert.equal(parseDuration('90m').value, 90 * 6e4);
  assert.equal(parseDuration('30s').value, 30e3);
  assert.equal(parseDuration('1d').value, 864e5);
  assert.equal(parseDuration('0'), null);
  assert.equal(parseDuration('soon'), null);
  assert.equal(parseDuration(undefined), null);
});

test('asks by default, alternating kind', () => {
  const first = decide('fix the parser', on(), NOW, '/repo');
  assert.equal(first.action, 'ask');
  assert.equal(first.state.lastKind, 'code');
  assert.match(first.context, /\*\*code\*\* question/);

  const second = decide('now the tests', first.state, NOW, '/repo');
  assert.equal(second.state.lastKind, 'product');
  assert.match(second.context, /\*\*product\*\* question/);
});

test('instruction carries the clarify-vs-answer triage', () => {
  const ctx = decide('fix the parser', on(), NOW, '/repo').context;
  assert.match(ctx, /clarif/i);
  assert.match(ctx, /re-ask the same question/i);
});

test('never leaks controls into a muted turn', () => {
  assert.equal(decide('anything', on({ enabled: false }), NOW).action, 'muted');
  assert.equal(decide('anything', on({ offUntil: NOW + 1 }), NOW).action, 'muted');
});

test('prompt mute counts down then resumes', () => {
  let s = decide('/codequiz off 2', on(), NOW).state;
  assert.equal(s.skip, 2);

  let r = decide('work', s, NOW);
  assert.equal(r.action, 'muted');
  r = decide('work', r.state, NOW);
  assert.equal(r.action, 'muted');
  assert.equal(r.state.skip, 0);

  assert.equal(decide('work', r.state, NOW).action, 'ask');
});

test('time mute expires', () => {
  const s = decide('/codequiz off 30m', on(), NOW).state;
  assert.equal(s.offUntil, NOW + 30 * 6e4);
  assert.equal(decide('work', s, NOW + 6e4).action, 'muted');
  assert.equal(decide('work', s, NOW + 31 * 6e4).action, 'ask');
});

test('off is indefinite, on clears everything', () => {
  const off = decide('/codequiz off', on(), NOW).state;
  assert.equal(off.enabled, false);
  assert.equal(decide('work', off, NOW + 1e9).action, 'muted');

  const back = decide('/codequiz on', off, NOW).state;
  assert.deepEqual([back.enabled, back.offUntil, back.skip], [true, 0, 0]);
  assert.equal(decide('work', back, NOW).action, 'ask');
});

test('stop phrases mute, status reports without changing state', () => {
  assert.equal(decide('stop codequiz', on(), NOW).state.enabled, false);
  assert.equal(decide('quiz me later please', on(), NOW).state.enabled, false);

  const st = decide('/codequiz status', on({ skip: 3 }), NOW);
  assert.equal(st.action, 'command');
  assert.equal(st.state.skip, 3);
  assert.match(st.message, /3 MORE PROMPT/);
});

test('prose mentioning codequiz is not a command', () => {
  assert.equal(decide('the codequiz hook is broken', on(), NOW).action, 'ask');
  assert.equal(humanRemaining(on(), NOW), 'on');
});
