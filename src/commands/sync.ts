import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import { isProjectInitialized, fileExists, resolveTargetFromContext } from '../lib/fileUtils.js';
import {
  scanLocalContexts,
  scanGlobalContexts,
  extractFolder,
  scanLocalContextsNew,
  scanProjectContexts,
  scanGlobalCtxContexts,
} from '../lib/scanner.js';
import { parseContextFile, validateContextFile, extractPreviewFromLocal, extractPreviewFromGlobal } from '../lib/parser.js';
import { computeChecksum, computeFileChecksum } from '../lib/checksum.js';
import {
  readLocalRegistry,
  writeLocalRegistry,
  readGlobalRegistry,
  writeGlobalRegistry,
  findProjectRoot,
  isProjectCtxInitialized,
  isGlobalCtxInitialized,
  readProjectRegistry,
  writeProjectRegistry,
  readGlobalCtxRegistry,
  writeGlobalCtxRegistry,
  updateGlobalIndex,
} from '../lib/registry.js';
import { SyncOptions, LocalContextEntry, GlobalContextEntry, ContextEntry, ProjectIndexEntry } from '../lib/types.js';
import { loadConfig } from '../lib/config.js';

interface ExtendedSyncOptions extends SyncOptions {
  rebuildIndex?: boolean;
}

