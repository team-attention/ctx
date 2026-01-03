import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import YAML from 'yaml';
import { getPlatform } from '../lib/platforms/index.js';
import {
  CTX_DIR,
  REGISTRY_FILE,
  getGlobalCtxDir,
  isGlobalCtxInitialized,
  isProjectCtxInitialized,
} from '../lib/registry.js';
import { ContextPathConfig, UnifiedRegistry } from '../lib/types.js';

/** Default context paths for Global */
const DEFAULT_GLOBAL_CONTEXT_PATHS: ContextPathConfig[] = [
  { path: 'contexts/**/*.md', purpose: 'General context documents' },
];

/** Default context paths for Project */
const DEFAULT_PROJECT_CONTEXT_PATHS: ContextPathConfig[] = [
  { path: '**/*.ctx.md', purpose: 'Bound contexts next to code' },
  { path: '.ctx/contexts/**/*.md', purpose: 'Centralized project contexts' },
];

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
 * Interactive prompt for context paths
 */
async function promptContextPaths(
  scope: 'global' | 'project',
  defaults: ContextPathConfig[]
): Promise<ContextPathConfig[]> {
  const defaultStr = defaults.map((cp) => `${cp.path}:${cp.purpose}`).join(', ');

  console.log(chalk.gray('\nContext paths define glob patterns for context files.'));
  console.log(chalk.gray('Format: pattern:purpose (comma-separated for multiple)'));
  console.log(chalk.gray(`Example: contexts/**/*.md:General context,**/*.ctx.md:Bound contexts\n`));

  const { contextPathsInput } = await inquirer.prompt([
    {
      type: 'input',
      name: 'contextPathsInput',
      message: `Context paths for ${scope}:`,
      default: defaultStr,
      validate: (input: string) => {
        try {
          parseContextPathsOption(input);
          return true;
        } catch (error) {
          return (error as Error).message;
        }
      },
    },
  ]);

  return parseContextPathsOption(contextPathsInput);
}

export interface InitOptions {
  contextPaths?: string;
  yes?: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Initialize global context (~/.ctx/)
 */
async function initGlobalCommand(options?: InitOptions) {
  console.log(chalk.blue.bold('\n🌍 Initializing Global Context\n'));

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
      contextPaths = await promptContextPaths('global', DEFAULT_GLOBAL_CONTEXT_PATHS);
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
    console.log(chalk.gray('\nConfigured context paths:'));
    for (const cp of contextPaths) {
      console.log(chalk.gray(`  - ${cp.path}: ${cp.purpose}`));
    }

    console.log(chalk.blue.bold('\n✨ Global initialization complete!\n'));

    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('  1. Go to your project directory'));
    console.log(chalk.gray('  2. Run: ') + chalk.white('ctx init .'));
    console.log(chalk.gray('  3. Create context files and run: ') + chalk.white('ctx sync\n'));

  } catch (error) {
    console.error(chalk.red('Error during global initialization:'), error);
    process.exit(1);
  }
}

/**
 * Initialize project context ({project}/.ctx/)
 */
async function initProjectCommand(options?: InitOptions) {
  console.log(chalk.blue.bold('\n📁 Initializing Project Context\n'));

  try {
    const projectRoot = process.cwd();

    // Check if global is initialized (optional now)
    const globalInitialized = await isGlobalCtxInitialized();
    if (!globalInitialized) {
      console.log(chalk.yellow('⚠️  Global context is not initialized.'));
      console.log(chalk.gray('  Consider running: ') + chalk.white('ctx init') + chalk.gray(' for global context.'));
      console.log();
    }

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
      contextPaths = await promptContextPaths('project', DEFAULT_PROJECT_CONTEXT_PATHS);
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
    console.log(chalk.gray('\nConfigured context paths:'));
    for (const cp of contextPaths) {
      console.log(chalk.gray(`  - ${cp.path}: ${cp.purpose}`));
    }

    // Try to install AI commands (Claude Code)
    try {
      const platform = getPlatform('claude-code');
      await platform.install();

      if ('installHooks' in platform) {
        await (platform as any).installHooks();
      }
    } catch {
      // Platform installation is optional
    }

    console.log(chalk.blue.bold('\n✨ Project initialization complete!\n'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('  1. Create context files: ') + chalk.white('<filename>.ctx.md'));
    console.log(chalk.gray('  2. Or add to configured paths'));
    console.log(chalk.gray('  3. Run: ') + chalk.white('ctx sync\n'));

  } catch (error) {
    console.error(chalk.red('Error during project initialization:'), error);
    process.exit(1);
  }
}
