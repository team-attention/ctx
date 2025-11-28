import path from 'path';
import chalk from 'chalk';
import { isProjectInitialized, fileExists, resolveTargetFromContext } from '../lib/fileUtils.js';
import { scanLocalContexts, scanGlobalContexts } from '../lib/scanner.js';
import { parseContextFile, extractPreviewFromGlobal } from '../lib/parser.js';
import { computeChecksum, computeFileChecksum } from '../lib/checksum.js';
import { readLocalRegistry, readGlobalRegistry } from '../lib/registry.js';
import { loadConfig } from '../lib/config.js';
import { CheckOptions, CheckResult, CheckIssue } from '../lib/types.js';
import { syncCommand } from './sync.js';

export async function checkCommand(options: CheckOptions = {}) {
  try {
    // Check if project is initialized
    const initialized = await isProjectInitialized();
    if (!initialized) {
      if (options.pretty) {
        console.error(chalk.red('✗ Error: Project not initialized.'));
        console.log(chalk.gray("  Run 'ctx init' first to initialize context management."));
      } else {
        console.log(JSON.stringify({ error: 'Project not initialized' }, null, 2));
      }
      process.exit(1);
    }

    const projectRoot = process.cwd();
    const config = await loadConfig(projectRoot);

    // If --path is specified, auto-detect scope
    let checkLocal = options.local || (!options.local && !options.global);
    let checkGlobal = options.global || (!options.local && !options.global);

    if (options.path) {
      // Normalize path (remove leading ./ if present)
      const normalizedPath = options.path.replace(/^\.\//, '');
      const globalDir = config.global.directory;

      // Auto-detect scope based on path
      if (normalizedPath.startsWith(globalDir + '/') || normalizedPath.startsWith(globalDir)) {
        checkLocal = false;
        checkGlobal = true;
      } else {
        checkLocal = true;
        checkGlobal = false;
      }
    }

    const result: CheckResult = {
      status: 'fresh',
      summary: {
        local: { total: 0, fresh: 0, stale: 0, new: 0, deleted: 0, errors: 0 },
        global: { total: 0, fresh: 0, stale: 0, new: 0, deleted: 0, errors: 0 },
      },
      issues: [],
    };

    // Normalize filter path if provided
    const filterPath = options.path?.replace(/^\.\//, '');

    // Check local contexts
    if (checkLocal) {
      await checkLocalContexts(projectRoot, result, filterPath);
    }

    // Check global contexts
    if (checkGlobal) {
      await checkGlobalContexts(projectRoot, result, filterPath);
    }

    // Determine overall status
    result.status = determineOverallStatus(result);

    // If --fix, run sync
    if (options.fix && result.status !== 'fresh') {
      if (options.pretty) {
        console.log(chalk.blue('🔧 Fixing...'));
        console.log();
      }

      await syncCommand({
        local: checkLocal,
        global: checkGlobal,
      });

      if (options.pretty) {
        console.log();
        console.log(chalk.green('✓ Registry updated'));
      }
      return;
    }

    // Output results
    if (options.pretty) {
      printCheckPretty(result, checkLocal, checkGlobal);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }

    // Exit with appropriate code
    process.exit(result.status === 'error' ? 1 : 0);
  } catch (error) {
    if (options.pretty) {
      console.error(chalk.red('✗ Error during check:'), error);
    } else {
      console.log(JSON.stringify({ error: String(error) }, null, 2));
    }
    process.exit(1);
  }
}

/**
 * Check local contexts
 */
async function checkLocalContexts(projectRoot: string, result: CheckResult, filterPath?: string): Promise<void> {
  const config = await loadConfig(projectRoot);

  // Scan filesystem for context files
  let scannedContexts = await scanLocalContexts(projectRoot, config);

  // Filter to specific path if provided
  if (filterPath) {
    scannedContexts = scannedContexts.filter(ctx => ctx.relativePath === filterPath);
  }

  // Read existing registry
  let registry;
  try {
    registry = await readLocalRegistry(projectRoot);
  } catch {
    // Registry doesn't exist - all scanned files are "new"
    for (const scanned of scannedContexts) {
      result.summary.local.new++;
      result.issues.push({
        type: 'new',
        scope: 'local',
        contextPath: scanned.relativePath,
        message: 'Context file not in registry',
      });
    }
    result.summary.local.total = scannedContexts.length;
    return;
  }

  // Build sets for comparison
  const scannedPaths = new Set<string>();
  const registryTargets = new Set(Object.keys(registry.contexts));

  // Check each scanned context file
  for (const scanned of scannedContexts) {
    try {
      // Parse context file
      const contextFile = parseContextFile(scanned.relativePath, scanned.content);

      // Resolve target path
      const targetPath = await resolveTargetFromContext(
        scanned.relativePath,
        contextFile.meta.target
      );

      scannedPaths.add(targetPath);
      result.summary.local.total++;

      const registryEntry = registry.contexts[targetPath];

      if (!registryEntry) {
        // New context (not in registry)
        result.summary.local.new++;
        result.issues.push({
          type: 'new',
          scope: 'local',
          contextPath: scanned.relativePath,
          targetPath,
          message: 'Context file not in registry',
        });
        continue;
      }

      // Check context file checksum
      const currentChecksum = computeChecksum(scanned.content);
      if (currentChecksum !== registryEntry.checksum) {
        // Context file modified
        result.summary.local.stale++;
        result.issues.push({
          type: 'modified',
          scope: 'local',
          contextPath: scanned.relativePath,
          targetPath,
          message: 'Context file modified since last sync',
          lastModified: registryEntry.last_modified,
        });
        continue;
      }

      // Check target file exists and checksum
      const absoluteTargetPath = path.join(projectRoot, targetPath.replace(/^\//, ''));
      const targetExists = await fileExists(absoluteTargetPath);

      if (!targetExists) {
        // Target file deleted
        result.summary.local.errors++;
        result.issues.push({
          type: 'error',
          scope: 'local',
          contextPath: scanned.relativePath,
          targetPath,
          message: 'Target file not found',
        });
        continue;
      }

      // Check target file checksum
      const currentTargetChecksum = await computeFileChecksum(absoluteTargetPath);
      if (currentTargetChecksum !== registryEntry.target_checksum) {
        // Target file changed
        result.summary.local.stale++;
        result.issues.push({
          type: 'stale_target',
          scope: 'local',
          contextPath: scanned.relativePath,
          targetPath,
          message: 'Target file changed - context may need update',
          lastModified: registryEntry.last_modified,
        });
        continue;
      }

      // All good
      result.summary.local.fresh++;
    } catch (error) {
      result.summary.local.errors++;
      result.issues.push({
        type: 'error',
        scope: 'local',
        contextPath: scanned.relativePath,
        message: `Error processing: ${error}`,
      });
    }
  }

  // Check for deleted contexts (in registry but not in filesystem)
  // Skip this check if filtering by specific path
  if (!filterPath) {
    for (const targetPath of registryTargets) {
      if (!scannedPaths.has(targetPath)) {
        const entry = registry.contexts[targetPath];
        result.summary.local.deleted++;
        result.issues.push({
          type: 'deleted',
          scope: 'local',
          contextPath: entry.source,
          targetPath,
          message: 'Context file deleted from filesystem',
        });
      }
    }
  }
}

/**
 * Check global contexts
 */
async function checkGlobalContexts(projectRoot: string, result: CheckResult, filterPath?: string): Promise<void> {
  const config = await loadConfig(projectRoot);

  // Scan filesystem for context files
  let scannedContexts = await scanGlobalContexts(projectRoot, config);

  // Filter to specific path if provided
  if (filterPath) {
    scannedContexts = scannedContexts.filter(ctx => ctx.relativePath === filterPath);
  }

  // Read existing registry
  let registry;
  try {
    registry = await readGlobalRegistry(projectRoot);
  } catch {
    // Registry doesn't exist - all scanned files are "new"
    for (const scanned of scannedContexts) {
      result.summary.global.new++;
      result.issues.push({
        type: 'new',
        scope: 'global',
        contextPath: scanned.relativePath,
        message: 'Document not in registry',
      });
    }
    result.summary.global.total = scannedContexts.length;
    return;
  }

  // Build sets for comparison
  const scannedSources = new Set<string>();
  const registrySources = new Set(
    Object.values(registry.contexts).map((e) => e.source)
  );

  // Check each scanned context file
  for (const scanned of scannedContexts) {
    try {
      scannedSources.add(scanned.relativePath);
      result.summary.global.total++;

      // Find registry entry by source path
      const registryEntry = Object.values(registry.contexts).find(
        (e) => e.source === scanned.relativePath
      );

      if (!registryEntry) {
        // New context (not in registry)
        result.summary.global.new++;
        result.issues.push({
          type: 'new',
          scope: 'global',
          contextPath: scanned.relativePath,
          message: 'Document not in registry',
        });
        continue;
      }

      // Check frontmatter validity
      const preview = extractPreviewFromGlobal(scanned.content);
      if (!preview) {
        result.summary.global.errors++;
        result.issues.push({
          type: 'error',
          scope: 'global',
          contextPath: scanned.relativePath,
          message: 'Invalid or missing frontmatter (missing what/when)',
        });
        continue;
      }

      // Check context file checksum
      const currentChecksum = computeChecksum(scanned.content);
      if (currentChecksum !== registryEntry.checksum) {
        // Context file modified
        result.summary.global.stale++;
        result.issues.push({
          type: 'modified',
          scope: 'global',
          contextPath: scanned.relativePath,
          message: 'Document modified since last sync',
          lastModified: registryEntry.last_modified,
        });
        continue;
      }

      // All good
      result.summary.global.fresh++;
    } catch (error) {
      result.summary.global.errors++;
      result.issues.push({
        type: 'error',
        scope: 'global',
        contextPath: scanned.relativePath,
        message: `Error processing: ${error}`,
      });
    }
  }

  // Check for deleted contexts (in registry but not in filesystem)
  // Skip this check if filtering by specific path
  if (!filterPath) {
    for (const source of registrySources) {
      if (!scannedSources.has(source)) {
        result.summary.global.deleted++;
        result.issues.push({
          type: 'deleted',
          scope: 'global',
          contextPath: source,
          message: 'Document deleted from filesystem',
        });
      }
    }
  }
}

/**
 * Determine overall status
 */
function determineOverallStatus(result: CheckResult): 'fresh' | 'stale' | 'error' {
  const local = result.summary.local;
  const global = result.summary.global;

  // Error if any errors
  if (local.errors > 0 || global.errors > 0) {
    return 'error';
  }

  // Stale if any stale, new, or deleted
  if (
    local.stale > 0 ||
    local.new > 0 ||
    local.deleted > 0 ||
    global.stale > 0 ||
    global.new > 0 ||
    global.deleted > 0
  ) {
    return 'stale';
  }

  return 'fresh';
}

/**
 * Print check results in pretty format
 */
function printCheckPretty(
  result: CheckResult,
  checkLocal: boolean,
  checkGlobal: boolean
): void {
  console.log();

  const local = result.summary.local;
  const global = result.summary.global;

  // Header based on status
  if (result.status === 'fresh') {
    console.log(chalk.green('✓ All contexts are fresh'));
    console.log();
    if (checkLocal) {
      console.log(`  Local:  ${local.total} contexts`);
    }
    if (checkGlobal) {
      console.log(`  Global: ${global.total} contexts`);
    }
    console.log();
    return;
  }

  // Issues found
  const totalIssues = result.issues.length;
  const issueWord = totalIssues === 1 ? 'issue' : 'issues';

  if (result.status === 'error') {
    console.log(chalk.red(`❌ ${totalIssues} ${issueWord} found`));
  } else {
    console.log(chalk.yellow(`⚠️  ${totalIssues} ${issueWord} found`));
  }
  console.log();

  // Summary
  if (checkLocal) {
    const localStatus = getStatusParts(local);
    console.log(`  Local:  ${local.total} contexts ${localStatus}`);
  }
  if (checkGlobal) {
    const globalStatus = getStatusParts(global);
    console.log(`  Global: ${global.total} contexts ${globalStatus}`);
  }
  console.log();

  // Group issues by type
  const issuesByType = groupIssuesByType(result.issues);

  // Print each group
  if (issuesByType.error.length > 0) {
    console.log(chalk.red.bold('Errors:'));
    issuesByType.error.forEach((issue) => printIssue(issue, 'error'));
    console.log();
  }

  if (issuesByType.stale_target.length > 0) {
    console.log(chalk.yellow.bold('Stale Contexts (target changed):'));
    issuesByType.stale_target.forEach((issue) => printIssue(issue, 'warning'));
    console.log();
  }

  if (issuesByType.modified.length > 0) {
    console.log(chalk.yellow.bold('Modified Contexts (not synced):'));
    issuesByType.modified.forEach((issue) => printIssue(issue, 'warning'));
    console.log();
  }

  if (issuesByType.new.length > 0) {
    console.log(chalk.blue.bold('New Contexts (not in registry):'));
    issuesByType.new.forEach((issue) => printIssue(issue, 'info'));
    console.log();
  }

  if (issuesByType.deleted.length > 0) {
    console.log(chalk.gray.bold('Deleted Contexts (in registry only):'));
    issuesByType.deleted.forEach((issue) => printIssue(issue, 'gray'));
    console.log();
  }

  // Next steps
  console.log(chalk.gray('Run: ctx check --fix  (to update registry)'));
  console.log();
}

function getStatusParts(summary: CheckResult['summary']['local']): string {
  const parts: string[] = [];

  if (summary.fresh > 0) parts.push(chalk.green(`${summary.fresh} fresh`));
  if (summary.stale > 0) parts.push(chalk.yellow(`${summary.stale} stale`));
  if (summary.new > 0) parts.push(chalk.blue(`${summary.new} new`));
  if (summary.deleted > 0) parts.push(chalk.gray(`${summary.deleted} deleted`));
  if (summary.errors > 0) parts.push(chalk.red(`${summary.errors} errors`));

  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

function groupIssuesByType(issues: CheckIssue[]): Record<CheckIssue['type'], CheckIssue[]> {
  const groups: Record<CheckIssue['type'], CheckIssue[]> = {
    new: [],
    deleted: [],
    modified: [],
    stale_target: [],
    error: [],
  };

  for (const issue of issues) {
    groups[issue.type].push(issue);
  }

  return groups;
}

function printIssue(issue: CheckIssue, style: 'error' | 'warning' | 'info' | 'gray'): void {
  const icon =
    style === 'error'
      ? chalk.red('✗')
      : style === 'warning'
        ? chalk.yellow('⚠')
        : style === 'info'
          ? chalk.blue('✨')
          : chalk.gray('○');

  const pathColor =
    style === 'error'
      ? chalk.red
      : style === 'warning'
        ? chalk.yellow
        : style === 'info'
          ? chalk.blue
          : chalk.gray;

  console.log(`  ${icon} ${pathColor(issue.contextPath)}`);

  if (issue.targetPath) {
    console.log(chalk.gray(`    Target: ${issue.targetPath}`));
  }

  if (issue.message && style === 'error') {
    console.log(chalk.gray(`    ${issue.message}`));
  }
}
