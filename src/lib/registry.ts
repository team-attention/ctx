import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import YAML from 'yaml';
import { UnifiedRegistry, ProjectIndexEntry } from './types.js';

// 3-level constants
export const CTX_DIR = '.ctx';
export const REGISTRY_FILE = 'registry.yaml';
export const CONTEXTS_DIR = 'contexts';

/**
 * Get global ctx directory path (~/.ctx/)
 * Uses function to support HOME env changes in tests
 */
export function getGlobalCtxDir(): string {
  const home = process.env.HOME || os.homedir();
  return path.join(home, CTX_DIR);
}

/**
 * Get path to global registry (~/.ctx/registry.yaml)
 */
export function getGlobalCtxRegistryPath(): string {
  return path.join(getGlobalCtxDir(), REGISTRY_FILE);
}

/**
 * Get path to project registry ({project}/.ctx/registry.yaml)
 */
export function getProjectRegistryPath(projectRoot: string): string {
  return path.join(projectRoot, CTX_DIR, REGISTRY_FILE);
}

/**
 * Check if global ctx is initialized (~/.ctx/registry.yaml exists)
 */
export async function isGlobalCtxInitialized(): Promise<boolean> {
  try {
    await fs.access(getGlobalCtxRegistryPath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if project ctx is initialized ({project}/.ctx/registry.yaml exists)
 */
export async function isProjectCtxInitialized(projectRoot: string): Promise<boolean> {
  try {
    await fs.access(getProjectRegistryPath(projectRoot));
    return true;
  } catch {
    return false;
  }
}

/**
 * Find project root by traversing up and looking for .ctx/registry.yaml
 * @returns Project root path or null if not found
 */
export async function findProjectRoot(startPath: string = process.cwd()): Promise<string | null> {
  let currentPath = path.resolve(startPath);
  const root = path.parse(currentPath).root;

  while (currentPath !== root) {
    const registryPath = path.join(currentPath, CTX_DIR, REGISTRY_FILE);
    try {
      await fs.access(registryPath);
      return currentPath;
    } catch {
      currentPath = path.dirname(currentPath);
    }
  }

  return null;
}

/**
 * Read unified registry
 */
export async function readUnifiedRegistry(registryPath: string): Promise<UnifiedRegistry> {
  try {
    const content = await fs.readFile(registryPath, 'utf-8');
    return YAML.parse(content) as UnifiedRegistry;
  } catch {
    return {
      meta: {
        version: '2.0.0',
        last_synced: new Date().toISOString(),
      },
      contexts: {},
    };
  }
}

/**
 * Write unified registry
 */
export async function writeUnifiedRegistry(
  registryPath: string,
  registry: UnifiedRegistry
): Promise<void> {
  registry.meta.last_synced = new Date().toISOString();
  const yamlContent = YAML.stringify(registry);
  await fs.writeFile(registryPath, yamlContent, 'utf-8');
}

/**
 * Read global registry
 */
export async function readGlobalCtxRegistry(): Promise<UnifiedRegistry> {
  return readUnifiedRegistry(getGlobalCtxRegistryPath());
}

/**
 * Write global registry
 */
export async function writeGlobalCtxRegistry(registry: UnifiedRegistry): Promise<void> {
  await writeUnifiedRegistry(getGlobalCtxRegistryPath(), registry);
}

/**
 * Read project registry
 */
export async function readProjectRegistry(projectRoot: string): Promise<UnifiedRegistry> {
  return readUnifiedRegistry(getProjectRegistryPath(projectRoot));
}

/**
 * Write project registry (low-level, does NOT update global index)
 * @internal Use writeProjectRegistryWithSync for most cases
 */
export async function writeProjectRegistry(projectRoot: string, registry: UnifiedRegistry): Promise<void> {
  await writeUnifiedRegistry(getProjectRegistryPath(projectRoot), registry);
}

/**
 * Write project registry AND sync to global index
 * This is the recommended function for updating project registry.
 * Automatically updates global index if global ctx is initialized.
 */
export async function writeProjectRegistryWithSync(
  projectRoot: string,
  registry: UnifiedRegistry
): Promise<void> {
  await writeProjectRegistry(projectRoot, registry);

  const globalInitialized = await isGlobalCtxInitialized();
  if (globalInitialized) {
    await updateGlobalIndex(projectRoot);
  }
}

/**
 * Update global index with project information
 */
export async function updateGlobalIndex(projectRoot: string): Promise<void> {
  const globalRegistry = await readGlobalCtxRegistry();
  const projectRegistry = await readProjectRegistry(projectRoot);

  // Safety check: ensure globalRegistry is valid
  if (!globalRegistry) {
    return;
  }

  if (!globalRegistry.index) {
    globalRegistry.index = {};
  }

  const projectName = path.basename(projectRoot);
  const contexts = Object.entries(projectRegistry.contexts).map(([key, entry]) => ({
    path: key,
    what: entry.preview.what,
    keywords: entry.preview.keywords,
  }));

  const indexEntry: ProjectIndexEntry = {
    path: projectRoot,
    last_synced: new Date().toISOString(),
    context_count: contexts.length,
    contexts,
  };

  globalRegistry.index[projectName] = indexEntry;
  await writeGlobalCtxRegistry(globalRegistry);
}
