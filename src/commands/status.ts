import chalk from 'chalk';
import path from 'path';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  readGlobalCtxRegistry,
  getGlobalCtxDir,
} from '../lib/registry.js';

interface StatusOptions {
  pretty?: boolean;
  global?: boolean;
  all?: boolean;
}

export async function statusCommand(options: StatusOptions = {}) {
  try {
    const globalInitialized = await isGlobalCtxInitialized();
    const projectRoot = await findProjectRoot();

    if (!globalInitialized && !projectRoot) {
      if (options.pretty) {
        console.log(chalk.yellow('⚠️  CTX not initialized.'));
        console.log();
        console.log(chalk.gray('To get started:'));
        console.log(chalk.gray('  ctx init      # Initialize global context'));
        console.log(chalk.gray('  ctx init .    # Initialize project context'));
      } else {
        console.log(JSON.stringify({
          initialized: false,
          global: null,
          project: null,
        }, null, 2));
      }
      return;
    }

    const status: any = {
      initialized: true,
      global: null,
      project: null,
    };

    // Global status
    if (globalInitialized) {
      const globalRegistry = await readGlobalCtxRegistry();
      status.global = {
        path: getGlobalCtxDir(),
        contextCount: Object.keys(globalRegistry.contexts).length,
        projectCount: globalRegistry.index ? Object.keys(globalRegistry.index).length : 0,
        lastSynced: globalRegistry.meta.last_synced,
      };
    }

    // Project status
    if (projectRoot) {
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
      printPrettyStatus(status, options);
    } else {
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
  } else {
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
  } else {
    console.log(chalk.yellow('○ No project context in current directory'));
    console.log(chalk.gray('  Run `ctx init .` to initialize'));
  }

  console.log();
}
