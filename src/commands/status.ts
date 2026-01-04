import chalk from 'chalk';
import path from 'path';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  readGlobalCtxRegistry,
  getGlobalCtxDir,
} from '../lib/registry.js';
import { findMatchingContexts, MatchedContext } from '../lib/target-matcher.js';

interface StatusOptions {
  pretty?: boolean;
  global?: boolean;   // Show global status only
  all?: boolean;      // Show both project and global status
  target?: string;    // Show contexts bound to this target file (supports glob)
}

/**
 * Show current ctx status
 *
 * Default: project only
 * --global: global only
 * --all: both project and global
 */
export async function statusCommand(options: StatusOptions = {}) {
  try {
    const globalInitialized = await isGlobalCtxInitialized();
    const projectRoot = await findProjectRoot();

    // Handle --target option: show contexts bound to specific file
    if (options.target) {
      await handleTargetStatus(options.target, projectRoot, globalInitialized, options);
      return;
    }

    // Determine scope
    let showProject = false;
    let showGlobal = false;

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
    let warning: string | undefined;

    if (showProject && !projectRoot) {
      if (globalInitialized) {
        // Warning + global fallback
        warning = 'No project found. Falling back to global status.';
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

    const status: any = {
      initialized: true,
      global: null,
      project: null,
    };

    // Global status
    if (showGlobal && globalInitialized) {
      const globalRegistry = await readGlobalCtxRegistry();
      status.global = {
        path: getGlobalCtxDir(),
        contextCount: Object.keys(globalRegistry.contexts).length,
        projectCount: globalRegistry.index ? Object.keys(globalRegistry.index).length : 0,
        lastSynced: globalRegistry.meta.last_synced,
      };
    }

    // Project status
    if (showProject && projectRoot) {
      const projectRegistry = await readProjectRegistry(projectRoot);
      const contexts = projectRegistry.contexts;

      // Categorize by target presence (not scope)
      const boundCount = Object.values(contexts).filter(c => c.target != null).length;
      const standaloneCount = Object.values(contexts).filter(c => c.target == null).length;

      status.project = {
        path: projectRoot,
        name: path.basename(projectRoot),
        contextCount: Object.keys(contexts).length,
        bound: boundCount,        // contexts with target (file-bound)
        standalone: standaloneCount,  // contexts without target (general knowledge)
        lastSynced: projectRegistry.meta.last_synced,
      };
    }

    if (options.pretty) {
      if (warning) {
        console.log();
        console.log(chalk.yellow(`⚠️  ${warning}`));
      }
      printPrettyStatus(status, options);
    } else {
      if (warning) console.error(chalk.yellow(warning));
      console.log(JSON.stringify(status, null, 2));
    }
  } catch (error) {
    if (options.pretty) {
      console.error(chalk.red('✗ Error getting status:'), error);
    } else {
      console.log(JSON.stringify({ error: String(error) }, null, 2));
    }
    process.exit(1);
  }
}

function printPrettyStatus(status: any, options: StatusOptions): void {
  console.log();
  console.log(chalk.blue.bold('CTX Status'));
  console.log();

  if (status.global) {
    console.log(chalk.green('✓ Global initialized'));
    console.log(chalk.gray(`  Path: ${status.global.path}`));
    console.log(chalk.gray(`  Contexts: ${status.global.contextCount}`));
    console.log(chalk.gray(`  Projects indexed: ${status.global.projectCount}`));
    console.log(chalk.gray(`  Last synced: ${status.global.lastSynced}`));
    console.log();
  } else if (options.all || options.global) {
    console.log(chalk.yellow('○ Global not initialized'));
    console.log(chalk.gray('  Run `ctx init` to initialize'));
    console.log();
  }

  if (status.project) {
    console.log(chalk.green(`✓ Project: ${status.project.name}`));
    console.log(chalk.gray(`  Path: ${status.project.path}`));
    console.log(chalk.gray(`  Bound contexts: ${status.project.bound}`));
    console.log(chalk.gray(`  Standalone contexts: ${status.project.standalone}`));
    console.log(chalk.gray(`  Last synced: ${status.project.lastSynced}`));
  } else if (options.all) {
    console.log(chalk.yellow('○ No project context in current directory'));
    console.log(chalk.gray('  Run `ctx init .` to initialize'));
  }

  console.log();
}

/**
 * Handle --target option: show contexts bound to specific file
 */
async function handleTargetStatus(
  targetPath: string,
  projectRoot: string | null,
  globalInitialized: boolean,
  options: StatusOptions
): Promise<void> {
  const allMatches: MatchedContext[] = [];
  const effectiveRoot = projectRoot || process.cwd();

  // Check project registry
  if (projectRoot) {
    const projectRegistry = await readProjectRegistry(projectRoot);
    const projectMatches = findMatchingContexts(
      projectRegistry.contexts || {},
      targetPath,
      projectRoot,
      'project',
      projectRoot
    );
    allMatches.push(...projectMatches);
  }

  // Check global registry
  if (globalInitialized) {
    const globalRegistry = await readGlobalCtxRegistry();
    const globalMatches = findMatchingContexts(
      globalRegistry.contexts || {},
      targetPath,
      effectiveRoot,
      'global',
      getGlobalCtxDir()
    );
    allMatches.push(...globalMatches);
  }

  // Sort by priority (lower = higher priority)
  allMatches.sort((a, b) => a.priority - b.priority);

  if (options.pretty) {
    console.log();
    console.log(chalk.blue.bold(`Contexts for: ${targetPath}`));
    console.log();

    if (allMatches.length === 0) {
      console.log(chalk.yellow('No contexts found for this target.'));
    } else {
      for (const match of allMatches) {
        const relativePath = projectRoot
          ? path.relative(projectRoot, match.contextPath)
          : match.contextPath;
        const sourceLabel = match.source === 'project' ? chalk.green('[Project]') : chalk.cyan('[Global]');
        const matchLabel = match.matchType === 'exact' ? chalk.gray('(exact)') : chalk.gray('(glob)');

        console.log(`${sourceLabel} ${relativePath} ${matchLabel}`);
        console.log(chalk.gray(`  Target: ${match.target}`));
        if (match.preview?.what) {
          console.log(chalk.gray(`  What: ${match.preview.what}`));
        }
        console.log();
      }
    }
  } else {
    const output = allMatches.map(m => ({
      path: projectRoot ? path.relative(projectRoot, m.contextPath) : m.contextPath,
      target: m.target,
      source: m.source,
      matchType: m.matchType,
      what: m.preview?.what || null,
      keywords: m.preview?.keywords || null,
    }));
    console.log(JSON.stringify(output, null, 2));
  }
}
