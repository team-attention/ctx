import chalk from 'chalk';
import { glob } from 'glob';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  writeProjectRegistryWithSync,
  readGlobalCtxRegistry,
  writeGlobalCtxRegistry,
  getGlobalCtxDir,
} from '../lib/registry.js';

interface RemoveOptions {
  global?: boolean;
}

/**
 * Remove context files from registry (does NOT delete files)
 * Supports glob patterns
 */
export async function removeCommand(patterns: string[], options: RemoveOptions = {}) {
  try {
    if (options.global) {
      return removeFromGlobal(patterns);
    }
    return removeFromProject(patterns);
  } catch (error) {
    console.error(chalk.red('✗ Error:'), error);
    process.exit(1);
  }
}

/**
 * Remove context files from project registry
 */
async function removeFromProject(patterns: string[]) {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    console.error(chalk.red('✗ Not in a ctx project.'));
    console.log(chalk.gray('  Run: ') + chalk.white('ctx init .') + chalk.gray(' to initialize.'));
    process.exit(1);
  }

  console.log(chalk.blue('Removing contexts from project registry...\n'));
  console.log(chalk.gray('  (Note: files are NOT deleted, only unregistered)\n'));

  const registry = await readProjectRegistry(projectRoot);
  let removed = 0;
  let notFound = 0;

  for (const pattern of patterns) {
    // Match against registry keys
    const matchingKeys = Object.keys(registry.contexts).filter(key => {
      // Simple glob matching
      if (pattern.includes('*')) {
        const regexPattern = pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*');
        return new RegExp(`^${regexPattern}$`).test(key);
      }
      return key === pattern;
    });

    if (matchingKeys.length === 0) {
      console.log(chalk.yellow(`  not found: ${pattern}`));
      notFound++;
      continue;
    }

    for (const key of matchingKeys) {
      delete registry.contexts[key];
      console.log(chalk.green(`  remove: ${key}`));
      removed++;
    }
  }

  await writeProjectRegistryWithSync(projectRoot, registry);

  console.log();
  console.log(chalk.blue.bold('Done!'));
  console.log(chalk.gray(`  Removed: ${removed}`));
  console.log(chalk.gray(`  Not found: ${notFound}`));
}

/**
 * Remove context files from global registry
 */
async function removeFromGlobal(patterns: string[]) {
  const globalInitialized = await isGlobalCtxInitialized();

  if (!globalInitialized) {
    console.error(chalk.red('✗ Global context not initialized.'));
    console.log(chalk.gray('  Run: ') + chalk.white('ctx init') + chalk.gray(' first.'));
    process.exit(1);
  }

  console.log(chalk.blue('Removing contexts from global registry...\n'));
  console.log(chalk.gray('  (Note: files are NOT deleted, only unregistered)\n'));

  const registry = await readGlobalCtxRegistry();
  let removed = 0;
  let notFound = 0;

  for (const pattern of patterns) {
    // Match against registry keys
    const matchingKeys = Object.keys(registry.contexts).filter(key => {
      if (pattern.includes('*')) {
        const regexPattern = pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*');
        return new RegExp(`^${regexPattern}$`).test(key);
      }
      return key === pattern;
    });

    if (matchingKeys.length === 0) {
      console.log(chalk.yellow(`  not found: ${pattern}`));
      notFound++;
      continue;
    }

    for (const key of matchingKeys) {
      delete registry.contexts[key];
      console.log(chalk.green(`  remove: ${key}`));
      removed++;
    }
  }

  await writeGlobalCtxRegistry(registry);

  console.log();
  console.log(chalk.blue.bold('Done!'));
  console.log(chalk.gray(`  Removed: ${removed}`));
  console.log(chalk.gray(`  Not found: ${notFound}`));
}
