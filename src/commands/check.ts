import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import {
  findProjectRoot,
  readProjectRegistry,
  isGlobalCtxInitialized,
} from '../lib/registry.js';
import { computeChecksum, computeFileChecksum } from '../lib/checksum.js';
import { CheckOptions } from '../lib/types.js';

interface CheckResult {
  status: 'fresh' | 'stale';
  summary: {
    total: number;
    fresh: number;
    stale: number;
    new: number;
    deleted: number;
    errors: number;
  };
  issues: Array<{
    type: 'stale' | 'new' | 'deleted' | 'error';
    category: 'bound' | 'standalone';  // bound = has target, standalone = no target
    contextPath: string;
    targetPath?: string;
    message: string;
  }>;
}

export async function checkCommand(options: CheckOptions = {}) {
  try {
    const projectRoot = await findProjectRoot();

    if (!projectRoot) {
      if (options.pretty) {
        console.error(chalk.red('✗ Error: Project not initialized.'));
        console.log(chalk.gray("  Run 'ctx init .' first to initialize project context management."));
      } else {
        console.log(JSON.stringify({ error: 'Project not initialized' }, null, 2));
      }
      process.exit(1);
    }

    const result = await checkContexts(projectRoot, options);

    if (options.pretty) {
      printPrettyResult(result);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }

    // Exit with error code if there are issues
    if (result.summary.errors > 0) {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    if (options.pretty) {
      console.error(chalk.red('✗ Error checking contexts:'), error);
    } else {
      console.log(JSON.stringify({ error: String(error) }, null, 2));
    }
    process.exit(1);
  }
}

async function checkContexts(projectRoot: string, options: CheckOptions): Promise<CheckResult> {
  const registry = await readProjectRegistry(projectRoot);
  const result: CheckResult = {
    status: 'fresh',
    summary: {
      total: 0,
      fresh: 0,
      stale: 0,
      new: 0,
      deleted: 0,
      errors: 0,
    },
    issues: [],
  };

  // Check registered contexts
  for (const [contextPath, entry] of Object.entries(registry.contexts)) {
    // Filter by path if specified
    if (options.path) {
      const normalizedPath = options.path.replace(/^\.\//, '');
      if (!contextPath.includes(normalizedPath)) {
        continue;
      }
    }

    result.summary.total++;

    try {
      const absoluteContextPath = path.join(projectRoot, contextPath);

      // Check if context file exists
      try {
        await fs.access(absoluteContextPath);
      } catch {
        result.summary.deleted++;
        result.issues.push({
          type: 'deleted',
          category: entry.target ? 'bound' : 'standalone',
          contextPath,
          message: 'Context file not found',
        });
        continue;
      }

      // Check checksum
      const content = await fs.readFile(absoluteContextPath, 'utf-8');
      const currentChecksum = computeChecksum(content);

      if (currentChecksum !== entry.checksum) {
        result.summary.stale++;
        result.issues.push({
          type: 'stale',
          category: entry.target ? 'bound' : 'standalone',
          contextPath,
          message: 'Content has changed since last sync',
        });
        continue;
      }

      // Check target file for local contexts
      if (entry.target) {
        const absoluteTargetPath = path.join(projectRoot, entry.target.replace(/^\//, ''));
        try {
          await fs.access(absoluteTargetPath);
          const targetChecksum = await computeFileChecksum(absoluteTargetPath);

          if (entry.target_checksum && targetChecksum !== entry.target_checksum) {
            result.summary.stale++;
            result.issues.push({
              type: 'stale',
              category: 'bound',
              contextPath,
              targetPath: entry.target,
              message: 'Target file has changed since last sync',
            });
            continue;
          }
        } catch {
          result.summary.errors++;
          result.issues.push({
            type: 'error',
            category: 'bound',
            contextPath,
            targetPath: entry.target,
            message: 'Target file not found',
          });
          continue;
        }
      }

      result.summary.fresh++;
    } catch (error) {
      result.summary.errors++;
      result.issues.push({
        type: 'error',
        category: entry.target ? 'bound' : 'standalone',
        contextPath,
        message: `Error checking context: ${error}`,
      });
    }
  }

  // Scan for new (unregistered) context files
  if (!options.path) {
    const newContexts = await findNewContexts(projectRoot, registry);
    result.summary.new = newContexts.length;
    for (const ctx of newContexts) {
      result.issues.push({
        type: 'new',
        category: ctx.hasTarget ? 'bound' : 'standalone',
        contextPath: ctx.path,
        targetPath: ctx.target,
        message: 'Context file not in registry',
      });
    }
  }

  // Update overall status
  if (result.summary.stale > 0 || result.summary.errors > 0 || result.summary.deleted > 0) {
    result.status = 'stale';
  }

  return result;
}

async function findNewContexts(
  projectRoot: string,
  registry: { contexts: Record<string, any> }
): Promise<Array<{ path: string; hasTarget: boolean; target?: string }>> {
  const newContexts: Array<{ path: string; hasTarget: boolean; target?: string }> = [];

  // Scan for *.ctx.md files (typically bound to target files)
  const { glob } = await import('glob');
  const patterns = ['**/*.ctx.md', '**/ctx.md'];
  const ignore = ['node_modules/**', 'dist/**', 'build/**', '.git/**', '.ctx/**'];

  for (const pattern of patterns) {
    const files = await glob(pattern, { cwd: projectRoot, ignore });
    for (const file of files) {
      if (!registry.contexts[file]) {
        // *.ctx.md files are typically bound to a target file
        newContexts.push({ path: file, hasTarget: true });
      }
    }
  }

  // Scan for .ctx/contexts/*.md files (standalone, no target)
  const projectContextPattern = '.ctx/contexts/**/*.md';
  const projectFiles = await glob(projectContextPattern, { cwd: projectRoot });
  for (const file of projectFiles) {
    if (!registry.contexts[file]) {
      newContexts.push({ path: file, hasTarget: false });
    }
  }

  return newContexts;
}

function printPrettyResult(result: CheckResult): void {
  console.log();

  if (result.status === 'fresh' && result.summary.new === 0) {
    console.log(chalk.green.bold('✓ All contexts are fresh!'));
  } else {
    console.log(chalk.yellow.bold('⚠️  Some contexts need attention:'));
  }

  console.log();
  console.log(chalk.gray('Summary:'));
  console.log(chalk.gray(`  Total: ${result.summary.total}`));
  console.log(chalk.green(`  Fresh: ${result.summary.fresh}`));

  if (result.summary.stale > 0) {
    console.log(chalk.yellow(`  Stale: ${result.summary.stale}`));
  }
  if (result.summary.new > 0) {
    console.log(chalk.blue(`  New: ${result.summary.new}`));
  }
  if (result.summary.deleted > 0) {
    console.log(chalk.red(`  Deleted: ${result.summary.deleted}`));
  }
  if (result.summary.errors > 0) {
    console.log(chalk.red(`  Errors: ${result.summary.errors}`));
  }

  if (result.issues.length > 0) {
    console.log();
    console.log(chalk.gray('Issues:'));
    for (const issue of result.issues) {
      const icon = issue.type === 'error' ? '✗' : issue.type === 'new' ? '+' : '!';
      const color = issue.type === 'error' ? chalk.red : issue.type === 'new' ? chalk.blue : chalk.yellow;
      console.log(color(`  ${icon} [${issue.category}] ${issue.contextPath}: ${issue.message}`));
    }
  }

  console.log();

  if (result.summary.stale > 0 || result.summary.new > 0) {
    console.log(chalk.gray('Run `ctx sync` to update the registry.'));
  }
}
