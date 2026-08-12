#!/usr/bin/env node
// codequiz — MCP adapter. Serves every host that is not Claude Code.
//
// Claude Code pushes: its hook fires whether or not the model cooperates.
// Nothing else has that. Here the model has to *pull* — an AGENTS.md / rules
// line tells it to call codequiz_next before ending a turn, and sometimes it
// won't. Same decide(), lower fidelity, and the README says so.

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const { decide, rules } = require('../core/decide');
const { readState, writeState } = require('../core/state');

const text = (s) => ({ content: [{ type: 'text', text: s }] });

// One entry point for both jobs: a bare call asks for the next question, a
// call carrying `command` runs a mute control. decide() already tells them
// apart by parsing the prompt, so hand it the command as the prompt.
function next({ command, cwd } = {}) {
  // decide() parses controls out of prose, so it wants the `codequiz` prefix.
  // Hosts send the bare verb ("off 2h") or the whole slash command — normalize
  // both to the one shape decide() recognizes.
  const prompt = command
    ? `codequiz ${String(command).replace(/^[/@$]?codequiz(?::codequiz)?\s*/i, '').trim()}`
    : '';
  const result = decide(prompt, readState(), Date.now(), cwd || process.cwd());
  if (result.state) writeState(result.state);

  if (result.action === 'command') return text(`codequiz: ${result.message}`);
  // Muted turns must return nothing quotable — any leftover text reads as an
  // instruction and the model asks a question anyway.
  if (result.action !== 'ask') return text('');
  return text([result.context, '', '---', '', rules()].join('\n'));
}

function createServer() {
  const server = new McpServer({ name: 'codequiz', version: require('../package.json').version });

  server.registerTool(
    'codequiz_next',
    {
      title: 'codequiz: next question',
      description:
        'Call before ending a response. Returns the instruction for one open-ended question about the user\'s own repo, or empty text when muted. Pass `command` to run a control: "off", "off 20", "off 2h", "on", "status".',
      inputSchema: {
        command: z.string().optional().describe('Mute control: off | off <N> | off <2h> | on | status'),
        cwd: z.string().optional().describe('Absolute path of the repo being worked in'),
      },
    },
    async (args) => next(args)
  );

  // Free slash command on hosts that surface MCP prompts.
  server.registerPrompt(
    'codequiz',
    {
      title: 'codequiz',
      description: 'Control the ambient quizzer: on | off | off <N> | off <2h> | status',
      argsSchema: { command: z.string().optional() },
    },
    ({ command }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Call the codequiz_next tool with command="${command || 'status'}". Acknowledge the result in one short line.`,
          },
        },
      ],
    })
  );

  return server;
}

async function main() {
  await createServer().connect(new StdioServerTransport());
}

if (require.main === module) {
  main().catch((e) => {
    process.stderr.write(`codequiz mcp: ${e && e.message}\n`);
    process.exit(1);
  });
}

module.exports = { createServer, main, next };
