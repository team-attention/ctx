#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initCommand } from '../commands/init.js';
import { createCommand } from '../commands/create.js';
import { syncCommand } from '../commands/sync.js';
import { checkCommand } from '../commands/check.js';
import { refreshCommand } from '../commands/refresh.js';
import { statusCommand } from '../commands/status.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('ctx')
  .description('Context-driven development CLI tool')
  .version(packageJson.version);

program
  .command('init [target]')
  .alias('initialize')
  .description('Initialize context management (no arg: global, ".": project)')
  .action(initCommand);

program
  .command('create <target>')
  .description('Create a new context file from template')
  .option('--template <type>', 'Template type (default: default)', 'default')
  .option('--force', 'Overwrite existing context file without confirmation')
  .option('--global', 'Create a global context document in ctx/ directory')
  .action(createCommand);

program
  .command('sync')
  .description('Sync context files to registries')
  .option('--local', 'Sync only local contexts')
  .option('--global', 'Sync only global contexts')
  .action(syncCommand);

program
  .command('check')
  .description('Check context health and freshness')
  .option('--local', 'Check only local contexts')
  .option('--global', 'Check only global contexts')
  .option('--path <contextPath>', 'Check only a specific context file')
  .option('--fix', 'Update registry to match filesystem')
  .option('--pretty', 'Human-readable output (default is JSON)')
  .action(checkCommand);

program
  .command('refresh')
  .description('Refresh AI commands with current config settings')
  .action(refreshCommand);

program
  .command('status')
  .description('Show current ctx status (JSON by default)')
  .option('--pretty', 'Human-readable dashboard output')
  .option('--target <path>', 'Find context file for a target file path')
  .action(statusCommand);

program.parse(process.argv);
