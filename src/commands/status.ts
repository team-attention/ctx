import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { isProjectInitialized, fileExists } from '../lib/fileUtils.js';
import {
  readLocalRegistry,
  readGlobalRegistry,
  findContextByTarget,
  findProjectRoot,
  isGlobalCtxInitialized,
  isProjectCtxInitialized,
  readProjectRegistry,
  readGlobalCtxRegistry,
} from '../lib/registry.js';
import { loadConfig } from '../lib/config.js';

interface StatusOptions {
  pretty?: boolean;
  target?: string;
  global?: boolean;  // Show global registry only
  all?: boolean;     // Show all projects from global index
}

interface StatusData {
  initialized: boolean;
  context: {
    local: { count: number; stale: number; errors: number };
    global: { count: number };
    lastSync: string | null;
  };
  suggestions: string[];
}

export async function statusCommand(options: StatusOptions = {}) {
  try {
    // Check for 3-level system first
    const globalInitialized = await isGlobalCtxInitialized();
    const projectRoot = await findProjectRoot();

    // Use new 3-level status if available
    if (globalInitialized || projectRoot) {
      await statusCommandNew(options, globalInitialized, projectRoot);
      return;
    }

    // Fall back to legacy system
    await statusCommandLegacy(options);
  } catch (error) {
    if (options.pretty) {
      console.error(chalk.red('✗ Error getting status:'), error);
    } else {
      console.log(JSON.stringify({ error: String(error) }, null, 2));
    }
    process.exit(1);
  }
}

/**
 * New 3-level status command
 */
async function statusCommandNew(
  options: StatusOptions,
  globalInitialized: boolean,
  projectRoot: string | null
) {
  // --global mode: show global registry only
  if (options.global) {
    await statusGlobal(options, globalInitialized);
    return;
  }

  // --all mode: show all projects from global index
  if (options.all) {
    await statusAll(options, globalInitialized);
    return;
  }

  // --target mode: find context by target path
  if (options.target && projectRoot) {
    await statusTarget(options, projectRoot);
    return;
  }

  // Default: current project status
  await statusProject(options, globalInitialized, projectRoot);
}

/**
 * Show global registry status
 */
async function statusGlobal(options: StatusOptions, globalInitialized: boolean) {
  if (!globalInitialized) {
    if (options.pretty) {
      console.log(chalk.yellow('⚠️  Global ctx not initialized'));
      console.log(chalk.gray("  Run 'ctx init' to initialize."));
    } else {
      console.log(JSON.stringify({ error: 'Global not initialized' }, null, 2));
    }
    return;
  }

  const globalRegistry = await readGlobalCtxRegistry();

  if (options.pretty) {
    console.log();
    console.log(chalk.bold('📦 Global Contexts (~/.ctx/)'));
    console.log(chalk.gray('━'.repeat(50)));

    // Show settings if available
    if (globalRegistry.settings?.context_paths) {
      console.log(chalk.bold('\nContext Paths:'));
      globalRegistry.settings.context_paths.forEach((cp) => {
        console.log(chalk.gray(`  ${cp.path} - ${cp.purpose}`));
      });
    }

    // Show contexts
    console.log(chalk.bold('\nContexts:'));
    const contexts = Object.entries(globalRegistry.contexts);
    if (contexts.length === 0) {
      console.log(chalk.gray('  (no contexts registered)'));
    } else {
      contexts.forEach(([path, entry]) => {
        console.log(`  ${chalk.cyan(path)}`);
        console.log(chalk.gray(`    what: ${entry.preview.what}`));
      });
    }

    // Show index summary
    if (globalRegistry.index) {
      const projectCount = Object.keys(globalRegistry.index).length;
      console.log(chalk.bold(`\nRegistered Projects: ${projectCount}`));
    }

    console.log();
    console.log(chalk.gray(`Last sync: ${formatLastSync(globalRegistry.meta.last_synced)}`));
    console.log();
  } else {
    console.log(JSON.stringify({
      scope: 'global',
      settings: globalRegistry.settings,
      contexts: globalRegistry.contexts,
      indexProjectCount: globalRegistry.index ? Object.keys(globalRegistry.index).length : 0,
      lastSynced: globalRegistry.meta.last_synced,
    }, null, 2));
  }
}

/**
 * Show all projects from global index
 */
