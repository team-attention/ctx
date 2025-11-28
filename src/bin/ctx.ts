#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initCommand } from '../commands/init.js';
import { createCommand } from '../commands/create.js';
import { syncCommand } from '../commands/sync.js';
import { validateCommand } from '../commands/validate.js';
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
  .command('init')
  .alias('initialize')
  .description('Initialize context management in your project')
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
  .command('validate')
  .description('Validate context files and check consistency')
  .option('--local', 'Validate only local contexts')
  .option('--global', 'Validate only global contexts')
  .action(validateCommand);

program
  .command('refresh')
  .description('Refresh AI commands with current config settings')
  .action(refreshCommand);

program
  .command('status')
  .description('Show current ctx and work session status (JSON by default)')
  .option('--pretty', 'Human-readable dashboard output')
  .option('--target <path>', 'Find context file for a target file path')
  .action(statusCommand);

program.parse(process.argv);
