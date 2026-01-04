import chalk from 'chalk';
import path from 'path';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  readGlobalCtxRegistry,
  getGlobalCtxDir,
} from '../lib/registry.js';
import { ContextEntry } from '../lib/types.js';
import { matchesTarget } from '../lib/target-matcher.js';

interface ListOptions {
  project?: boolean;  // Show project contexts only (default)
  global?: boolean;   // Show global contexts only
  all?: boolean;      // Show both project and global
  target?: string;    // Filter by target binding (supports glob)
  json?: boolean;     // Output as JSON (default)
  pretty?: boolean;   // Human-readable output
  paths?: boolean;    // Output paths only (newline separated)
}

interface ListEntry {
  path: string;
  what: string;
  keywords: string[];
  target: string | null;
  registry: 'project' | 'global';
  type: 'bound' | 'standalone';
}

/**
 * Map registry contexts to ListEntry format
 */
function mapRegistryToEntries(
  contexts: Record<string, ContextEntry>,
  registry: 'project' | 'global'
): ListEntry[] {
  return Object.entries(contexts).map(([key, entry]) => ({
    path: key,
    what: entry.preview?.what || '',
    keywords: entry.preview?.keywords || [],
    target: entry.target || null,
    registry,
    type: entry.target ? 'bound' as const : 'standalone' as const,
  }));
}

/**
 * Filter entries by target path
 */
function filterByTarget(
  entries: ListEntry[],
  targetPath: string,
  projectRoot: string
): ListEntry[] {
  return entries.filter(entry => {
    if (!entry.target) return false;
    return matchesTarget(targetPath, entry.target, projectRoot);
  });
}

/**
 * Print entries in pretty format
 */
function printPrettyList(entries: ListEntry[]): void {
  console.log();
  console.log(chalk.blue.bold(`Contexts (${entries.length})`));
  console.log();

  if (entries.length === 0) {
    console.log(chalk.yellow('No contexts found.'));
    console.log();
    return;
  }

  // Group by registry
  const projectEntries = entries.filter(e => e.registry === 'project');
  const globalEntries = entries.filter(e => e.registry === 'global');

  if (projectEntries.length > 0) {
    console.log(chalk.green(`Project (${projectEntries.length})`));
    for (const entry of projectEntries) {
      printEntry(entry);
    }
    console.log();
  }

  if (globalEntries.length > 0) {
    console.log(chalk.cyan(`Global (${globalEntries.length})`));
    for (const entry of globalEntries) {
      printEntry(entry);
    }
    console.log();
  }
}

/**
 * Print a single entry in pretty format
 */
function printEntry(entry: ListEntry): void {
  const typeLabel = entry.type === 'bound'
    ? chalk.gray('[bound]')
    : chalk.gray('[standalone]');
  console.log(`  ${entry.path} ${typeLabel}`);
  if (entry.what) {
    console.log(chalk.gray(`    ${entry.what}`));
  }
  if (entry.target) {
    console.log(chalk.gray(`    -> ${entry.target}`));
  }
}

/**
 * Output entries based on format options
 */
function outputEntries(entries: ListEntry[], options: ListOptions, warning?: string): void {
  if (options.paths) {
    // Paths only (newline separated)
    if (warning) console.error(chalk.yellow(warning));
    for (const entry of entries) {
      console.log(entry.path);
    }
  } else if (options.pretty) {
    // Human-readable format
    if (warning) {
      console.log();
      console.log(chalk.yellow(`⚠️  ${warning}`));
    }
    printPrettyList(entries);
  } else {
    // Default: JSON
    if (warning) console.error(chalk.yellow(warning));
    console.log(JSON.stringify(entries, null, 2));
  }
}

/**
 * List context files from registry
 *
 * Default: project only
 * --global: global only
 * --all: both project and global
 *
 * If no project context exists and neither --global nor --all specified,
 * falls back to global with a warning.
 */
export async function listCommand(options: ListOptions = {}): Promise<void> {
  try {
    const projectRoot = await findProjectRoot();
    const globalInitialized = await isGlobalCtxInitialized();
    const effectiveRoot = projectRoot || process.cwd();

    // Determine scope
    // --all: both, --global: global only, default: project only
    let showProject = false;
    let showGlobal = false;
    let warning: string | undefined;

    if (options.all) {
      // --all: show both
      showProject = true;
      showGlobal = true;
    } else if (options.global) {
      // --global: global only
      showGlobal = true;
    } else {
      // Default: project only
      showProject = true;
    }

    // Validate scope with global fallback for read commands (CORE_PRINCIPLE #5)
    if (showProject && !projectRoot) {
      if (globalInitialized) {
        // Warning + global fallback
        warning = 'No project found. Falling back to global contexts.';
        showProject = false;
        showGlobal = true;
      } else {
        console.error(chalk.red('✗ Error: Not in a ctx project and global ctx not initialized.'));
        console.log(chalk.gray("  Run 'ctx init' to initialize global, or 'ctx init .' for project."));
        process.exit(1);
      }
    }

    if (showGlobal && !globalInitialized) {
      console.error(chalk.red('✗ Error: Global ctx not initialized.'));
      console.log(chalk.gray("  Run 'ctx init' first."));
      process.exit(1);
    }

    const entries: ListEntry[] = [];

    // Collect project contexts
    if (showProject && projectRoot) {
      const projectRegistry = await readProjectRegistry(projectRoot);
      entries.push(...mapRegistryToEntries(projectRegistry.contexts || {}, 'project'));
    }

    // Collect global contexts
    if (showGlobal && globalInitialized) {
      const globalRegistry = await readGlobalCtxRegistry();
      entries.push(...mapRegistryToEntries(globalRegistry.contexts || {}, 'global'));
    }

    // Filter by target if specified
    let filteredEntries = entries;
    if (options.target) {
      filteredEntries = filterByTarget(entries, options.target, effectiveRoot);
    }

    // Sort: project first, then by path
    filteredEntries.sort((a, b) => {
      if (a.registry !== b.registry) {
        return a.registry === 'project' ? -1 : 1;
      }
      return a.path.localeCompare(b.path);
    });

    // Output based on format
    outputEntries(filteredEntries, options, warning);
  } catch (error) {
    if (options.pretty) {
      console.error(chalk.red('✗ Error listing contexts:'), error);
    } else {
      console.log(JSON.stringify({ error: String(error) }, null, 2));
    }
    process.exit(1);
  }
}
