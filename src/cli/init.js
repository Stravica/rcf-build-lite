// `rcf init` subcommand handler. Interactive by default when stdin +
// stdout are TTYs and --non-interactive is not set. Phase 4 §D5:
// exactly four prompts (projectName, prdProblemStatement, reqTitle,
// usTitle). Zero deps; prompts via node:readline/promises.
//
// Theme 1 (E2E matrix 2026-07-06-003): init is the full pre-session
// bootstrap. After scaffolding the tree it also (1) writes/merges the
// project-root .mcp.json rcf server entry and (2) writes the guidance
// fragment into CLAUDE.md / AGENTS.md inside rcf marker comments -
// the project is wired BEFORE the agent session starts. Re-running
// init on an existing tree leaves the tree alone and refreshes the
// wiring (idempotent). --no-agent-setup skips the wiring and prints
// the manual instructions instead.

import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';

import { initProject } from '../store/init.js';
import {
  loadHarnessFragment,
  manualSetupInstructions,
  writeAgentInstructions,
  writeMcpConfig,
} from '../setup/agent-setup.js';

const OPTION_SPEC = {
  'project-name': { type: 'string' },
  'non-interactive': { type: 'boolean' },
  'no-agent-setup': { type: 'boolean' },
  quiet: { type: 'boolean' },
  help: { type: 'boolean' },
};

const HELP = `Usage: rcf init [options]

Scaffolds the rcf/ tree, registers the MCP server in the project-root
.mcp.json and writes the agent-instructions fragment into CLAUDE.md
(or AGENTS.md) - the full pre-session bootstrap. Re-running on an
existing project leaves the tree alone and refreshes the wiring.

Options:
  --project-name <name>     Project name (required for --non-interactive)
  --non-interactive         Skip prompts; use seed values (default when
                            not on a TTY or when piped)
  --no-agent-setup          Scaffold the tree only; print the manual
                            harness-wiring instructions instead
  --quiet                   Suppress non-error stdout
  --help                    Print this help
`;

/**
 * @param {string[]} argv - argv slice after `init`
 * @param {object} [deps]
 * @returns {Promise<number>}
 */
export async function main(argv, deps = {}) {
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const stdin = deps.stdin ?? process.stdin;

  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTION_SPEC, allowPositionals: true, strict: true });
  } catch (err) {
    stderr.write(`[error] usage ${err.message}\n`);
    stderr.write(HELP);
    return 2;
  }
  const flags = parsed.values;
  if (flags.help) {
    stdout.write(HELP);
    return 0;
  }
  const cwd = deps.cwd ?? process.cwd();
  const agentSetup = !flags['no-agent-setup'];
  const forceNonInteractive = Boolean(flags['non-interactive']);
  const isTty = Boolean(stdout.isTTY && stdin.isTTY);
  const interactive = !forceNonInteractive && isTty;

  let projectName = flags['project-name'];
  let seed = null;

  if (interactive) {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      projectName = projectName ?? (await rl.question('Project name: ')).trim();
      if (!projectName) projectName = 'New RCF Project';
      const prdProblemStatement = (await rl.question('One-line problem statement: ')).trim();
      const reqTitle = (await rl.question('First requirement title: ')).trim();
      const usTitle = (await rl.question('First user story title: ')).trim();
      seed = {
        interactive: true,
        prdProblemStatement: prdProblemStatement || undefined,
        reqTitle: reqTitle || undefined,
        usTitle: usTitle || undefined,
      };
    } finally {
      rl.close();
    }
  } else {
    if (!projectName) {
      stderr.write('[error] usage --project-name is required in non-interactive mode\n');
      stderr.write(HELP);
      return 2;
    }
  }

  const result = await initProject({ projectRoot: cwd, projectName, seed });
  const treeExists = Boolean(result && 'kind' in result && result.kind === 'usage'
    && /already exists/.test(result.message));
  if (result && 'kind' in result && result.kind === 'usage' && !treeExists) {
    stderr.write(`[error] usage ${result.message}\n`);
    return 2;
  }
  if (result && 'kind' in result && !treeExists) {
    stderr.write(`[error] ${result.kind} ${result.message}\n`);
    return 1;
  }
  if (treeExists && !agentSetup) {
    // Nothing to do at all: tree present, wiring explicitly skipped.
    stderr.write(`[error] usage ${result.message}\n`);
    return 2;
  }

  if (!flags.quiet) {
    if (treeExists) {
      stdout.write('rcf/ tree already present - left untouched; refreshing agent wiring.\n');
    } else {
      stdout.write(`Scaffolded ${result.created.length} files under rcf/.\n`);
      for (const file of result.created) stdout.write(`  ${file}\n`);
    }
  }

  if (!agentSetup) {
    if (!flags.quiet) stdout.write(`${manualSetupInstructions()}\n`);
    return 0;
  }

  // Step 1: .mcp.json (merge; never clobber other servers / unknown keys).
  const mcpResult = await writeMcpConfig({ projectRoot: cwd });
  if (mcpResult && 'kind' in mcpResult && 'message' in mcpResult) {
    stderr.write(`[error] ${mcpResult.kind} ${mcpResult.message}\n`);
    return 2;
  }

  // Step 2: agent-instructions fragment inside rcf markers (idempotent).
  const fragment = await loadHarnessFragment();
  if (typeof fragment !== 'string') {
    stderr.write(`[error] ${fragment.kind} ${fragment.message}\n`);
    return 1;
  }
  const instrResult = await writeAgentInstructions({ projectRoot: cwd, fragment });

  if (!flags.quiet) {
    const mcpLine = mcpResult.action === 'kept'
      ? '.mcp.json: rcf server entry already present (kept)'
      : `.mcp.json: rcf server entry ${mcpResult.action}`;
    const instrLine = `${instrResult.file}: rcf agent-instructions block ${instrResult.action}`;
    stdout.write(`${mcpLine}\n${instrLine}\n`);
    stdout.write('Project wired: rcf/ tree + MCP config + agent instructions. Start your agent session.\n');
  }
  return 0;
}