async function statusAll(options: StatusOptions, globalInitialized: boolean) {
  if (!globalInitialized) {
    if (options.pretty) {
      console.log(chalk.yellow('⚠️  Global ctx not initialized'));
      console.log(chalk.gray("  Run 'ctx init' to initialize."));
    } else {
      console.log(JSON.stringify({ error: 'Global not initialized' }, null, 2));
    }
    return;
  }

  const globalRegistry = await readGlobalCtxRegistry();

  if (options.pretty) {
    console.log();
    console.log(chalk.bold('📦 Global Contexts'));
    console.log(chalk.gray('━'.repeat(50)));

    const globalContexts = Object.entries(globalRegistry.contexts);
    if (globalContexts.length === 0) {
      console.log(chalk.gray('  (no global contexts)'));
    } else {
      globalContexts.forEach(([path, entry]) => {
        console.log(`  ${chalk.cyan(path)}: ${entry.preview.what}`);
      });
    }

    console.log();
    console.log(chalk.bold('📁 Registered Projects'));
    console.log(chalk.gray('━'.repeat(50)));

    if (!globalRegistry.index || Object.keys(globalRegistry.index).length === 0) {
      console.log(chalk.gray('  (no projects registered)'));
    } else {
      for (const [projectName, entry] of Object.entries(globalRegistry.index)) {
        console.log(`\n  ${chalk.bold(projectName)} ${chalk.gray(`(${entry.context_count} contexts)`)}`);
        console.log(chalk.gray(`  ${entry.path}`));
        entry.contexts.forEach((ctx) => {
          console.log(chalk.gray(`    - ${ctx.path}: ${ctx.what}`));
        });
      }
    }

    console.log();
  } else {
    console.log(JSON.stringify({
      globalContexts: globalRegistry.contexts,
      projects: globalRegistry.index || {},
      lastSynced: globalRegistry.meta.last_synced,
    }, null, 2));
  }
}

/**
 * Find context by target path (for hook integration)
 */
async function statusTarget(options: StatusOptions, projectRoot: string) {
  const result = await findContextByTarget(projectRoot, options.target!);
  if (result) {
    console.log(JSON.stringify({
      found: true,
      target: options.target,
      contextPath: result.contextPath,
      entry: result.entry,
    }, null, 2));
  } else {
    console.log(JSON.stringify({
      found: false,
      target: options.target,
      contextPath: null,
    }, null, 2));
  }
}

/**
 * Show current project status
 */
