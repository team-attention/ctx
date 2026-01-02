import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import YAML from 'yaml';
import { getPlatform, isPlatformSupported } from '../lib/platforms/index.js';
import { createConfigFile } from '../lib/config.js';
import { addToGitignore, isGlobalInitialized } from '../lib/fileUtils.js';
import {
  CTX_DIR,
  REGISTRY_FILE,
  CONTEXTS_DIR,
  GLOBAL_CTX_DIR,
  isGlobalCtxInitialized,
  isProjectCtxInitialized,
} from '../lib/registry.js';
import { ContextPathConfig, UnifiedRegistry } from '../lib/types.js';

/** Default context paths for Global */
const DEFAULT_GLOBAL_CONTEXT_PATHS: ContextPathConfig[] = [
  { path: 'contexts/', purpose: 'General context documents' },
];

/** Default context paths for Project */
const DEFAULT_PROJECT_CONTEXT_PATHS: ContextPathConfig[] = [
  { path: '.ctx/contexts/', purpose: 'Project-specific context' },
];

/**
 * Parse --context-paths CLI option
 * Format: "path1:purpose1,path2:purpose2"
 * Example: "contexts/:General,rules/:Coding rules"
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
        `Invalid format: "${trimmed}". Expected "path:purpose" (e.g., "contexts/:General context")`
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

  console.log(chalk.gray('\nContext paths define where context files are stored.'));
  console.log(chalk.gray('Format: path:purpose (comma-separated for multiple)'));
  console.log(chalk.gray(`Example: contexts/:General context,rules/:Coding rules\n`));

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
      // Non-interactive mode: parse CLI option
      contextPaths = parseContextPathsOption(options.contextPaths);
    } else if (options?.yes) {
      // --yes flag: use defaults without prompting
      contextPaths = DEFAULT_GLOBAL_CONTEXT_PATHS;
    } else {
      // Interactive mode: prompt user
      contextPaths = await promptContextPaths('global', DEFAULT_GLOBAL_CONTEXT_PATHS);
    }

    // Create ~/.ctx/
    await fs.mkdir(GLOBAL_CTX_DIR, { recursive: true });
    console.log(chalk.green(`✓ Created ${GLOBAL_CTX_DIR}`));

    // Create directories for each context path
    for (const cp of contextPaths) {
      const fullPath = path.join(GLOBAL_CTX_DIR, cp.path);
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
      path.join(GLOBAL_CTX_DIR, REGISTRY_FILE),
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

    // Plugin installation guidance
    console.log(chalk.yellow.bold('📦 Claude Code Plugin Installation\n'));
    console.log(chalk.gray('  For automatic context loading, install the CTX plugin:'));
    console.log(chalk.white('    claude plugins install ctx'));
    console.log(chalk.gray('\n  Or manually link:'));
    console.log(chalk.white('    ln -s $(npm root -g)/ctx/plugin ~/.claude/plugins/ctx'));
    console.log('');

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

    // Check if global is initialized
    const globalInitialized = await isGlobalCtxInitialized();
    if (!globalInitialized) {
      console.log(chalk.red('✗ Global context is not initialized.'));
      console.log(chalk.gray('  Run: ') + chalk.white('ctx init') + chalk.gray(' first to initialize global context.'));
      process.exit(1);
    }

    // Check if project is already initialized (new format)
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
      // Non-interactive mode: parse CLI option
      contextPaths = parseContextPathsOption(options.contextPaths);
    } else if (options?.yes) {
      // --yes flag: use defaults without prompting
      contextPaths = DEFAULT_PROJECT_CONTEXT_PATHS;
    } else {
      // Interactive mode: prompt user
      contextPaths = await promptContextPaths('project', DEFAULT_PROJECT_CONTEXT_PATHS);
    }

    // Create .ctx/
    const ctxDir = path.join(projectRoot, CTX_DIR);
    await fs.mkdir(ctxDir, { recursive: true });
    console.log(chalk.green(`✓ Created ${CTX_DIR}/`));

    // Create directories for each context path
    for (const cp of contextPaths) {
      const fullPath = path.join(projectRoot, cp.path);
      await fs.mkdir(fullPath, { recursive: true });
      console.log(chalk.green(`✓ Created ${cp.path}`));
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

    // Install AI commands (Claude Code)
    const platform = getPlatform('claude-code');
    await platform.install();

    // Install hooks
    if ('installHooks' in platform) {
      await (platform as any).installHooks();
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

// ===== Legacy Init Command (backward compatibility) =====

export async function initCommandLegacy() {
  console.log(chalk.blue.bold('\n🚀 Initializing Context-Driven Development\n'));

  try {
    const projectRoot = process.cwd();
    const configPath = path.join(projectRoot, 'ctx.config.yaml');

    // Check if config exists to determine initialization status
    const configExists = await fileExists(configPath);

    if (configExists) {
      console.log(chalk.yellow('⚠️  Context management is already initialized in this directory.'));

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
    }

    // Ask which code editor
    const { editor } = await inquirer.prompt([
      {
        type: 'list',
        name: 'editor',
        message: 'Which code editor are you using?',
        choices: [
          { name: 'Claude Code', value: 'claude-code' },
          { name: 'Other (coming soon)', value: 'other', disabled: true },
        ],
        default: 'claude-code',
      },
    ]);

    // Write ctx.config.yaml with full config structure
    await createConfigFile(projectRoot, { editor });
    console.log(chalk.green('✓ Created ctx.config.yaml'));

    // Load config to get global directory setting
    const { loadConfig } = await import('../lib/config.js');
    const config = await loadConfig(projectRoot);
    const globalDirPath = path.join(projectRoot, config.global.directory);

    // Create global context directory
    await fs.mkdir(globalDirPath, { recursive: true });
    console.log(chalk.green(`✓ Created ${config.global.directory} directory`));

    // Create templates directory and copy all template files
    const templatesDir = path.join(globalDirPath, 'templates');
    const packageTemplatesDir = path.join(__dirname, '..', 'templates');

    try {
      // Copy entire templates directory (excluding ai-commands subdirectory)
      await copyTemplates(packageTemplatesDir, templatesDir);
      console.log(chalk.green(`✓ Copied template files to ${config.global.directory}/templates/`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Warning: Could not copy template files: ${error}`));
    }

    // Create registry files
    const localRegistry = {
      version: '1.0.0',
      last_synced: new Date().toISOString(),
      contexts: {},
    };

    const globalRegistry = {
      version: '1.0.0',
      last_synced: new Date().toISOString(),
      contexts: {},
    };

    await fs.writeFile(
      path.join(globalDirPath, 'local-context-registry.yml'),
      YAML.stringify(localRegistry),
      'utf-8'
    );
    console.log(chalk.green('✓ Created local-context-registry.yml'));

    await fs.writeFile(
      path.join(globalDirPath, 'global-context-registry.yml'),
      YAML.stringify(globalRegistry),
      'utf-8'
    );
    console.log(chalk.green('✓ Created global-context-registry.yml'));

    // Create README in global directory
    const readmeContent = `# Context Directory

This directory contains project-wide context documentation.

## Registries

- \`local-context-registry.yml\` - Index of all local context files (*.ctx.md)
- \`global-context-registry.yml\` - Index of all global context files (${config.global.directory}/**/*.md)

