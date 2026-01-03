import chalk from 'chalk';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  writeProjectRegistry,
  readGlobalCtxRegistry,
  writeGlobalCtxRegistry,
} from '../lib/registry.js';
import { ContextPathConfig } from '../lib/types.js';

interface AddPatternOptions {
  global?: boolean;
}

/**
 * Add a glob pattern to context_paths in registry settings
 */
export async function addPatternCommand(
  pattern: string,
  purpose: string,
  options: AddPatternOptions = {}
) {
  try {
    if (options.global) {
      return addPatternToGlobal(pattern, purpose);
    }
    return addPatternToProject(pattern, purpose);
  } catch (error) {
    console.error(chalk.red('✗ Error:'), error);
    process.exit(1);
  }
}

/**
 * Add pattern to project registry
 */
async function addPatternToProject(pattern: string, purpose: string) {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    console.error(chalk.red('✗ Not in a ctx project.'));
    console.log(chalk.gray('  Run: ') + chalk.white('ctx init .') + chalk.gray(' to initialize.'));
    process.exit(1);
  }

  const registry = await readProjectRegistry(projectRoot);

  // Initialize settings if not present
  if (!registry.settings) {
    registry.settings = { context_paths: [] };
  }
  if (!registry.settings.context_paths) {
    registry.settings.context_paths = [];
  }

  // Check if pattern already exists
  const exists = registry.settings.context_paths.some(cp => cp.path === pattern);
  if (exists) {
    console.log(chalk.yellow(`⚠️  Pattern already exists: ${pattern}`));
    return;
  }

  // Add pattern
  const newPattern: ContextPathConfig = { path: pattern, purpose };
  registry.settings.context_paths.push(newPattern);

  await writeProjectRegistry(projectRoot, registry);

  console.log(chalk.green(`✓ Added pattern to context_paths`));
  console.log(chalk.gray(`  Pattern: ${pattern}`));
  console.log(chalk.gray(`  Purpose: ${purpose}`));
  console.log();
  console.log(chalk.blue('Next step:'));
  console.log(chalk.gray('  Run: ') + chalk.white('ctx sync') + chalk.gray(' to scan with new pattern'));
}

/**
 * Add pattern to global registry
 */
async function addPatternToGlobal(pattern: string, purpose: string) {
  const globalInitialized = await isGlobalCtxInitialized();

  if (!globalInitialized) {
    console.error(chalk.red('✗ Global context not initialized.'));
    console.log(chalk.gray('  Run: ') + chalk.white('ctx init') + chalk.gray(' first.'));
    process.exit(1);
  }

  const registry = await readGlobalCtxRegistry();

  // Initialize settings if not present
  if (!registry.settings) {
    registry.settings = { context_paths: [] };
  }
  if (!registry.settings.context_paths) {
    registry.settings.context_paths = [];
  }

  // Check if pattern already exists
  const exists = registry.settings.context_paths.some(cp => cp.path === pattern);
  if (exists) {
    console.log(chalk.yellow(`⚠️  Pattern already exists: ${pattern}`));
    return;
  }

  // Add pattern
  const newPattern: ContextPathConfig = { path: pattern, purpose };
  registry.settings.context_paths.push(newPattern);

  await writeGlobalCtxRegistry(registry);

  console.log(chalk.green(`✓ Added pattern to global context_paths`));
  console.log(chalk.gray(`  Pattern: ${pattern}`));
  console.log(chalk.gray(`  Purpose: ${purpose}`));
  console.log();
  console.log(chalk.blue('Next step:'));
  console.log(chalk.gray('  Run: ') + chalk.white('ctx sync --global') + chalk.gray(' to scan with new pattern'));
}
