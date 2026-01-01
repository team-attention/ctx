import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { glob } from 'glob';
import { ScannedContext, Config } from './types.js';
import { DEFAULT_PATTERNS } from './config.js';

// New 3-level constants
const CTX_DIR = '.ctx';
const CONTEXTS_DIR = 'contexts';
const GLOBAL_CTX_DIR = path.join(os.homedir(), CTX_DIR);

/**
 * Scan for local context files based on config patterns
 */
export async function scanLocalContexts(
  projectRoot: string,
  config: Config
): Promise<ScannedContext[]> {
  const contexts: ScannedContext[] = [];

  // Support both string and array patterns
  const patterns = Array.isArray(config.local.patterns)
    ? config.local.patterns
    : [config.local.patterns];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore: [
        ...config.local.ignore,
        `${config.global.directory}/**`,
      ],
      absolute: false,
    });

    for (const file of files) {
      const absolutePath = path.join(projectRoot, file);
      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        contexts.push({
          contextPath: absolutePath,
          relativePath: file,
          content,
        });
      } catch (error) {
        console.error(`Warning: Failed to read ${file}: ${error}`);
      }
    }
  }
 
  return contexts;
}

/**
 * Scan for global context files based on config patterns
 */
export async function scanGlobalContexts(
  projectRoot: string,
  config: Config
): Promise<ScannedContext[]> {
  const globalDir = path.join(projectRoot, config.global.directory);

  // Check if global directory exists
  try {
    await fs.access(globalDir);
  } catch {
    return []; // global directory doesn't exist
  }

  // Build pattern with config directory
  const pattern = `${config.global.directory}/${config.global.patterns}`;

  const files = await glob(pattern, {
    cwd: projectRoot,
    ignore: [
      ...config.global.ignore.map(p => `${config.global.directory}/${p}`),
    ],
    absolute: false,
  });

  const contexts: ScannedContext[] = [];

  for (const file of files) {
    const absolutePath = path.join(projectRoot, file);

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      contexts.push({
        contextPath: absolutePath,
        relativePath: file,
        content,
      });
    } catch (error) {
      console.error(`Warning: Failed to read ${file}: ${error}`);
    }
  }

  return contexts;
}

/**
 * Extract folder from global context path
 * Example: ctx/rules/input-handling.md -> 'rules'
 * Example: ctx/overview.md -> null
 */
export function extractFolder(relativePath: string, globalDir: string): string | null {
  // Remove global directory prefix (e.g., 'ctx/' or 'docs/')
  const pattern = new RegExp(`^${globalDir.replace(/[/\\]/g, '[/\\\\]')}[/\\\\]`);
  const withoutDir = relativePath.replace(pattern, '');

  // Get first directory
  const parts = withoutDir.split(/[/\\]/);

  // If only one part, it's a root file
  if (parts.length === 1) {
    return null;
  }

  // Otherwise, return the folder name
  return parts[0];
}

// ===== New 3-Level Scanner Functions =====

/**
 * Scan for local context files using hardcoded patterns (config-free)
 * Scans for *.ctx.md and ctx.md files in project
 */
export async function scanLocalContextsNew(
  projectRoot: string
): Promise<ScannedContext[]> {
  const contexts: ScannedContext[] = [];

  for (const pattern of DEFAULT_PATTERNS.local) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore: DEFAULT_PATTERNS.ignore,
      absolute: false,
    });

    for (const file of files) {
      const absolutePath = path.join(projectRoot, file);
      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        contexts.push({
          contextPath: absolutePath,
          relativePath: file,
          content,
        });
      } catch (error) {
        console.error(`Warning: Failed to read ${file}: ${error}`);
      }
    }
  }

  return contexts;
}

/**
 * Scan for project context files in .ctx/contexts/
 */
export async function scanProjectContexts(
  projectRoot: string
): Promise<ScannedContext[]> {
  const contextsDir = path.join(projectRoot, CTX_DIR, CONTEXTS_DIR);

  try {
    await fs.access(contextsDir);
  } catch {
    return []; // .ctx/contexts/ doesn't exist
  }

  const files = await glob('**/*.md', {
    cwd: contextsDir,
    absolute: false,
  });

  const contexts: ScannedContext[] = [];

  for (const file of files) {
    const absolutePath = path.join(contextsDir, file);
    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      contexts.push({
        contextPath: absolutePath,
        relativePath: path.join(CTX_DIR, CONTEXTS_DIR, file),
        content,
      });
    } catch (error) {
      console.error(`Warning: Failed to read ${file}: ${error}`);
    }
  }

  return contexts;
}

/**
 * Scan for global context files in ~/.ctx/contexts/
 */
export async function scanGlobalCtxContexts(): Promise<ScannedContext[]> {
  const contextsDir = path.join(GLOBAL_CTX_DIR, CONTEXTS_DIR);

  try {
    await fs.access(contextsDir);
  } catch {
    return []; // ~/.ctx/contexts/ doesn't exist
  }

  const files = await glob('**/*.md', {
    cwd: contextsDir,
    absolute: false,
  });

  const contexts: ScannedContext[] = [];

  for (const file of files) {
    const absolutePath = path.join(contextsDir, file);
    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      contexts.push({
        contextPath: absolutePath,
        relativePath: file,
        content,
      });
    } catch (error) {
      console.error(`Warning: Failed to read ${file}: ${error}`);
    }
  }

  return contexts;
}
