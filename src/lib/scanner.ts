import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { glob } from 'glob';
import { ScannedContext, Config, UnifiedRegistry, ContextPathConfig } from './types.js';
import { DEFAULT_PATTERNS } from './config.js';

// New 3-level constants
const CTX_DIR = '.ctx';
const CONTEXTS_DIR = 'contexts';
const REGISTRY_FILE = 'registry.yaml';

/** Get global ctx directory (uses current HOME, not cached) */
function getGlobalCtxDir(): string {
  return path.join(os.homedir(), CTX_DIR);
}

/** Default context paths when settings not configured */
const DEFAULT_CONTEXT_PATHS: ContextPathConfig[] = [
  { path: '**/*.ctx.md', purpose: 'Bound contexts next to code' },
  { path: '.ctx/contexts/**/*.md', purpose: 'Centralized project contexts' },
];

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
 * Get context paths from registry settings
 * Falls back to default paths if settings not configured
 */
async function getContextPathsFromRegistry(registryPath: string): Promise<ContextPathConfig[]> {
  try {
    const content = await fs.readFile(registryPath, 'utf-8');
    const { parse } = await import('yaml');
    const registry = parse(content) as UnifiedRegistry;
    if (registry.settings?.context_paths && registry.settings.context_paths.length > 0) {
      return registry.settings.context_paths;
    }
  } catch {
    // Registry doesn't exist or is invalid
  }
  return DEFAULT_CONTEXT_PATHS;
}

/**
 * Scan ALL project context files based on context_paths settings.
 * Default patterns include bound contexts and centralized contexts.
 *
 * All are project contexts - distinction is by target field presence, not location.
 */
export async function scanProjectContexts(
  projectRoot: string
): Promise<ScannedContext[]> {
  const contexts: ScannedContext[] = [];
  const seenPaths = new Set<string>();

  const registryPath = path.join(projectRoot, CTX_DIR, REGISTRY_FILE);
  const contextPaths = await getContextPathsFromRegistry(registryPath);

  for (const cp of contextPaths) {
    // Build ignore list: exclude .ctx/** unless this pattern explicitly targets .ctx/
    const ignore = cp.path.startsWith('.ctx/')
      ? DEFAULT_PATTERNS.ignore.filter(p => p !== '.ctx/**')
      : DEFAULT_PATTERNS.ignore;

    const files = await glob(cp.path, {
      cwd: projectRoot,
      ignore,
      absolute: false,
    });

    for (const file of files) {
      if (seenPaths.has(file)) continue;
      seenPaths.add(file);

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
 * Scan for global context files based on settings.context_paths in ~/.ctx/
 */
export async function scanGlobalCtxContexts(): Promise<ScannedContext[]> {
  const globalCtxDir = getGlobalCtxDir();
  const registryPath = path.join(globalCtxDir, REGISTRY_FILE);
  const contextPaths = await getContextPathsFromRegistry(registryPath);

  const contexts: ScannedContext[] = [];
  const seenPaths = new Set<string>();

  for (const cp of contextPaths) {
    const files = await glob(cp.path, {
      cwd: globalCtxDir,
      absolute: false,
    });

    for (const file of files) {
      if (seenPaths.has(file)) continue;
      seenPaths.add(file);

      const absolutePath = path.join(globalCtxDir, file);
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
