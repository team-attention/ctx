import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import YAML from 'yaml';
import inquirer from 'inquirer';
import {
  isGlobalCtxInitialized,
  CTX_DIR,
  REGISTRY_FILE,
  CONTEXTS_DIR,
} from '../lib/registry.js';
import { fileExists } from '../lib/fileUtils.js';

/**
 * Migrate from legacy ctx structure to new 3-level structure
 * - ctx/ → .ctx/contexts/
 * - ctx.config.yaml → removed
 * - local-context-registry.yml + global-context-registry.yml → .ctx/registry.yaml
 */
export async function migrateCommand() {
  console.log(chalk.blue.bold('\n🔄 Migrating to 3-level context system\n'));

  try {
    const projectRoot = process.cwd();

    // Check if global is initialized
    const globalInitialized = await isGlobalCtxInitialized();
    if (!globalInitialized) {
      console.log(chalk.red('✗ Global context not initialized.'));
      console.log(chalk.gray('  Run: ') + chalk.white('ctx init') + chalk.gray(' first.'));
      process.exit(1);
    }

    // Check if legacy structure exists
    const legacyConfigPath = path.join(projectRoot, 'ctx.config.yaml');
    const legacyCtxDir = path.join(projectRoot, 'ctx');
    const newCtxDir = path.join(projectRoot, CTX_DIR);

    const hasLegacyConfig = await fileExists(legacyConfigPath);
    const hasLegacyDir = await fileExists(legacyCtxDir);
    const hasNewDir = await fileExists(newCtxDir);

    if (!hasLegacyConfig && !hasLegacyDir) {
      console.log(chalk.yellow('⚠️  No legacy structure found.'));
      console.log(chalk.gray('  Use ') + chalk.white('ctx init .') + chalk.gray(' to initialize new project.'));
      return;
    }

    if (hasNewDir) {
      console.log(chalk.yellow('⚠️  New .ctx/ directory already exists.'));
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Continue with migration? (existing .ctx/ will be preserved)',
          default: false,
        },
      ]);
      if (!proceed) {
        console.log(chalk.gray('Migration cancelled.'));
        return;
      }
    }

    console.log(chalk.gray('Legacy structure detected:'));
    if (hasLegacyConfig) console.log(chalk.gray('  - ctx.config.yaml'));
    if (hasLegacyDir) console.log(chalk.gray('  - ctx/'));
    console.log();

    // Confirm migration
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Proceed with migration?',
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(chalk.gray('Migration cancelled.'));
      return;
    }

    // Create .ctx/ directory
    await fs.mkdir(newCtxDir, { recursive: true });
    console.log(chalk.green(`✓ Created ${CTX_DIR}/`));

    // Create .ctx/contexts/ directory
    const contextsDir = path.join(newCtxDir, CONTEXTS_DIR);
    await fs.mkdir(contextsDir, { recursive: true });
    console.log(chalk.green(`✓ Created ${CTX_DIR}/${CONTEXTS_DIR}/`));

    // Migrate ctx/ content to .ctx/contexts/ (excluding registries and templates)
    if (hasLegacyDir) {
      const entries = await fs.readdir(legacyCtxDir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip registry files, templates, and non-markdown files
        if (
          entry.name.includes('-registry.yml') ||
          entry.name === 'templates' ||
          entry.name === 'README.md' ||
          entry.name === 'issues' ||
          entry.name === 'history.jsonl'
        ) {
          console.log(chalk.gray(`  skip: ${entry.name}`));
          continue;
        }

        const sourcePath = path.join(legacyCtxDir, entry.name);
        const destPath = path.join(contextsDir, entry.name);

        if (entry.isDirectory()) {
          // Copy directory recursively
          await copyDirectory(sourcePath, destPath);
          console.log(chalk.green(`  copy: ${entry.name}/ → ${CTX_DIR}/${CONTEXTS_DIR}/${entry.name}/`));
        } else if (entry.name.endsWith('.md')) {
          // Copy markdown files
          await fs.copyFile(sourcePath, destPath);
          console.log(chalk.green(`  copy: ${entry.name} → ${CTX_DIR}/${CONTEXTS_DIR}/${entry.name}`));
        }
      }
    }

    // Create new registry.yaml
    const newRegistry = {
      meta: {
        version: '2.0.0',
        last_synced: new Date().toISOString(),
      },
      contexts: {},
    };

    await fs.writeFile(
      path.join(newCtxDir, REGISTRY_FILE),
      YAML.stringify(newRegistry),
      'utf-8'
    );
    console.log(chalk.green(`✓ Created ${CTX_DIR}/${REGISTRY_FILE}`));

    // Clean up legacy files
    console.log(chalk.blue('\nCleaning up legacy files...'));

    // Remove .ctx.current if exists
    const ctxCurrentPath = path.join(projectRoot, '.ctx.current');
    if (await fileExists(ctxCurrentPath)) {
      await fs.unlink(ctxCurrentPath);
      console.log(chalk.green('  ✓ Removed .ctx.current'));
    }

    // Optionally remove legacy config
    const { removeConfig } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'removeConfig',
        message: 'Remove legacy ctx.config.yaml?',
        default: true,
      },
    ]);

    if (removeConfig && hasLegacyConfig) {
      await fs.unlink(legacyConfigPath);
      console.log(chalk.green('  ✓ Removed ctx.config.yaml'));
    }

    // Optionally remove legacy ctx directory
    const { removeCtxDir } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'removeCtxDir',
        message: 'Remove legacy ctx/ directory? (content has been migrated)',
        default: false,
      },
    ]);

    if (removeCtxDir && hasLegacyDir) {
      await fs.rm(legacyCtxDir, { recursive: true });
      console.log(chalk.green('  ✓ Removed ctx/'));
    }

    console.log(chalk.blue.bold('\n✨ Migration complete!\n'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('  1. Run: ') + chalk.white('ctx sync') + chalk.gray(' to rebuild registry'));
    console.log(chalk.gray('  2. Verify your contexts are working correctly'));
    console.log(chalk.gray('  3. Commit the changes\n'));

  } catch (error) {
    console.error(chalk.red('Error during migration:'), error);
    process.exit(1);
  }
}

/**
 * Copy directory recursively
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
