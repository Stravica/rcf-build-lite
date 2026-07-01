#!/usr/bin/env node
// rcf view standalone bin. Thin wrapper around renderView. Owns flag
// parsing, project-root discovery, summary printing, TTY auto-open and
// process.exit. Phase 3.2 added --no-open plus TTY-gated auto-launch of
// the platform browser.

import { spawn } from 'node:child_process';
import { platform } from 'node:process';
import process from 'node:process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { formatErrors } from '../src/errors/index.js';
import { findProjectRoot, renderView } from '../src/view/index.js';

const HELP = `Usage: rcf-view [options]

Render the on-disk RCF tree as a Mermaid diagram and a browsable HTML
page. Read-only; runs no server.

Options:
  --strict          Refuse to write output if the tree has validation
                    failures or broken references (exit code is still
                    3). Without the flag, output is written with
                    broken-section markers (default).
  --no-open         Do not open the rendered page in a browser
                    (auto-open runs by default when stdout is a TTY
                    and CI is unset).
  --quiet           Suppress non-error stdout (auto-open still runs).
  --verbose         Per-document and per-output-file log lines.
  --help            Print this help and exit.

Exit codes:
  0  success
  1  render failure (IO error or unexpected runtime)
  2  usage error
  3  validation failure or broken references

Output directory: <project-root>/.rcf-view/
`;

export function parseArgs(argv) {
  const opts = { strict: false, quiet: false, verbose: false, help: false, noOpen: false };
  const errors = [];
  for (const arg of argv) {
    switch (arg) {
      case '--strict': opts.strict = true; break;
      case '--quiet': opts.quiet = true; break;
      case '--verbose': opts.verbose = true; break;
      case '--no-open': opts.noOpen = true; break;
      case '--help':
      case '-h': opts.help = true; break;
      default: errors.push(`unknown option: ${arg}`);
    }
  }
  if (opts.quiet && opts.verbose) {
    errors.push('--quiet and --verbose are mutually exclusive');
  }
  return { opts, errors };
}

/**
 * Return the platform-specific opener command + arg list, or null if the
 * platform is not one we know how to auto-open on.
 *
 * @param {string} plat
 * @param {string} path
 * @returns {{ command: string, args: string[] } | null}
 */
export function openerFor(plat, path) {
  if (plat === 'darwin') return { command: 'open', args: [path] };
  if (plat === 'linux') return { command: 'xdg-open', args: [path] };
  if (plat === 'win32') return { command: 'start', args: ['""', path] };
  return null;
}

/**
 * Auto-open the rendered index.html when we are on a TTY, CI is unset,
 * and --no-open was not passed. Never blocks the parent and never throws;
 * spawn failures fall through to a stderr warning.
 *
 * @param {object} args
 * @param {string} args.path - absolute path to index.html
 * @param {boolean} args.noOpen - the --no-open flag
 * @param {NodeJS.WriteStream} args.stream - stdout, for TTY detection
 * @param {NodeJS.ProcessEnv} args.env - process env, for CI detection
 * @param {NodeJS.WriteStream} args.stderr - stderr, for warnings
 * @param {(cmd: string, args: string[], opts: object) => object} [args.spawnFn]
 *   - injectable spawn for tests
 * @param {string} [args.platformName] - injectable platform for tests
 * @returns {boolean} whether an opener was actually spawned
 */
export function maybeAutoOpen({ path, noOpen, stream, env, stderr, spawnFn = spawn, platformName = platform }) {
  if (noOpen) return false;
  if (env.CI) return false;
  if (!stream || !stream.isTTY) return false;
  const opener = openerFor(platformName, path);
  if (!opener) return false;
  try {
    const child = spawnFn(opener.command, opener.args, { detached: true, stdio: 'ignore' });
    if (child && typeof child.unref === 'function') child.unref();
    return true;
  } catch (err) {
    stderr.write(`[warn] auto-open: ${err.message}\n`);
    return false;
  }
}

async function main(argv) {
  const { opts, errors: argErrors } = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argErrors.length > 0) {
    for (const msg of argErrors) process.stderr.write(`[error] usage ${msg}\n`);
    process.stderr.write(HELP);
    return 2;
  }

  const cwd = process.cwd();
  const projectRoot = await findProjectRoot(cwd);
  if (!projectRoot) {
    process.stderr.write('[error] usage no project root found (no rcf/manifest.json in this directory or any ancestor).\n');
    process.stderr.write('Run `rcf init` (Phase 4) or create rcf/manifest.json to start.\n');
    return 2;
  }

  const sink = opts.quiet ? () => {} : (line) => process.stdout.write(`${line}\n`);
  const result = await renderView({
    projectRoot,
    strict: opts.strict,
    verbose: opts.verbose,
    log: sink,
  });

  if (result.errors && result.errors.length > 0) {
    process.stderr.write(`${formatErrors(result.errors, { verbose: opts.verbose, strict: opts.strict })}\n`);
  }

  if (result.exitCode === 0) {
    if (!opts.quiet) {
      const count = result.written.length;
      process.stdout.write(`wrote ${count} file${count === 1 ? '' : 's'} to ${projectRoot}/.rcf-view/\n`);
    }
  } else if (result.exitCode === 3 && !opts.strict && result.written.length > 0 && !opts.quiet) {
    process.stdout.write(`wrote ${result.written.length} files to ${projectRoot}/.rcf-view/ (with broken-section markers)\n`);
  }

  if ((result.exitCode === 0 || (result.exitCode === 3 && result.written.length > 0))) {
    maybeAutoOpen({
      path: join(projectRoot, '.rcf-view', 'index.html'),
      noOpen: opts.noOpen,
      stream: process.stdout,
      env: process.env,
      stderr: process.stderr,
    });
  }

  return result.exitCode;
}

export { main };

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`[error] ioFailure unexpected: ${err.message}\n`);
      process.exit(1);
    });
}
