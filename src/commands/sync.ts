import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import { fileExists, getTargetFromFrontmatter } from '../lib/fileUtils.js';
import {
  scanProjectContexts,
  scanGlobalCtxContexts,
} from '../lib/scanner.js';
import { parseContextFile, validateContextFile, extractPreviewFromLocal, extractPreviewFromGlobal } from '../lib/parser.js';
import { computeChecksum, computeFileChecksum } from '../lib/checksum.js';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  writeProjectRegistryWithSync,
  readGlobalCtxRegistry,
  writeGlobalCtxRegistry,
} from '../lib/registry.js';
import { SyncOptions, ContextEntry, ProjectIndexEntry } from '../lib/types.js';

interface ExtendedSyncOptions extends SyncOptions {
  rebuildIndex?: boolean;
}

export async function syncCommand(options: ExtendedSyncOptions = {}) {
  // Handle --rebuild-index option (global index rebuild)
  if (options.rebuildIndex) {
    return rebuildGlobalIndex();
  }

  // Handle --global option (sync global contexts)
  if (options.global) {
    return syncGlobalContexts();
  }

  // Check if 3-level system is initialized
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    console.error(chalk.red('✗ Error: Project not initialized.'));
    console.log(chalk.gray("  Run 'ctx init .' first to initialize project context management."));
    process.exit(1);
  }

  return syncCommandNew(projectRoot, options);
}

/**
 * Sync global contexts (~/.ctx/) to global registry
 * Uses settings.context_paths from ~/.ctx/registry.yaml
 *
 * SoT: File system is the source of truth.
 * Registry is rebuilt from scratch on each sync.
 */
async function syncGlobalContexts(): Promise<void> {
  console.log(chalk.blue.bold('Syncing global contexts...\n'));

  const globalInitialized = await isGlobalCtxInitialized();
  if (!globalInitialized) {
    console.error(chalk.red('✗ Error: Global ctx not initialized.'));
    console.log(chalk.gray("  Run 'ctx init' first to initialize global context management."));
    process.exit(1);
  }

  try {
    // Use scanGlobalCtxContexts which reads ~/.ctx/registry.yaml settings.context_paths
    const scannedContexts = await scanGlobalCtxContexts();
    const registry = await readGlobalCtxRegistry();

    // Calculate what will be removed (for logging)
    const scannedPaths = new Set(scannedContexts.map(c => c.relativePath));
    const oldPaths = Object.keys(registry.contexts);
    const deletedPaths = oldPaths.filter(p => !scannedPaths.has(p));

    // Log deletions
    if (deletedPaths.length > 0) {
      console.log(chalk.gray('  Removed from registry:'));
      deletedPaths.forEach(p => console.log(chalk.gray(`    - ${p}`)));
      console.log();
    }

    // Clear contexts (rebuild from scratch)
    // SoT: File system scan result = registry state
    registry.contexts = {};

    let syncedCount = 0;
    for (const scanned of scannedContexts) {
      try {
        const preview = extractPreviewFromGlobal(scanned.content);

        if (!preview) {
          console.warn(
            chalk.yellow(
              `⚠️  Warning: ${scanned.relativePath} has no valid frontmatter. Skipping.`
            )
          );
          continue;
        }

        const contextChecksum = computeChecksum(scanned.content);
        const stats = await fs.stat(scanned.contextPath);
        const lastModified = stats.mtime.toISOString();

        const entry: ContextEntry = {
          source: scanned.relativePath,
          checksum: contextChecksum,
          last_modified: lastModified,
          preview: preview,
        };

        registry.contexts[scanned.relativePath] = entry;
        syncedCount++;
      } catch (error) {
        console.error(chalk.red(`✗ Error processing ${scanned.relativePath}: ${error}`));
      }
    }

    await writeGlobalCtxRegistry(registry);

    console.log(chalk.green(`✓ Synced ${syncedCount} global context(s)`));
  } catch (error) {
    console.error(chalk.red('✗ Error during global sync:'), error);
    process.exit(1);
  }
}

/**
 * Rebuild the global index by traversing all registered projects
 */