async function statusProject(
  options: StatusOptions,
  globalInitialized: boolean,
  projectRoot: string | null
) {
  if (!projectRoot) {
    if (options.pretty) {
      console.log(chalk.yellow('⚠️  Project not initialized'));
      console.log(chalk.gray("  Run 'ctx init .' to initialize project."));
      if (globalInitialized) {
        console.log(chalk.gray("  Use 'ctx status --global' to see global contexts."));
      }
    } else {
      console.log(JSON.stringify({ error: 'Project not initialized' }, null, 2));
    }
    return;
  }

  const projectRegistry = await readProjectRegistry(projectRoot);

  if (options.pretty) {
    console.log();
    console.log(chalk.bold(`📊 Project Status: ${path.basename(projectRoot)}`));
    console.log(chalk.gray('━'.repeat(50)));

    // Show settings if available
    if (projectRegistry.settings?.context_paths) {
      console.log(chalk.bold('\nContext Paths:'));
      projectRegistry.settings.context_paths.forEach((cp) => {
        console.log(chalk.gray(`  ${cp.path} - ${cp.purpose}`));
      });
    }

    // Categorize contexts by scope
    const localContexts: [string, typeof projectRegistry.contexts[string]][] = [];
    const projectContexts: [string, typeof projectRegistry.contexts[string]][] = [];

    for (const [ctxPath, entry] of Object.entries(projectRegistry.contexts)) {
      if (entry.scope === 'local') {
        localContexts.push([ctxPath, entry]);
      } else {
        projectContexts.push([ctxPath, entry]);
      }
    }

    // Show local contexts
    console.log(chalk.bold(`\nLocal Contexts: ${localContexts.length}`));
    if (localContexts.length === 0) {
      console.log(chalk.gray('  (no local contexts)'));
    } else {
      localContexts.forEach(([ctxPath, entry]) => {
        console.log(`  ${chalk.cyan(ctxPath)}`);
        console.log(chalk.gray(`    → ${entry.target || 'no target'}`));
      });
    }

    // Show project contexts
    console.log(chalk.bold(`\nProject Contexts: ${projectContexts.length}`));
    if (projectContexts.length === 0) {
      console.log(chalk.gray('  (no project contexts)'));
    } else {
      projectContexts.forEach(([ctxPath, entry]) => {
        console.log(`  ${chalk.cyan(ctxPath)}: ${entry.preview.what}`);
      });
    }

    console.log();
    console.log(chalk.gray(`Last sync: ${formatLastSync(projectRegistry.meta.last_synced)}`));
    console.log();

    // Show hints
    console.log(chalk.bold('💡 Tips'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.gray('  ctx status --global    Show global contexts'));
    console.log(chalk.gray('  ctx status --all       Show all registered projects'));
    console.log();
  } else {
    console.log(JSON.stringify({
      project: path.basename(projectRoot),
      path: projectRoot,
      settings: projectRegistry.settings,
      contexts: projectRegistry.contexts,
      lastSynced: projectRegistry.meta.last_synced,
    }, null, 2));
  }
}

/**
 * Legacy status command (backward compatibility)
 */
async function statusCommandLegacy(options: StatusOptions) {
  const projectRoot = process.cwd();

  // --target mode: find context by target path
  if (options.target) {
    const result = await findContextByTarget(projectRoot, options.target);
    if (result) {
      console.log(JSON.stringify({
        found: true,
        target: options.target,
        contextPath: result.contextPath,
        entry: result.entry,
      }, null, 2));
    } else {
      console.log(JSON.stringify({
        found: false,
        target: options.target,
        contextPath: null,
      }, null, 2));
    }
    return;
  }

  // Default: full status
  const status = await collectStatus(projectRoot);

  if (options.pretty) {
    printStatusPretty(status);
  } else {
    console.log(JSON.stringify(status, null, 2));
  }
}

async function collectStatus(projectRoot: string): Promise<StatusData> {
  const status: StatusData = {
    initialized: false,
    context: {
      local: { count: 0, stale: 0, errors: 0 },
      global: { count: 0 },
      lastSync: null,
    },
    suggestions: [],
  };

  // Check initialization
  status.initialized = await isProjectInitialized();
  if (!status.initialized) {
    status.suggestions.push('Run `ctx init` to initialize');
    return status;
  }

  const config = await loadConfig(projectRoot);

  // Read registries
  await collectContextStatus(projectRoot, config, status);

  // Generate suggestions
  generateSuggestions(status);

  return status;
}

async function collectContextStatus(
  projectRoot: string,
  config: Awaited<ReturnType<typeof loadConfig>>,
  status: StatusData
): Promise<void> {
  const localRegistryPath = path.join(
    projectRoot,
    config.global.directory,
    'local-context-registry.yml'
  );
  const globalRegistryPath = path.join(
    projectRoot,
    config.global.directory,
    'global-context-registry.yml'
  );

  // Local registry
  try {
    const localRegistry = await readLocalRegistry(projectRoot);
    status.context.local.count = Object.keys(localRegistry.contexts).length;
    status.context.lastSync = localRegistry.meta.last_synced;

    // Quick stale check - compare target checksums
    for (const [targetPath, entry] of Object.entries(localRegistry.contexts)) {
      const absoluteTarget = path.join(projectRoot, targetPath.replace(/^\//, ''));
      const exists = await fileExists(absoluteTarget);
      if (!exists) {
        status.context.local.errors++;
      }
      // Note: Full checksum comparison would require reading files
      // For status, we just count entries
    }
  } catch {
    // Registry doesn't exist
  }

  // Global registry
  try {
    const globalRegistry = await readGlobalRegistry(projectRoot);
    status.context.global.count = Object.keys(globalRegistry.contexts).length;

    // Update lastSync if global is more recent
    if (globalRegistry.meta.last_synced) {
      if (
        !status.context.lastSync ||
        globalRegistry.meta.last_synced > status.context.lastSync
      ) {
        status.context.lastSync = globalRegistry.meta.last_synced;
      }
    }
  } catch {
    // Registry doesn't exist
  }
}

function generateSuggestions(status: StatusData): void {
  if (!status.initialized) return;

  // Context suggestions
  if (status.context.local.count === 0 && status.context.global.count === 0) {
    status.suggestions.push('Initialize registries → ctx sync');
    status.suggestions.push('Create your first context → /ctx.local <file>');
  } else if (status.context.local.errors > 0) {
    status.suggestions.push(
      `${status.context.local.errors} context(s) have issues → ctx check --pretty`
    );
  }

  // Limit to 3 suggestions
  status.suggestions = status.suggestions.slice(0, 3);
}

function printStatusPretty(status: StatusData): void {
  console.log();

  // Not initialized
  if (!status.initialized) {
    console.log(chalk.yellow('⚠️  ctx not initialized'));
    console.log();
    console.log(chalk.gray('Run: ctx init'));
    console.log();
    return;
  }

  // Context Status
  console.log(chalk.bold('📊 Context Status'));
  console.log(chalk.gray('━'.repeat(50)));

  const localHealth = getHealthIndicator(status.context.local);
  console.log(`Local contexts:  ${status.context.local.count} ${localHealth}`);
  console.log(`Global contexts: ${status.context.global.count}`);
  console.log(`Last sync:       ${formatLastSync(status.context.lastSync)}`);

  console.log();

  // Suggestions
  if (status.suggestions.length > 0) {
    console.log(chalk.bold('💡 Suggestions'));
    console.log(chalk.gray('━'.repeat(50)));
    status.suggestions.forEach((s) => {
      console.log(`• ${s}`);
    });
    console.log();
  }
}

function getHealthIndicator(local: { count: number; stale: number; errors: number }): string {
  if (local.count === 0) return '';
  if (local.errors > 0) return chalk.red(`(✗ ${local.errors} errors)`);
  if (local.stale > 0) return chalk.yellow(`(⚠ ${local.stale} stale)`);
  return chalk.green('(✓ all valid)');
}

function formatLastSync(lastSync: string | null): string {
  if (!lastSync) return chalk.gray('never');

  try {
    const syncDate = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let relative: string;
    if (diffMins < 1) relative = 'just now';
    else if (diffMins < 60) relative = `${diffMins} min ago`;
    else if (diffHours < 24) relative = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    else relative = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    const formatted = syncDate.toISOString().slice(0, 16).replace('T', ' ');
    return `${formatted} (${relative})`;
  } catch {
    return lastSync;
  }
}
