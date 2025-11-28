import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { isProjectInitialized, fileExists } from '../lib/fileUtils.js';
import { readLocalRegistry, readGlobalRegistry, findContextByTarget } from '../lib/registry.js';
import { loadConfig } from '../lib/config.js';

interface StatusOptions {
  pretty?: boolean;
  target?: string;
}

interface CtxCurrent {
  issue?: string;
  sessions?: string[];
}

interface StatusData {
  initialized: boolean;
  context: {
    local: { count: number; stale: number; errors: number };
    global: { count: number };
    lastSync: string | null;
  };
  work: {
    active: boolean;
    issue?: string;
    issueTitle?: string;
    branch?: string;
    sessionsCount?: number;
    status?: string;
  };
  suggestions: string[];
}

export async function statusCommand(options: StatusOptions = {}) {
  const projectRoot = process.cwd();

  try {
    // --target mode: find context by target path
    if (options.target) {
      const result = await findContextByTarget(projectRoot, options.target);
      if (result) {
        console.log(JSON.stringify({
          found: true,
          target: options.target,
          contextPath: result.contextPath,
          entry: result.entry,
        }, null, 2));
      } else {
        console.log(JSON.stringify({
          found: false,
          target: options.target,
          contextPath: null,
        }, null, 2));
      }
      return;
    }

    // Default: full status
    const status = await collectStatus(projectRoot);

    if (options.pretty) {
      printStatusPretty(status);
    } else {
      console.log(JSON.stringify(status, null, 2));
    }
  } catch (error) {
    if (options.pretty) {
      console.error(chalk.red('✗ Error getting status:'), error);
    } else {
      console.log(JSON.stringify({ error: String(error) }, null, 2));
    }
    process.exit(1);
  }
}

async function collectStatus(projectRoot: string): Promise<StatusData> {
  const status: StatusData = {
    initialized: false,
    context: {
      local: { count: 0, stale: 0, errors: 0 },
      global: { count: 0 },
      lastSync: null,
    },
    work: { active: false },
    suggestions: [],
  };

  // Check initialization
  status.initialized = await isProjectInitialized();
  if (!status.initialized) {
    status.suggestions.push('Run `ctx init` to initialize');
    return status;
  }

  const config = await loadConfig(projectRoot);

  // Read registries
  await collectContextStatus(projectRoot, config, status);

  // Read work session
  await collectWorkStatus(projectRoot, status);

  // Generate suggestions
  generateSuggestions(status);

  return status;
}

