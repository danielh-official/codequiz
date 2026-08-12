const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { ROOT, targets } = require('../scripts/sync');

test('claude-code adapter matches core/ — run `npm run sync`', () => {
  for (const [file, body] of targets()) {
    assert.equal(fs.readFileSync(file, 'utf8'), body, `${path.relative(ROOT, file)} is stale`);
  }
});
