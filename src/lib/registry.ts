import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import YAML from 'yaml';
import { LocalContextRegistry, GlobalContextRegistry, LocalContextEntry, UnifiedRegistry, ProjectIndexEntry } from './types.js';
import { loadConfig } from './config.js';

// New 3-level constants
export const CTX_DIR = '.ctx';
export const REGISTRY_FILE = 'registry.yaml';
export const CONTEXTS_DIR = 'contexts';
export const GLOBAL_CTX_DIR = path.join(os.homedir(), CTX_DIR);

// Legacy constants (kept for backward compatibility)
const LOCAL_REGISTRY_FILE = 'local-context-registry.yml';
const GLOBAL_REGISTRY_FILE = 'global-context-registry.yml';

// ===== New 3-Level Registry Functions =====

/**
 * Get path to global registry (~/.ctx/registry.yaml)
 */
export function getGlobalCtxRegistryPath(): string {
  return path.join(GLOBAL_CTX_DIR, REGISTRY_FILE);
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
 * Read unified registry (new format)
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
 * Write unified registry (new format)
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
 * Read global registry (new format)
 */
export async function readGlobalCtxRegistry(): Promise<UnifiedRegistry> {
  return readUnifiedRegistry(getGlobalCtxRegistryPath());
}

/**
 * Write global registry (new format)
 */
export async function writeGlobalCtxRegistry(registry: UnifiedRegistry): Promise<void> {
  await writeUnifiedRegistry(getGlobalCtxRegistryPath(), registry);
}

/**
 * Read project registry (new format)
 */
export async function readProjectRegistry(projectRoot: string): Promise<UnifiedRegistry> {
  return readUnifiedRegistry(getProjectRegistryPath(projectRoot));
}

/**
 * Write project registry (new format)
 */
export async function writeProjectRegistry(projectRoot: string, registry: UnifiedRegistry): Promise<void> {
  await writeUnifiedRegistry(getProjectRegistryPath(projectRoot), registry);
}

/**
 * Update global index with project information
 */
export async function updateGlobalIndex(projectRoot: string): Promise<void> {
  const globalRegistry = await readGlobalCtxRegistry();
  const projectRegistry = await readProjectRegistry(projectRoot);

  if (!globalRegistry.index) {
    globalRegistry.index = {};
  }

  const projectName = path.basename(projectRoot);
  const contexts = Object.entries(projectRegistry.contexts).map(([key, entry]) => ({
    path: key,
    what: entry.preview.what,
    when: entry.preview.when,
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

// ===== Legacy Registry Functions (backward compatibility) =====

/**
 * Get path to local registry file
 */
export async function getLocalRegistryPath(projectRoot: string): Promise<string> {
  const config = await loadConfig(projectRoot);
  return path.join(projectRoot, config.global.directory, LOCAL_REGISTRY_FILE);
}

/**
 * Get path to global registry file
 */
export async function getGlobalRegistryPath(projectRoot: string): Promise<string> {
  const config = await loadConfig(projectRoot);
  return path.join(projectRoot, config.global.directory, GLOBAL_REGISTRY_FILE);
}

/**
 * Read local registry
 */
export async function readLocalRegistry(projectRoot: string): Promise<LocalContextRegistry> {
  const registryPath = await getLocalRegistryPath(projectRoot);

  try {
    const content = await fs.readFile(registryPath, 'utf-8');
    const parsed = YAML.parse(content) as any;

    // Handle legacy flat structure (backward compatibility)
    if (parsed.version && !parsed.meta) {
      return {
        meta: {
          version: parsed.version || '1.0.0',
          last_synced: parsed.last_synced || new Date().toISOString(),
        },
        contexts: parsed.contexts || {},
      };
    }

    // Modern nested structure
    return parsed as LocalContextRegistry;
  } catch (error) {
    // Return empty registry if file doesn't exist
    return {
      meta: {
        version: '1.0.0',
        last_synced: new Date().toISOString(),
      },
      contexts: {},
    };
  }
}

/**
 * Write local registry
 */
export async function writeLocalRegistry(
  projectRoot: string,
  registry: LocalContextRegistry
): Promise<void> {
  const registryPath = await getLocalRegistryPath(projectRoot);

  // Update last_synced
  registry.meta.last_synced = new Date().toISOString();

  const yamlContent = YAML.stringify(registry);
  await fs.writeFile(registryPath, yamlContent, 'utf-8');
}

/**
 * Read global registry
 */
export async function readGlobalRegistry(projectRoot: string): Promise<GlobalContextRegistry> {
  const registryPath = await getGlobalRegistryPath(projectRoot);

  try {
    const content = await fs.readFile(registryPath, 'utf-8');
    const parsed = YAML.parse(content) as any;

    // Handle legacy flat structure (backward compatibility)
    if (parsed.version && !parsed.meta) {
      return {
        meta: {
          version: parsed.version || '1.0.0',
          last_synced: parsed.last_synced || new Date().toISOString(),
        },
        contexts: parsed.contexts || {},
        folders: parsed.folders || {},
      };
    }

    // Modern nested structure
    return parsed as GlobalContextRegistry;
  } catch (error) {
    // Return empty registry if file doesn't exist
    return {
      meta: {
        version: '1.0.0',
        last_synced: new Date().toISOString(),
      },
      contexts: {},
      folders: {},
    };
  }
}

/**
 * Write global registry
 */
export async function writeGlobalRegistry(
  projectRoot: string,
  registry: GlobalContextRegistry
): Promise<void> {
  const registryPath = await getGlobalRegistryPath(projectRoot);

  // Update last_synced
  registry.meta.last_synced = new Date().toISOString();

  const yamlContent = YAML.stringify(registry);
  await fs.writeFile(registryPath, yamlContent, 'utf-8');
}

/**
 * Find context entry by target path
 * @param projectRoot - Project root directory
 * @param targetPath - Target file path (relative or absolute from project root)
 * @returns Context path and entry if found, null otherwise
 */
export async function findContextByTarget(
  projectRoot: string,
  targetPath: string
): Promise<{ contextPath: string; entry: LocalContextEntry } | null> {
  const registry = await readLocalRegistry(projectRoot);

  // Normalize target path (ensure it starts with /)
  const normalizedTarget = targetPath.startsWith('/')
    ? targetPath
    : `/${targetPath}`;

  const entry = registry.contexts[normalizedTarget];
  if (entry) {
    return { contextPath: entry.source, entry };
  }

  return null;
}
