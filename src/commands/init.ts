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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Init command dispatcher
 * - ctx init → Global initialization (~/.ctx/)
 * - ctx init . → Project initialization ({project}/.ctx/)
 */
export async function initCommand(targetPath?: string) {
  if (targetPath === '.') {
    return initProjectCommand();
  }
  return initGlobalCommand();
}

/**
 * Initialize global context (~/.ctx/)
 */
async function initGlobalCommand() {
  console.log(chalk.blue.bold('\n🌍 Initializing Global Context\n'));

  try {
    const isInitialized = await isGlobalCtxInitialized();

    if (isInitialized) {
      console.log(chalk.yellow('⚠️  Global context is already initialized.'));

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

    // Create ~/.ctx/
    await fs.mkdir(GLOBAL_CTX_DIR, { recursive: true });
    console.log(chalk.green(`✓ Created ${GLOBAL_CTX_DIR}`));

    // Create ~/.ctx/contexts/
    const contextsDir = path.join(GLOBAL_CTX_DIR, CONTEXTS_DIR);
    await fs.mkdir(contextsDir, { recursive: true });
    console.log(chalk.green(`✓ Created ${contextsDir}`));

    // Create ~/.ctx/registry.yaml
    const registry = {
      meta: {
        version: '2.0.0',
        last_synced: new Date().toISOString(),
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
async function initProjectCommand() {
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

    // Create .ctx/
    const ctxDir = path.join(projectRoot, CTX_DIR);
    await fs.mkdir(ctxDir, { recursive: true });
    console.log(chalk.green(`✓ Created ${CTX_DIR}/`));

    // Create .ctx/contexts/
    const contextsDir = path.join(ctxDir, CONTEXTS_DIR);
    await fs.mkdir(contextsDir, { recursive: true });
    console.log(chalk.green(`✓ Created ${CTX_DIR}/${CONTEXTS_DIR}/`));

    // Create .ctx/registry.yaml
    const registry = {
      meta: {
        version: '2.0.0',
        last_synced: new Date().toISOString(),
      },
      contexts: {},
    };

    await fs.writeFile(
      path.join(ctxDir, REGISTRY_FILE),
      YAML.stringify(registry),
      'utf-8'
    );
    console.log(chalk.green(`✓ Created ${CTX_DIR}/${REGISTRY_FILE}`));

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
    console.log(chalk.gray('  2. Or add to: ') + chalk.white('.ctx/contexts/'));
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
