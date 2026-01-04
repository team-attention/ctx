import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import YAML from 'yaml';
import {
  CTX_DIR,
  REGISTRY_FILE,
  getGlobalCtxDir,
  isGlobalCtxInitialized,
  isProjectCtxInitialized,
} from '../lib/registry.js';
import { ContextPathConfig, UnifiedRegistry } from '../lib/types.js';
import {
  DEFAULT_PROJECT_CONTEXT_PATHS,
  DEFAULT_GLOBAL_CONTEXT_PATHS,
} from '../lib/context-path-matcher.js';

/**
 * Parse --context-paths CLI option
 * Format: "path1:purpose1,path2:purpose2"
 */
export function parseContextPathsOption(optionValue: string): ContextPathConfig[] {
  if (!optionValue || optionValue.trim() === '') {
    throw new Error('context-paths option cannot be empty');
  }

  const paths: ContextPathConfig[] = [];
  const entries = optionValue.split(',');

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(
        `Invalid format: "${trimmed}". Expected "pattern:purpose" (e.g., "**/*.ctx.md:Bound contexts")`
      );
    }

    const pathPart = trimmed.slice(0, colonIndex).trim();
    const purpose = trimmed.slice(colonIndex + 1).trim();

    if (!pathPart) {
      throw new Error(`Path cannot be empty in: "${trimmed}"`);
    }
    if (!purpose) {
      throw new Error(`Purpose cannot be empty in: "${trimmed}"`);
    }

    paths.push({ path: pathPart, purpose });
  }

  if (paths.length === 0) {
    throw new Error('At least one context path must be specified');
  }

  return paths;
}

/**
 * Interactive prompt for context paths (simplified Y/n)
 */
async function promptContextPaths(
  defaults: ContextPathConfig[]
): Promise<ContextPathConfig[]> {
  const { useDefaults } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useDefaults',
      message: 'Use default context paths?',
      default: true,
    },
  ]);

  if (useDefaults) {
    return defaults;
  }

  // User chose not to use defaults - start with empty config
  console.log(chalk.yellow('\nStarting with empty context paths.'));
  console.log(chalk.gray('Add patterns later with: ctx add-pattern <pattern> <purpose>\n'));
  return [];
}

/**
 * Display configured context paths after setup
 */
function displayConfiguredPaths(contextPaths: ContextPathConfig[]): void {
  if (contextPaths.length === 0) {
    console.log(chalk.gray('\nNo context paths configured.'));
    console.log(chalk.gray('Add patterns with: ctx add-pattern <pattern> <purpose>'));
    return;
  }

  console.log(chalk.green('\n✓ Context paths configured:'));
  for (const cp of contextPaths) {
    console.log(chalk.white(`    ${cp.path}`));
    console.log(chalk.gray(`      ${cp.purpose}`));
  }
  console.log(chalk.gray('\n  Tip: Change later with ctx add-pattern / ctx remove'));
}

export interface InitOptions {
  contextPaths?: string;
  yes?: boolean;
}

/**
 * Init command dispatcher
 * - ctx init → Global initialization (~/.ctx/)
 * - ctx init . → Project initialization ({project}/.ctx/)
 */
export async function initCommand(targetPath?: string, options?: InitOptions) {
  if (targetPath === '.') {
    return initProjectCommand(options);
  }
  return initGlobalCommand(options);
}

interface InternalInitOptions extends InitOptions {
  standalone?: boolean; // true when called directly, false when called from project init
}

/**
 * Initialize global context (~/.ctx/)
 */
