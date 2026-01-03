import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';
import { computeChecksum } from '../lib/checksum.js';
import { extractPreviewFromGlobal, parseContextFile } from '../lib/parser.js';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  writeProjectRegistry,
  readGlobalCtxRegistry,
  writeGlobalCtxRegistry,
  updateGlobalIndex,
  getGlobalCtxDir,
} from '../lib/registry.js';
import { ContextEntry } from '../lib/types.js';

interface AddOptions {
  global?: boolean;
}

/**
 * Add context files to registry
 * Supports glob patterns
 */
export async function addCommand(patterns: string[], options: AddOptions = {}) {
  try {
    if (options.global) {
      return addToGlobal(patterns);
    }
    return addToProject(patterns);
  } catch (error) {
    console.error(chalk.red('✗ Error:'), error);
    process.exit(1);
  }
}

/**
 * Add context files to project registry
 */
async function addToProject(patterns: string[]) {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    console.error(chalk.red('✗ Not in a ctx project.'));
    console.log(chalk.gray('  Run: ') + chalk.white('ctx init .') + chalk.gray(' to initialize.'));
    process.exit(1);
  }

  console.log(chalk.blue('Adding contexts to project...\n'));

  const registry = await readProjectRegistry(projectRoot);
  let added = 0;
  let skipped = 0;

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      absolute: false,
      ignore: ['node_modules/**', '.git/**'],
    });

    for (const file of files) {
      // Check if already registered
      if (registry.contexts[file]) {
        console.log(chalk.gray(`  skip: ${file} (already registered)`));
        skipped++;
        continue;
      }

      const absolutePath = path.join(projectRoot, file);

      // Verify file exists
      try {
        await fs.access(absolutePath);
      } catch {
        console.log(chalk.yellow(`  skip: ${file} (file not found)`));
        skipped++;
        continue;
      }

      // Read and validate
      const content = await fs.readFile(absolutePath, 'utf-8');
      const preview = extractPreviewFromGlobal(content);

      if (!preview) {
        console.log(chalk.yellow(`  skip: ${file} (no valid frontmatter)`));
        skipped++;
        continue;
      }

      const stats = await fs.stat(absolutePath);

      // Get target from frontmatter (if present → bound, if not → standalone)
      let target: string | undefined;
      try {
        const contextFile = parseContextFile(file, content);
        target = contextFile.meta.target;
      } catch {
        // No frontmatter or parse error → standalone
      }

      const entry: ContextEntry = {
        source: file,
        target,
        checksum: computeChecksum(content),
        last_modified: stats.mtime.toISOString(),
        preview,
      };

      registry.contexts[file] = entry;
      console.log(chalk.green(`  add: ${file}${target ? ` → ${target}` : ''}`));
      added++;
    }
  }

  await writeProjectRegistry(projectRoot, registry);

  // Update global index
  const globalInitialized = await isGlobalCtxInitialized();
  if (globalInitialized) {
    await updateGlobalIndex(projectRoot);
  }

  console.log();
  console.log(chalk.blue.bold('Done!'));
  console.log(chalk.gray(`  Added: ${added}`));
  console.log(chalk.gray(`  Skipped: ${skipped}`));
}

/**
 * Add context files to global registry
 */
async function addToGlobal(patterns: string[]) {
  const globalInitialized = await isGlobalCtxInitialized();

  if (!globalInitialized) {
    console.error(chalk.red('✗ Global context not initialized.'));
    console.log(chalk.gray('  Run: ') + chalk.white('ctx init') + chalk.gray(' first.'));
    process.exit(1);
  }

  console.log(chalk.blue('Adding contexts to global...\n'));

  const registry = await readGlobalCtxRegistry();
  let added = 0;
  let skipped = 0;

  for (const pattern of patterns) {
    // For global, resolve relative to home directory or absolute
    const baseDir = pattern.startsWith('/') ? '/' : getGlobalCtxDir();
    const resolvedPattern = pattern.startsWith('/') ? pattern : path.join(getGlobalCtxDir(), pattern);

    const files = await glob(resolvedPattern, {
      absolute: true,
    });

    for (const absolutePath of files) {
      const relativePath = absolutePath.startsWith(getGlobalCtxDir())
        ? path.relative(getGlobalCtxDir(), absolutePath)
        : absolutePath;

      // Check if already registered
      if (registry.contexts[relativePath]) {
        console.log(chalk.gray(`  skip: ${relativePath} (already registered)`));
        skipped++;
        continue;
      }

      // Read and validate
      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        const preview = extractPreviewFromGlobal(content);

        if (!preview) {
          console.log(chalk.yellow(`  skip: ${relativePath} (no valid frontmatter)`));
          skipped++;
          continue;
        }

        const stats = await fs.stat(absolutePath);

        const entry: ContextEntry = {
          source: relativePath,
          checksum: computeChecksum(content),
          last_modified: stats.mtime.toISOString(),
          preview,
        };

        registry.contexts[relativePath] = entry;
        console.log(chalk.green(`  add: ${relativePath}`));
        added++;
      } catch (error) {
        console.log(chalk.yellow(`  skip: ${relativePath} (${error})`));
        skipped++;
      }
    }
  }

  await writeGlobalCtxRegistry(registry);

  console.log();
  console.log(chalk.blue.bold('Done!'));
  console.log(chalk.gray(`  Added: ${added}`));
  console.log(chalk.gray(`  Skipped: ${skipped}`));
}
