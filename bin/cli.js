#!/usr/bin/env node
// codequiz CLI — installs the Codex hook.
//
// Claude Code is not installable from here: it goes through the plugin
// marketplace, which is a better install than anything this could write.
// Nothing is published to npm; the hook runs out of this clone, so `git pull`
// is the update.

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'core', 'hook.js');
const MARKER = '<!-- codequiz -->';

const touched = [];
const note = (verb, file) => touched.push(`  ${verb} ${file}`);

function writeFile(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existed = fs.existsSync(file);
  if (existed && fs.readFileSync(file, 'utf8') === body) return note('unchanged', file);
  fs.writeFileSync(file, body);
  note(existed ? 'updated' : 'wrote', file);
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
    fs.writeFileSync(file, next);
    return note('updated block in', file);
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sep = existing && !existing.endsWith('\n\n') ? (existing.endsWith('\n') ? '\n' : '\n\n') : '';
  fs.writeFileSync(file, existing + sep + block);
  note(existing ? 'appended to' : 'wrote', file);
}

const isOurs = (group) =>
  (group.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes('codequiz'));

// Merge into whatever is already in hooks.json. Other people's hooks survive;
// only a previous codequiz entry is replaced.
function installCodex(home) {
  const dir = path.join(home, '.codex');
  const file = path.join(dir, 'hooks.json');

  let config = {};
  if (fs.existsSync(file)) {
    try {
      config = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      // Refuse to clobber a file we cannot parse — the user's other hooks live
      // in there and a rewrite would silently drop them.
      throw new Error(`${file} is not valid JSON — fix or move it, then re-run`);
    }
  }

  config.hooks = config.hooks || {};
  const groups = (config.hooks.UserPromptSubmit || []).filter((g) => !isOurs(g));
  groups.push({
    hooks: [
      {
        type: 'command',
        command: `node ${HOOK}`,
        timeout: 5,
        statusMessage: 'codequiz...',
      },
    ],
  });
  config.hooks.UserPromptSubmit = groups;

  writeFile(file, JSON.stringify(config, null, 2) + '\n');
  appendBlock(path.join(dir, 'AGENTS.md'), fs.readFileSync(path.join(ROOT, 'core', 'rules.md'), 'utf8').trim());
}

const USAGE = `codequiz — ambient understanding check

  node bin/cli.js install codex    ~/.codex: hooks.json + AGENTS.md

Claude Code installs through the plugin marketplace instead:
  /plugin marketplace add danielh-official/codequiz
  /plugin install codequiz@codequiz

The hook runs from this clone, so \`git pull\` is the update.
`;

function main(argv, home = os.homedir()) {
  const [cmd, host] = argv;

  if (cmd !== 'install' || (host !== 'codex' && host !== 'claude-code' && host !== 'claude')) {
    console.log(USAGE);
    process.exitCode = cmd ? 1 : 0;
    return;
  }

  if (host !== 'codex') {
    console.log('Claude Code installs through the marketplace:\n');
    console.log('  /plugin marketplace add danielh-official/codequiz');
    console.log('  /plugin install codequiz@codequiz\n');
    return;
  }

  installCodex(home);
  console.log('codequiz installed for codex:');
  console.log(touched.join('\n'));
  console.log('\nRestart Codex. It will ask you to trust the new hook the first time it fires.');
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`codequiz: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { appendBlock, installCodex, main, touched };
