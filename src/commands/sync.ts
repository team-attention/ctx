import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import { fileExists, resolveTargetFromContext } from '../lib/fileUtils.js';
import {
  scanLocalContextsNew,
  scanProjectContexts,
} from '../lib/scanner.js';
import { parseContextFile, validateContextFile, extractPreviewFromLocal, extractPreviewFromGlobal } from '../lib/parser.js';
import { computeChecksum, computeFileChecksum } from '../lib/checksum.js';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  writeProjectRegistry,
  readGlobalCtxRegistry,
  writeGlobalCtxRegistry,
  updateGlobalIndex,
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
      when: ctx.preview.when || [],
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
 * Sync command for 3-level system
 */
async function syncCommandNew(projectRoot: string, options: ExtendedSyncOptions) {
  console.log(chalk.blue.bold('Syncing contexts...\n'));

  try {
    let localSynced = 0;
    let projectSynced = 0;
    const errors: string[] = [];

    // Sync local contexts (*.ctx.md files)
    console.log(chalk.blue('Syncing local contexts...'));
    try {
      localSynced = await syncLocalContextsNew(projectRoot);
      console.log(chalk.green(`✓ Synced ${localSynced} local context(s)`));
    } catch (error) {
      const errorMsg = `Failed to sync local contexts: ${error}`;
      errors.push(errorMsg);
      console.error(chalk.red(`✗ ${errorMsg}`));
    }

    // Sync project contexts (.ctx/contexts/)
    console.log(chalk.blue('Syncing project contexts...'));
    try {
      projectSynced = await syncProjectContextsNew(projectRoot);
      console.log(chalk.green(`✓ Synced ${projectSynced} project context(s)`));
    } catch (error) {
      const errorMsg = `Failed to sync project contexts: ${error}`;
      errors.push(errorMsg);
      console.error(chalk.red(`✗ ${errorMsg}`));
    }

    // Update global index
    const globalInitialized = await isGlobalCtxInitialized();
    if (globalInitialized) {
      console.log(chalk.blue('Updating global index...'));
      try {
        await updateGlobalIndex(projectRoot);
        console.log(chalk.green('✓ Updated global index'));
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Failed to update global index: ${error}`));
      }
    }

    // Summary
    console.log();
    console.log(chalk.blue.bold('Sync complete!'));
    console.log(chalk.gray(`  Local: ${localSynced}`));
    console.log(chalk.gray(`  Project: ${projectSynced}`));

    if (errors.length > 0) {
      console.log();
      console.log(chalk.yellow(`⚠️  ${errors.length} error(s) occurred during sync.`));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('✗ Error during sync:'), error);
    process.exit(1);
  }
}

/**
 * Sync local contexts to project registry
 */
async function syncLocalContextsNew(projectRoot: string): Promise<number> {
  const scannedContexts = await scanLocalContextsNew(projectRoot);
  const registry = await readProjectRegistry(projectRoot);

  for (const scanned of scannedContexts) {
    try {
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

      const targetPath = await resolveTargetFromContext(
        scanned.relativePath,
        contextFile.meta.target
      );

      const contextChecksum = computeChecksum(scanned.content);
      const stats = await fs.stat(scanned.contextPath);
      const lastModified = stats.mtime.toISOString();

      const absoluteTargetPath = path.join(projectRoot, targetPath.replace(/^\//, ''));
      const targetExists = await fileExists(absoluteTargetPath);
      let targetChecksum: string | undefined;

      if (targetExists) {
        targetChecksum = await computeFileChecksum(absoluteTargetPath);
      }

      const preview = extractPreviewFromLocal(contextFile);

      const entry: ContextEntry = {
        source: scanned.relativePath,
        target: targetPath,
        checksum: contextChecksum,
        target_checksum: targetChecksum,
        last_modified: lastModified,
        preview: preview,
      };

      registry.contexts[scanned.relativePath] = entry;
    } catch (error) {
      console.error(chalk.red(`✗ Error processing ${scanned.relativePath}: ${error}`));
    }
  }

  await writeProjectRegistry(projectRoot, registry);
  return scannedContexts.length;
}

/**
 * Sync project contexts from .ctx/contexts/ to registry
 */
async function syncProjectContextsNew(projectRoot: string): Promise<number> {
  const scannedContexts = await scanProjectContexts(projectRoot);
  const registry = await readProjectRegistry(projectRoot);

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
    } catch (error) {
      console.error(chalk.red(`✗ Error processing ${scanned.relativePath}: ${error}`));
    }
  }

  await writeProjectRegistry(projectRoot, registry);
  return scannedContexts.length;
}
