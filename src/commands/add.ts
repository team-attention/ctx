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
import { ContextEntry, ContextPathConfig } from '../lib/types.js';
import {
  matchesContextPaths,
  getProjectContextPaths,
  getGlobalContextPaths,
} from '../lib/context-path-matcher.js';
import { syncCommand } from './sync.js';

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
  const contextPaths = await getProjectContextPaths(projectRoot);

  let added = 0;
  let skipped = 0;
  let patternsAdded = 0;

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

      // Check if file matches context_paths
      const matches = matchesContextPaths(file, contextPaths);
      if (!matches) {
        // Auto-add to context_paths
        if (!registry.settings) {
          registry.settings = { context_paths: [] };
        }
        if (!registry.settings.context_paths) {
          registry.settings.context_paths = [];
        }

        const newPattern: ContextPathConfig = {
          path: file,
          purpose: 'Added via ctx add'
        };
        registry.settings.context_paths.push(newPattern);
        contextPaths.push(newPattern); // Update local array too
        patternsAdded++;

        console.log(chalk.blue(`  ℹ️  Added '${file}' to context_paths`));
      }

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

  console.log();
  console.log(chalk.blue.bold('Summary:'));
  console.log(chalk.gray(`  Added: ${added}`));
  console.log(chalk.gray(`  Skipped: ${skipped}`));
  if (patternsAdded > 0) {
    console.log(chalk.blue(`  Patterns added to context_paths: ${patternsAdded}`));
  }

  // Auto-sync to apply new patterns
  if (patternsAdded > 0) {
    console.log();
    console.log(chalk.blue('Running sync to apply new patterns...'));
    await syncCommand({ global: false });
  }

  // Update global index
  const globalInitialized = await isGlobalCtxInitialized();
  if (globalInitialized) {
    await updateGlobalIndex(projectRoot);
  }
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
  const contextPaths = await getGlobalContextPaths();

  let added = 0;
  let skipped = 0;
  let patternsAdded = 0;

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

        // Check if file matches context_paths
        const matches = matchesContextPaths(relativePath, contextPaths);
        if (!matches) {
          // Auto-add to context_paths
          if (!registry.settings) {
            registry.settings = { context_paths: [] };
          }
          if (!registry.settings.context_paths) {
            registry.settings.context_paths = [];
          }

          const newPattern: ContextPathConfig = {
            path: relativePath,
            purpose: 'Added via ctx add'
          };
          registry.settings.context_paths.push(newPattern);
          contextPaths.push(newPattern); // Update local array too
          patternsAdded++;

          console.log(chalk.blue(`  ℹ️  Added '${relativePath}' to context_paths`));
        }

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
  console.log(chalk.blue.bold('Summary:'));
  console.log(chalk.gray(`  Added: ${added}`));
  console.log(chalk.gray(`  Skipped: ${skipped}`));
  if (patternsAdded > 0) {
    console.log(chalk.blue(`  Patterns added to context_paths: ${patternsAdded}`));
  }

  // Auto-sync to apply new patterns
  if (patternsAdded > 0) {
    console.log();
    console.log(chalk.blue('Running sync to apply new patterns...'));
    await syncCommand({ global: true });
  }
}
