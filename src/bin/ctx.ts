#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initCommand } from '../commands/init.js';
import { createCommand } from '../commands/create.js';
import { syncCommand } from '../commands/sync.js';
import { checkCommand } from '../commands/check.js';
import { statusCommand } from '../commands/status.js';
import { addCommand } from '../commands/add.js';
import { addPatternCommand } from '../commands/add-pattern.js';
import { removeCommand } from '../commands/remove.js';
import { adoptCommand } from '../commands/adopt.js';
import { loadCommand } from '../commands/load.js';
import { listCommand } from '../commands/list.js';
import { saveCommand } from '../commands/save.js';

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
  .option(
    '--context-paths <paths>',
    'Context paths with purposes (format: "path1:purpose1,path2:purpose2")'
  )
  .option('-y, --yes', 'Non-interactive mode (use defaults, auto-confirm)')
  .action(initCommand);

program
  .command('create <path>')
  .description('Create a new context file (path relative to project root or ~/.ctx/ with --global)')
  .option('--target <pattern>', 'Optional target file/pattern for frontmatter')
  .option('--force', 'Overwrite existing context file without confirmation')
  .option('--global', 'Create in global registry (~/.ctx/)')
  .action(createCommand);

program
  .command('sync')
  .description('Sync context files to registry')
  .option('--global', 'Sync global contexts (~/.ctx/)')
  .option('--rebuild-index', 'Rebuild global index from all registered projects')
  .option('--prune', 'Remove registry entries that don\'t match context_paths')
  .action(syncCommand);

program
  .command('check')
  .description('Check context health and freshness')
  .option('--global', 'Check only global contexts')
  .option('--target <filePath>', 'Check only contexts bound to this file (supports glob)')
  .option('--fix', 'Update registry to match filesystem')
  .option('--pretty', 'Human-readable output (default is JSON)')
  .action(checkCommand);

program
  .command('status')
  .description('Show current ctx status (default: project, JSON output)')
  .option('--pretty', 'Human-readable dashboard output')
  .option('--global', 'Show global status only')
  .option('--all', 'Show both project and global status')
  .option('--target <filePath>', 'Show contexts bound to this file (supports glob)')
  .action(statusCommand);

program
  .command('list')
  .description('List context files from registry (default: project, JSON output)')
  .option('--global', 'Show global contexts only')
  .option('--all', 'Show both project and global contexts')
  .option('--target <filePath>', 'Show contexts bound to this file (supports glob)')
  .option('--json', 'Output as JSON (default)')
  .option('--pretty', 'Human-readable output')
  .option('--paths', 'Output paths only (newline separated)')
  .action(listCommand);

program
  .command('add <patterns...>')
  .description('Add context files to registry')
  .option('--global', 'Add to global registry instead of project')
  .action(addCommand);

program
  .command('add-pattern <pattern> <purpose>')
  .description('Add a glob pattern to context_paths settings')
  .option('--global', 'Add to global registry instead of project')
  .action(addPatternCommand);

program
  .command('remove <patterns...>')
  .description('Remove context files from registry (files are NOT deleted)')
  .option('--global', 'Remove from global registry instead of project')
  .action(removeCommand);

program
  .command('adopt <patterns...>')
  .description('Adopt existing documents by adding frontmatter')
  .option('--global', 'Adopt to global registry instead of project')
  .action(adoptCommand);

program
  .command('load')
  .description('Load context files by keywords or target file path (default: project, JSON output)')
  .option('-k, --keywords <keywords...>', 'Keywords to search for in context metadata')
  .option('-t, --target <filePath>', 'File path to match against targets (supports glob)')
  .option('--global', 'Search global contexts only')
  .option('--all', 'Search both project and global contexts')
  .option('--pretty', 'Human-readable markdown output')
  .option('--paths', 'Output paths only (newline separated)')
  .action(loadCommand);

program
  .command('save')
  .description('Save content to a context file (non-interactive)')
  .option('--path <filepath>', 'Path for the context file (required)')
  .option('--content <text>', 'Content to save (required, or pipe via stdin)')
  .option('--what <description>', 'Brief description for frontmatter')
  .option('--keywords <keywords>', 'Comma-separated keywords for auto-loading')
  .option('--target <pattern>', 'Target file/pattern for frontmatter')
  .option('--global', 'Save to global context (~/.ctx/contexts/)')
  .option('--project', 'Save to project context (.ctx/contexts/)')
  .option('--force', 'Overwrite existing file')
  .action(saveCommand);

program.parse(process.argv);
