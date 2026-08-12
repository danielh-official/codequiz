const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');

// Real spawn, real handshake — the point of this test is interop, so stubbing
// the transport would test nothing.
async function connect(statePath) {
  const client = new Client({ name: 'codequiz-test', version: '0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [CLI, 'mcp'],
      env: { ...process.env, CODEQUIZ_STATE_PATH: statePath },
    })
  );
  return client;
}

const say = (r) => r.content.map((c) => c.text).join('');

test('MCP: asks, then goes quiet when muted', async (t) => {
  const statePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'codequiz-')), 'state.json');
  const client = await connect(statePath);
  t.after(() => client.close());

  const tools = (await client.listTools()).tools.map((x) => x.name);
  assert.deepEqual(tools, ['codequiz_next']);
  assert.deepEqual((await client.listPrompts()).prompts.map((x) => x.name), ['codequiz']);

  const first = say(await client.callTool({ name: 'codequiz_next', arguments: { cwd: '/repo' } }));
  assert.match(first, /codequiz is active/);
  assert.match(first, /\/repo/);
  assert.match(first, /Never leak the answer/); // rules.md shipped inline

  const off = say(await client.callTool({ name: 'codequiz_next', arguments: { command: 'off 2h' } }));
  assert.match(off, /OFF for 2h/);

  const muted = say(await client.callTool({ name: 'codequiz_next', arguments: { cwd: '/repo' } }));
  assert.equal(muted.trim(), '');

  const status = say(await client.callTool({ name: 'codequiz_next', arguments: { command: 'status' } }));
  assert.match(status, /OFF FOR ~2H/);

  // State survives the process, which is what makes the mute cross-host.
  assert.ok(JSON.parse(fs.readFileSync(statePath, 'utf8')).offUntil > Date.now());
});