async function collectContextStatus(
  projectRoot: string,
  config: Awaited<ReturnType<typeof loadConfig>>,
  status: StatusData
): Promise<void> {
  const localRegistryPath = path.join(
    projectRoot,
    config.global.directory,
    'local-context-registry.yml'
  );
  const globalRegistryPath = path.join(
    projectRoot,
    config.global.directory,
    'global-context-registry.yml'
  );

  // Local registry
  try {
    const localRegistry = await readLocalRegistry(projectRoot);
    status.context.local.count = Object.keys(localRegistry.contexts).length;
    status.context.lastSync = localRegistry.meta.last_synced;

    // Quick stale check - compare target checksums
    for (const [targetPath, entry] of Object.entries(localRegistry.contexts)) {
      const absoluteTarget = path.join(projectRoot, targetPath.replace(/^\//, ''));
      const exists = await fileExists(absoluteTarget);
      if (!exists) {
        status.context.local.errors++;
      }
      // Note: Full checksum comparison would require reading files
      // For status, we just count entries
    }
  } catch {
    // Registry doesn't exist
  }

  // Global registry
  try {
    const globalRegistry = await readGlobalRegistry(projectRoot);
    status.context.global.count = Object.keys(globalRegistry.contexts).length;

    // Update lastSync if global is more recent
    if (globalRegistry.meta.last_synced) {
      if (
        !status.context.lastSync ||
        globalRegistry.meta.last_synced > status.context.lastSync
      ) {
        status.context.lastSync = globalRegistry.meta.last_synced;
      }
    }
  } catch {
    // Registry doesn't exist
  }
}

async function collectWorkStatus(projectRoot: string, status: StatusData): Promise<void> {
  const ctxCurrentPath = path.join(projectRoot, '.ctx.current');

  try {
    const content = await fs.readFile(ctxCurrentPath, 'utf-8');
    const ctxCurrent: CtxCurrent = JSON.parse(content);

    status.work.active = true;
    status.work.issue = ctxCurrent.issue;
    status.work.sessionsCount = ctxCurrent.sessions?.length ?? 0;

    // Get issue title if it's a local file
    if (ctxCurrent.issue && !ctxCurrent.issue.startsWith('http')) {
      try {
        const issueContent = await fs.readFile(
          path.join(projectRoot, ctxCurrent.issue),
          'utf-8'
        );
        const titleMatch = issueContent.match(/^title:\s*(.+)$/m);
        const statusMatch = issueContent.match(/^status:\s*(.+)$/m);
        if (titleMatch) status.work.issueTitle = titleMatch[1].trim();
        if (statusMatch) status.work.status = statusMatch[1].trim();
      } catch {
        // Issue file not found
      }
    }

    // Get current branch
    try {
      const { execSync } = await import('child_process');
      status.work.branch = execSync('git branch --show-current', {
        cwd: projectRoot,
        encoding: 'utf-8',
      }).trim();
    } catch {
      // Not in git repo
    }
  } catch {
    // No active work session
    status.work.active = false;
  }
}

function generateSuggestions(status: StatusData): void {
  if (!status.initialized) return;

  // Context suggestions
  if (status.context.local.count === 0 && status.context.global.count === 0) {
    status.suggestions.push('Initialize registries → ctx sync');
    status.suggestions.push('Create your first context → /ctx.local <file>');
  } else if (status.context.local.errors > 0) {
    status.suggestions.push(
      `${status.context.local.errors} context(s) have issues → ctx check --pretty`
    );
  }

  // Work suggestions
  if (status.work.active) {
    status.suggestions.push('Extract learnings before merge → /ctx.work.extract');
  } else {
    status.suggestions.push('Start a task → /ctx.work.init <issue-url>');
  }

  // Limit to 3 suggestions
  status.suggestions = status.suggestions.slice(0, 3);
}

function printStatusPretty(status: StatusData): void {
  console.log();

  // Not initialized
  if (!status.initialized) {
    console.log(chalk.yellow('⚠️  ctx not initialized'));
    console.log();
    console.log(chalk.gray('Run: ctx init'));
    console.log();
    return;
  }

  // Context Status
  console.log(chalk.bold('📊 Context Status'));
  console.log(chalk.gray('━'.repeat(50)));

  const localHealth = getHealthIndicator(status.context.local);
  console.log(`Local contexts:  ${status.context.local.count} ${localHealth}`);
  console.log(`Global contexts: ${status.context.global.count}`);
  console.log(`Last sync:       ${formatLastSync(status.context.lastSync)}`);

  console.log();

  // Work Session
  console.log(chalk.bold('🔧 Work Session'));
  console.log(chalk.gray('━'.repeat(50)));

  if (status.work.active) {
    const issueDisplay = status.work.issueTitle || status.work.issue || 'Unknown';
    console.log(`Issue:    ${issueDisplay}`);

    if (status.work.issue?.startsWith('http')) {
      console.log(chalk.gray(`Source:   ${status.work.issue}`));
    } else if (status.work.issue) {
      console.log(chalk.gray(`Source:   local (${status.work.issue})`));
    }

    if (status.work.branch) {
      console.log(`Branch:   ${status.work.branch}`);
    }
    if (status.work.sessionsCount !== undefined) {
      console.log(`Sessions: ${status.work.sessionsCount} recorded`);
    }
    if (status.work.status) {
      console.log(`Status:   ${status.work.status}`);
    }
  } else {
    console.log(chalk.gray('No active work session'));
  }

  console.log();

  // Suggestions
  if (status.suggestions.length > 0) {
    console.log(chalk.bold('💡 Suggestions'));
    console.log(chalk.gray('━'.repeat(50)));
    status.suggestions.forEach((s) => {
      console.log(`• ${s}`);
    });
    console.log();
  }
}

function getHealthIndicator(local: { count: number; stale: number; errors: number }): string {
  if (local.count === 0) return '';
  if (local.errors > 0) return chalk.red(`(✗ ${local.errors} errors)`);
  if (local.stale > 0) return chalk.yellow(`(⚠ ${local.stale} stale)`);
  return chalk.green('(✓ all valid)');
}

function formatLastSync(lastSync: string | null): string {
  if (!lastSync) return chalk.gray('never');

  try {
    const syncDate = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let relative: string;
    if (diffMins < 1) relative = 'just now';
    else if (diffMins < 60) relative = `${diffMins} min ago`;
    else if (diffHours < 24) relative = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    else relative = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    const formatted = syncDate.toISOString().slice(0, 16).replace('T', ' ');
    return `${formatted} (${relative})`;
  } catch {
    return lastSync;
  }
}
