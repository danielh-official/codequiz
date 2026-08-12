#!/usr/bin/env node
// codequiz CLI — `codequiz mcp` runs the server, `codequiz install <host>`
// writes that host's config. Claude Code is not installable from here: it goes
// through the plugin marketplace, which is a better install than anything this
// could write.

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const AGENTS_SNIPPET = fs.readFileSync(path.join(ROOT, 'adapters', 'agents-snippet.md'), 'utf8').trim();
const MARKER = '<!-- codequiz -->';

const touched = [];
const note = (verb, file) => touched.push(`  ${verb} ${file}`);

function writeFile(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existed = fs.existsSync(file);
  if (existed && fs.readFileSync(file, 'utf8') === body) return note('unchanged', file);
  fs.writeFileSync(file, body);
  note(existed ? 'overwrote' : 'wrote', file);
}

// Append the snippet once, fenced by markers so a re-install replaces the old
// block instead of stacking another copy.
function appendBlock(file, body) {
  const block = `${MARKER}\n${body}\n${MARKER}\n`;
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const fence = new RegExp(`${MARKER}[\\s\\S]*?${MARKER}\\n?`);

  if (fence.test(existing)) {
    const next = existing.replace(fence, block);
    if (next === existing) return note('unchanged', file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, next);
    return note('updated block in', file);
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sep = existing && !existing.endsWith('\n\n') ? (existing.endsWith('\n') ? '\n' : '\n\n') : '';
  fs.writeFileSync(file, existing + sep + block);
  note(existing ? 'appended to' : 'wrote', file);
}

function installCodex() {
  const dir = path.join(os.homedir(), '.codex');
  writeFile(
    path.join(dir, 'prompts', 'codequiz.md'),
    fs.readFileSync(path.join(ROOT, 'adapters', 'codex', 'prompts', 'codequiz.md'), 'utf8')
  );
  appendBlock(path.join(dir, 'AGENTS.md'), AGENTS_SNIPPET);

  const config = path.join(dir, 'config.toml');
  const existing = fs.existsSync(config) ? fs.readFileSync(config, 'utf8') : '';
  if (/^\s*\[mcp_servers\.codequiz\]/m.test(existing)) note('already configured', config);
  else {
    const snippet = fs.readFileSync(path.join(ROOT, 'adapters', 'codex', 'config.snippet.toml'), 'utf8');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config, existing + (existing.endsWith('\n') || !existing ? '' : '\n') + '\n' + snippet);
    note(existing ? 'appended to' : 'wrote', config);
  }
}

// ponytail: project-scoped. Cursor has no file-installable global rule — the
// user pastes into Settings -> Rules for that. Documented in the README.
function installCursor(target) {
  const frontmatter = fs.readFileSync(path.join(ROOT, 'adapters', 'cursor', 'frontmatter.mdc'), 'utf8');
  writeFile(path.join(target, '.cursor', 'rules', 'codequiz.mdc'), `${frontmatter}\n${AGENTS_SNIPPET}\n`);

  const file = path.join(target, '.cursor', 'mcp.json');
  const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  config.mcpServers = config.mcpServers || {};
  config.mcpServers.codequiz = { command: 'npx', args: ['-y', 'codequiz@latest', 'mcp'] };
  writeFile(file, JSON.stringify(config, null, 2) + '\n');
}

// Any other MCP host: we cannot know its config format, so print what it needs.
function installGeneric(target) {
  appendBlock(path.join(target, 'AGENTS.md'), AGENTS_SNIPPET);
  return [
    '',
    'Register this stdio MCP server with your host:',
    '',
    '  command: npx',
    '  args:    ["-y", "codequiz@latest", "mcp"]',
  ].join('\n');
}

const USAGE = `codequiz — ambient understanding check

  codequiz install codex     ~/.codex: prompt, AGENTS.md, config.toml
  codequiz install cursor    ./.cursor: rule + mcp.json (project-scoped)
  codequiz install mcp       ./AGENTS.md + the stdio command to register
  codequiz mcp               run the MCP server (what host configs invoke)

Claude Code installs through the plugin marketplace instead:
  /plugin marketplace add danielh-official/codequiz
  /plugin install codequiz@codequiz
`;

function main(argv) {
  const [cmd, host] = argv;

  if (cmd === 'mcp') return require('../mcp/server.js').main();

  if (cmd !== 'install') {
    console.log(USAGE);
    process.exitCode = cmd ? 1 : 0;
    return;
  }

  const target = process.cwd();
  let extra = '';
  if (host === 'codex') installCodex();
  else if (host === 'cursor') installCursor(target);
  else if (host === 'mcp' || host === 'generic') extra = installGeneric(target);
  else if (host === 'claude-code' || host === 'claude') {
    console.log('Claude Code installs through the marketplace:\n');
    console.log('  /plugin marketplace add danielh-official/codequiz');
    console.log('  /plugin install codequiz@codequiz\n');
    return;
  } else {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  console.log(`codequiz installed for ${host}:`);
  console.log(touched.join('\n'));
  if (extra) console.log(extra);
  console.log('\nRestart the host to pick it up.');
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { appendBlock, main };