These registries are auto-generated. Do not edit manually.

## Templates

The \`templates/\` directory contains template files for creating contexts:

- \`local-context.md\` - Template for local context files (*.ctx.md)
- \`global-context.md\` - Template for global context documents

**Customization**: You can modify these templates to fit your project's needs. The \`ctx create\` command will use your customized templates automatically.

## Recommended Structure

You can organize your context files however you like. Here are some common patterns:

- \`architecture/\` - Architecture documentation
- \`rules/\` - Development rules and guidelines
- \`stories/\` - Feature stories and specifications

Feel free to create your own structure that fits your project needs.
`;

    await fs.writeFile(path.join(globalDirPath, 'README.md'), readmeContent, 'utf-8');
    console.log(chalk.green(`✓ Created ${config.global.directory}/README.md`));

    // Install AI commands for the selected platform
    if (isPlatformSupported(editor)) {
      const platform = getPlatform(editor);
      await platform.install();

      // Install hooks if platform supports it (Claude Code)
      if (editor === 'claude-code' && 'installHooks' in platform) {
        await (platform as any).installHooks();
      }
    }

    // Add history.jsonl to .gitignore
    const globalDir = config.global?.directory || 'ctx';
    const historyAdded = await addToGitignore(projectRoot, `${globalDir}/history.jsonl`);
    if (historyAdded) {
      console.log(chalk.green(`✓ Added ${globalDir}/history.jsonl to .gitignore`));
    }

    console.log(chalk.blue.bold('\n✨ Initialization complete!\n'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('  1. Create your first context file: ') + chalk.white('<filename>.ctx.md'));
    console.log(chalk.gray('  2. Run: ') + chalk.white('ctx sync'));
    console.log(chalk.gray('  3. Learn more: ') + chalk.white('ctx --help\n'));

  } catch (error) {
    console.error(chalk.red('Error during initialization:'), error);
    process.exit(1);
  }
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy template files from package to project ctx/templates/
 * Excludes ai-commands subdirectory
 */
async function copyTemplates(sourceDir: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    // Skip ai-commands directory
    if (entry.isDirectory() && entry.name === 'ai-commands') {
      continue;
    }

    if (entry.name === "ctx.config.yaml") {
      continue;
    }


    if (entry.isFile()) {
      await fs.copyFile(sourcePath, destPath);
    }
  }
}