async function initGlobalCommand(options?: InternalInitOptions) {
  const standalone = options?.standalone !== false;

  if (standalone) {
    console.log(chalk.blue.bold('\n🔧 Setting up ctx\n'));
  }

  try {
    const isInitialized = await isGlobalCtxInitialized();

    if (isInitialized) {
      console.log(chalk.yellow('⚠️  Global context is already initialized.'));

      if (!options?.yes) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to reinitialize?',
            default: false,
          },
        ]);

        if (!overwrite) {
          console.log(chalk.gray('Initialization cancelled.'));
          return;
        }
      } else {
        console.log(chalk.gray('Reinitializing (--yes flag)...'));
      }
    }

    // Determine context paths
    let contextPaths: ContextPathConfig[];
    if (options?.contextPaths) {
      contextPaths = parseContextPathsOption(options.contextPaths);
    } else if (options?.yes) {
      contextPaths = DEFAULT_GLOBAL_CONTEXT_PATHS;
    } else {
      contextPaths = await promptContextPaths(DEFAULT_GLOBAL_CONTEXT_PATHS);
    }

    // Create ~/.ctx/
    const globalCtxDir = getGlobalCtxDir();
    await fs.mkdir(globalCtxDir, { recursive: true });
    console.log(chalk.green(`✓ Created ${globalCtxDir}`));

    // Create base directories from glob patterns
    const dirsToCreate = new Set<string>();
    for (const cp of contextPaths) {
      // Extract base directory from glob pattern (e.g., 'contexts/**/*.md' → 'contexts/')
      const baseDir = cp.path.split('**')[0].replace(/\*.*$/, '').trim();
      if (baseDir && baseDir !== '') {
        dirsToCreate.add(baseDir);
      }
    }

    for (const dir of dirsToCreate) {
      const fullPath = path.join(globalCtxDir, dir);
      await fs.mkdir(fullPath, { recursive: true });
      console.log(chalk.green(`✓ Created ${fullPath}`));
    }

    // Create ~/.ctx/registry.yaml with settings
    const registry: UnifiedRegistry = {
      meta: {
        version: '2.0.0',
        last_synced: new Date().toISOString(),
      },
      settings: {
        context_paths: contextPaths,
      },
      contexts: {},
      index: {},
    };

    await fs.writeFile(
      path.join(globalCtxDir, REGISTRY_FILE),
      YAML.stringify(registry),
      'utf-8'
    );
    console.log(chalk.green(`✓ Created ${REGISTRY_FILE}`));

    // Display configured paths
    displayConfiguredPaths(contextPaths);

    if (standalone) {
      console.log(chalk.blue.bold('\n✨ Setup complete!\n'));

      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray('  1. Go to your project directory'));
      console.log(chalk.gray('  2. Run: ') + chalk.white('ctx init .'));
      console.log(chalk.gray('  3. Create context files and run: ') + chalk.white('ctx sync\n'));
    } else {
      console.log(chalk.green('✓ ctx setup complete'));
    }

  } catch (error) {
    console.error(chalk.red('Error during global initialization:'), error);
    process.exit(1);
  }
}

/**
 * Initialize project context ({project}/.ctx/)
 */
async function initProjectCommand(options?: InitOptions) {
  try {
    const projectRoot = process.cwd();

    // Check if global is initialized - if not, initialize it first
    const globalInitialized = await isGlobalCtxInitialized();
    if (!globalInitialized) {
      console.log(chalk.blue.bold('\n🔧 First-time setup required\n'));
      await initGlobalCommand({ ...options, standalone: false });
      console.log();
    }

    console.log(chalk.blue.bold('📁 Initializing Project\n'));

    // Check if project is already initialized
    const projectInitialized = await isProjectCtxInitialized(projectRoot);
    if (projectInitialized) {
      console.log(chalk.yellow('⚠️  Project context is already initialized.'));

      if (!options?.yes) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to reinitialize?',
            default: false,
          },
        ]);

        if (!overwrite) {
          console.log(chalk.gray('Initialization cancelled.'));
          return;
        }
      } else {
        console.log(chalk.gray('Reinitializing (--yes flag)...'));
      }
    }

    // Determine context paths
    let contextPaths: ContextPathConfig[];
    if (options?.contextPaths) {
      contextPaths = parseContextPathsOption(options.contextPaths);
    } else if (options?.yes) {
      contextPaths = DEFAULT_PROJECT_CONTEXT_PATHS;
    } else {
      contextPaths = await promptContextPaths(DEFAULT_PROJECT_CONTEXT_PATHS);
    }

    // Create .ctx/
    const ctxDir = path.join(projectRoot, CTX_DIR);
    await fs.mkdir(ctxDir, { recursive: true });
    console.log(chalk.green(`✓ Created ${CTX_DIR}/`));

    // Create base directories from glob patterns
    const dirsToCreate = new Set<string>();
    for (const cp of contextPaths) {
      // Extract base directory from glob pattern (e.g., '.ctx/contexts/**/*.md' → '.ctx/contexts/')
      const baseDir = cp.path.split('**')[0].replace(/\*.*$/, '').trim();
      if (baseDir && baseDir !== '' && !baseDir.startsWith('*')) {
        dirsToCreate.add(baseDir);
      }
    }

    for (const dir of dirsToCreate) {
      const fullPath = path.join(projectRoot, dir);
      await fs.mkdir(fullPath, { recursive: true });
      console.log(chalk.green(`✓ Created ${dir}`));
    }

    // Create .ctx/registry.yaml with settings
    const registry: UnifiedRegistry = {
      meta: {
        version: '2.0.0',
        last_synced: new Date().toISOString(),
      },
      settings: {
        context_paths: contextPaths,
      },
      contexts: {},
    };

    await fs.writeFile(
      path.join(ctxDir, REGISTRY_FILE),
      YAML.stringify(registry),
      'utf-8'
    );
    console.log(chalk.green(`✓ Created ${CTX_DIR}/${REGISTRY_FILE}`));

    // Display configured paths
    displayConfiguredPaths(contextPaths);

    console.log(chalk.blue.bold('\n✨ Project initialization complete!\n'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('  1. Create context files: ') + chalk.white('<filename>.ctx.md'));
    console.log(chalk.gray('  2. Run: ') + chalk.white('ctx sync\n'));

  } catch (error) {
    console.error(chalk.red('Error during project initialization:'), error);
    process.exit(1);
  }
}