async function rebuildGlobalIndex(): Promise<void> {
  console.log(chalk.blue.bold('Rebuilding global index...\n'));

  const globalInitialized = await isGlobalCtxInitialized();
  if (!globalInitialized) {
    console.error(chalk.red('✗ Error: Global ctx not initialized.'));
    console.log(chalk.gray("  Run 'ctx init' first to initialize global context management."));
    process.exit(1);
  }

  const globalRegistry = await readGlobalCtxRegistry();

  if (!globalRegistry.index || Object.keys(globalRegistry.index).length === 0) {
    console.log(chalk.yellow('⚠️  No projects registered in global index.'));
    console.log(chalk.gray('  Use ctx sync inside a project to register it.'));
    return;
  }

  const newIndex: Record<string, ProjectIndexEntry> = {};
  let successCount = 0;
  let skipCount = 0;

  for (const [projectName, entry] of Object.entries(globalRegistry.index)) {
    const projectPath = entry.path;

    // Check if project directory exists
    try {
      await fs.access(projectPath);
    } catch {
      console.log(chalk.yellow(`⚠️  Skipped (not found): ${projectName} (${projectPath})`));
      skipCount++;
      continue;
    }

    // Check if project is still initialized
    const projectRegistry = await readProjectRegistry(projectPath);
    if (!projectRegistry || Object.keys(projectRegistry.contexts).length === 0) {
      console.log(chalk.yellow(`⚠️  Skipped (no contexts): ${projectName}`));
      skipCount++;
      continue;
    }

    // Rebuild index entry for this project
    const contexts = Object.entries(projectRegistry.contexts).map(([key, ctx]) => ({
      path: key,
      what: ctx.preview.what,
      keywords: ctx.preview.keywords || [],
    }));

    newIndex[projectName] = {
      path: projectPath,
      last_synced: new Date().toISOString(),
      context_count: contexts.length,
      contexts,
    };

    console.log(chalk.green(`✓ Rebuilt index for: ${projectName} (${contexts.length} contexts)`));
    successCount++;
  }

  globalRegistry.index = newIndex;
  await writeGlobalCtxRegistry(globalRegistry);

  console.log();
  console.log(chalk.blue.bold('Rebuild complete!'));
  console.log(chalk.gray(`  Rebuilt: ${successCount} project(s)`));
  console.log(chalk.gray(`  Skipped: ${skipCount} project(s)`));
}

/**
 * Sync command for project contexts
 * Scans all project contexts (*.ctx.md + .ctx/contexts/*.md) and updates registry
 */
async function syncCommandNew(projectRoot: string, options: ExtendedSyncOptions) {
  console.log(chalk.blue.bold('Syncing project contexts...\n'));

  try {
    // Sync all project contexts (unified scan)
    // Note: writeProjectRegistryWithSync automatically updates global index
    console.log(chalk.blue('Scanning contexts...'));
    const syncedCount = await syncProjectContextsToRegistry(projectRoot, options);
    console.log(chalk.green(`✓ Synced ${syncedCount} context(s)`));

    // Summary
    console.log();
    console.log(chalk.blue.bold('Sync complete!'));
    console.log(chalk.gray(`  Contexts: ${syncedCount}`));
  } catch (error) {
    console.error(chalk.red('✗ Error during sync:'), error);
    process.exit(1);
  }
}

/**
 * Sync all project contexts to registry
 * Handles both *.ctx.md files and .ctx/contexts/*.md
 *
 * SoT: File system is the source of truth.
 * Registry is updated based on scan results.
 * With --prune: entries not matching context_paths are removed
 * Without --prune: entries are kept but warned about
 */