export async function syncCommand(options: ExtendedSyncOptions = {}) {
  // Handle --rebuild-index option (global index rebuild)
  if (options.rebuildIndex) {
    return rebuildGlobalIndex();
  }

  // Check if new 3-level system is initialized
  const projectRoot = await findProjectRoot();

  if (projectRoot) {
    // New 3-level system
    return syncCommandNew(projectRoot, options);
  }

  // Fall back to legacy system
  return syncCommandLegacy(options);
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
 * New 3-level sync command
 */
async function syncCommandNew(projectRoot: string, options: ExtendedSyncOptions) {
  console.log(chalk.blue.bold('Syncing (3-level system)...\n'));

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
 * Sync local contexts to project registry (new format)
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
      const stats = await import('fs/promises').then((fs) => fs.stat(scanned.contextPath));
      const lastModified = stats.mtime.toISOString();

      const absoluteTargetPath = path.join(projectRoot, targetPath.replace(/^\//, ''));
      const targetExists = await fileExists(absoluteTargetPath);
      let targetChecksum: string | undefined;

      if (targetExists) {
        targetChecksum = await computeFileChecksum(absoluteTargetPath);
      }

      const preview = extractPreviewFromLocal(contextFile);

      const entry: ContextEntry = {
        scope: 'local',
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
 * Sync project contexts from .ctx/contexts/ to registry (new format)
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
      const stats = await import('fs/promises').then((fs) => fs.stat(scanned.contextPath));
      const lastModified = stats.mtime.toISOString();

      const entry: ContextEntry = {
        scope: 'project',
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

// ===== Legacy Sync Command =====

async function syncCommandLegacy(options: SyncOptions = {}) {
  try {
    // Check if project is initialized
    const initialized = await isProjectInitialized();
    if (!initialized) {
      console.error(chalk.red('✗ Error: Project not initialized.'));
      console.log(chalk.gray("  Run 'ctx init' first to initialize context management."));
      process.exit(1);
    }

    const projectRoot = process.cwd();

    // Determine what to sync
    const syncLocal = options.local || (!options.local && !options.global); // Default: sync both
    const syncGlobal = options.global || (!options.local && !options.global);

    let localSynced = 0;
    let globalSynced = 0;
    const errors: string[] = [];

    // Sync local contexts
    if (syncLocal) {
      console.log(chalk.blue('Syncing local contexts...'));
      try {
        localSynced = await syncLocalContexts(projectRoot);
        console.log(chalk.green(`✓ Synced ${localSynced} local context(s)`));
      } catch (error) {
        const errorMsg = `Failed to sync local contexts: ${error}`;
        errors.push(errorMsg);
        console.error(chalk.red(`✗ ${errorMsg}`));
      }
    }

    // Sync global contexts
    if (syncGlobal) {
      console.log(chalk.blue('Syncing global contexts...'));
      try {
        globalSynced = await syncGlobalContexts(projectRoot);
        console.log(chalk.green(`✓ Synced ${globalSynced} global context(s)`));
      } catch (error) {
        const errorMsg = `Failed to sync global contexts: ${error}`;
        errors.push(errorMsg);
        console.error(chalk.red(`✗ ${errorMsg}`));
      }
    }

    // Summary
    console.log();
    console.log(chalk.blue.bold('Sync complete!'));
    console.log(chalk.gray(`  Local: ${localSynced}`));
    console.log(chalk.gray(`  Global: ${globalSynced}`));

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
 * Sync local contexts
 */
async function syncLocalContexts(projectRoot: string): Promise<number> {
  // Load config
  const config = await loadConfig(projectRoot);

  // Scan for context files
  const scannedContexts = await scanLocalContexts(projectRoot, config);

  // Read existing registry
  const registry = await readLocalRegistry(projectRoot);

  // Process each context file
  for (const scanned of scannedContexts) {
    try {
      // Parse context file
      const contextFile = parseContextFile(scanned.relativePath, scanned.content);

      // Validate context file
      const validation = validateContextFile(contextFile);
      if (!validation.valid) {
        console.warn(
          chalk.yellow(
            `⚠️  Warning: ${scanned.relativePath} has validation errors: ${validation.errors.join(', ')}`
          )
        );
        continue; // Skip invalid context files
      }

      // Resolve target path (explicit or inferred)
      const targetPath = await resolveTargetFromContext(
        scanned.relativePath,
        contextFile.meta.target
      );

      // Compute context file checksum
      const contextChecksum = computeChecksum(scanned.content);

      // Get file stats
      const stats = await import('fs/promises').then((fs) => fs.stat(scanned.contextPath));
      const lastModified = stats.mtime.toISOString();

      // Check if target file exists and compute checksum
      const absoluteTargetPath = path.join(projectRoot, targetPath.replace(/^\//, ''));
      const targetExists = await fileExists(absoluteTargetPath);
      let targetChecksum = '';

      if (targetExists) {
        targetChecksum = await computeFileChecksum(absoluteTargetPath);
      } else {
        console.warn(chalk.yellow(`⚠️  Warning: Target file not found: ${targetPath}`));
      }

      // Extract preview
      const preview = extractPreviewFromLocal(contextFile);

      // Create registry entry
      const entry: LocalContextEntry = {
        type: 'file',
        source: scanned.relativePath,
        checksum: contextChecksum,
        target_checksum: targetChecksum,
        last_modified: lastModified,
        preview: preview,
      };

      // Update registry
      registry.contexts[targetPath] = entry;
    } catch (error) {
      console.error(chalk.red(`✗ Error processing ${scanned.relativePath}: ${error}`));
    }
  }

  // Write updated registry
  await writeLocalRegistry(projectRoot, registry);

  return scannedContexts.length;
}

/**
 * Sync global contexts
 */
async function syncGlobalContexts(projectRoot: string): Promise<number> {
  // Load config
  const config = await loadConfig(projectRoot);

  // Scan for context files
  const scannedContexts = await scanGlobalContexts(projectRoot, config);

  // Read existing registry
  const registry = await readGlobalRegistry(projectRoot);

  // Clear existing contexts (we'll rebuild)
  registry.contexts = {};

  // Process each context file
  for (const scanned of scannedContexts) {
    try {
      // Extract preview from frontmatter
      const preview = extractPreviewFromGlobal(scanned.content);

      if (!preview) {
        console.warn(
          chalk.yellow(
            `⚠️  Warning: ${scanned.relativePath} has no valid frontmatter (missing 'when' or 'what'). Skipping.`
          )
        );
        continue;
      }

      // Compute context file checksum
      const contextChecksum = computeChecksum(scanned.content);

      // Get file stats
      const stats = await import('fs/promises').then((fs) => fs.stat(scanned.contextPath));
      const lastModified = stats.mtime.toISOString();

      // Extract folder from path
      const folder = extractFolder(scanned.relativePath, config.global.directory);

      // Create registry key: /folder/file.md or /file.md
      const filename = path.basename(scanned.relativePath);
      const registryKey = folder ? `/${folder}/${filename}` : `/${filename}`;

      // Create registry entry
      const entry: GlobalContextEntry = {
        type: 'document',
        source: scanned.relativePath,
        folder: folder,
        checksum: contextChecksum,
        last_modified: lastModified,
        preview: preview,
      };

      // Update registry
      registry.contexts[registryKey] = entry;
    } catch (error) {
      console.error(chalk.red(`✗ Error processing ${scanned.relativePath}: ${error}`));
    }
  }

  // Build folder metadata
  const folderMap = new Map<string, { checksum: string; lastModified: string; checksums: string[] }>();

  for (const entry of Object.values(registry.contexts)) {
    if (!entry.folder) continue;

    if (!folderMap.has(entry.folder)) {
      folderMap.set(entry.folder, {
        checksum: '',
        lastModified: entry.last_modified,
        checksums: [],
      });
    }

    const folderData = folderMap.get(entry.folder)!;
    folderData.checksums.push(entry.checksum);

    // Update to most recent last_modified
    if (entry.last_modified > folderData.lastModified) {
      folderData.lastModified = entry.last_modified;
    }
  }

  // Compute combined checksums for each folder
  registry.folders = {};
  for (const [folderName, data] of folderMap) {
    const combinedChecksum = computeChecksum(data.checksums.sort().join(''));
    registry.folders[folderName] = {
      checksum: combinedChecksum,
      last_modified: data.lastModified,
    };
  }

  // Write updated registry
  await writeGlobalRegistry(projectRoot, registry);

  return scannedContexts.length;
}