async function syncProjectContextsToRegistry(projectRoot: string, options: ExtendedSyncOptions = {}): Promise<number> {
  const scannedContexts = await scanProjectContexts(projectRoot);
  const registry = await readProjectRegistry(projectRoot);

  // Calculate what will be removed (for logging)
  const scannedPaths = new Set(scannedContexts.map(c => c.relativePath));
  const oldPaths = Object.keys(registry.contexts);
  const unmatchedPaths = oldPaths.filter(p => !scannedPaths.has(p));

  // Handle unmatched paths based on prune option
  if (unmatchedPaths.length > 0) {
    if (options.prune) {
      // Remove unmatched entries
      console.log(chalk.gray('\n  Removed from registry:'));
      unmatchedPaths.forEach(p => console.log(chalk.gray(`    - ${p}`)));
      console.log();
    } else {
      // Warn but keep entries
      console.log(chalk.yellow('\n⚠️  Warning: These files are in registry but not matched by context_paths:'));
      unmatchedPaths.forEach(p => console.log(chalk.yellow(`  - ${p}`)));
      console.log();
      console.log(chalk.yellow('They are kept in registry for now.'));
      console.log(chalk.gray('To remove them, run: ') + chalk.white('ctx sync --prune'));
      console.log(chalk.gray('To keep them tracked, add matching pattern: ') + chalk.white('ctx add-pattern "<pattern>" "Description"'));
      console.log();
    }
  }

  // Clear or preserve contexts based on prune option
  const oldContexts = options.prune ? {} : { ...registry.contexts };
  registry.contexts = {};

  let syncedCount = 0;

  for (const scanned of scannedContexts) {
    try {
      // Try parsing as structured context file (with meta/frontmatter)
      const isCtxFile = scanned.relativePath.endsWith('.ctx.md') ||
                        scanned.relativePath.endsWith('/ctx.md');

      if (isCtxFile) {
        // Structured context file (*.ctx.md)
        const contextFile = parseContextFile(scanned.relativePath, scanned.content);
        const validation = validateContextFile(contextFile);

        if (!validation.valid) {
          console.warn(
            chalk.yellow(
              `⚠️  Warning: ${scanned.relativePath} has validation errors: ${validation.errors.join(', ')}`
            )
          );
          continue;
        }

        // SoT: frontmatter's target field (no inference from filename)
        const targetPath = getTargetFromFrontmatter(contextFile.meta.target);

        const contextChecksum = computeChecksum(scanned.content);
        const stats = await fs.stat(scanned.contextPath);
        const lastModified = stats.mtime.toISOString();

        // Only compute target checksum if target exists
        let targetChecksum: string | undefined;
        if (targetPath) {
          const absoluteTargetPath = path.join(projectRoot, targetPath.replace(/^\//, ''));
          const targetExists = await fileExists(absoluteTargetPath);
          if (targetExists) {
            targetChecksum = await computeFileChecksum(absoluteTargetPath);
          }
        }

        const preview = extractPreviewFromLocal(contextFile);

        const entry: ContextEntry = {
          source: scanned.relativePath,
          target: targetPath || undefined,
          checksum: contextChecksum,
          target_checksum: targetChecksum,
          last_modified: lastModified,
          preview: preview,
        };

        registry.contexts[scanned.relativePath] = entry;
      } else {
        // Centralized context file (.ctx/contexts/*.md) - frontmatter only
        const preview = extractPreviewFromGlobal(scanned.content);

        if (!preview) {
          console.warn(
            chalk.yellow(
              `⚠️  Warning: ${scanned.relativePath} has no valid frontmatter. Skipping.`
            )
          );
          continue;
        }

        const contextChecksum = computeChecksum(scanned.content);
        const stats = await fs.stat(scanned.contextPath);
        const lastModified = stats.mtime.toISOString();

        const entry: ContextEntry = {
          source: scanned.relativePath,
          checksum: contextChecksum,
          last_modified: lastModified,
          preview: preview,
        };

        registry.contexts[scanned.relativePath] = entry;
      }

      syncedCount++;
    } catch (error) {
      console.error(chalk.red(`✗ Error processing ${scanned.relativePath}: ${error}`));
    }
  }

  // Re-add preserved old contexts (if not pruning)
  if (!options.prune) {
    for (const [path, entry] of Object.entries(oldContexts)) {
      // Only add if not already scanned (to avoid duplicates)
      if (!scannedPaths.has(path)) {
        registry.contexts[path] = entry;
      }
    }
  }

  await writeProjectRegistryWithSync(projectRoot, registry);
  return syncedCount;
}

