import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import { LocalContextRegistry, GlobalContextRegistry, LocalContextEntry } from './types.js';
import { loadConfig } from './config.js';

const LOCAL_REGISTRY_FILE = 'local-context-registry.yml';
const GLOBAL_REGISTRY_FILE = 'global-context-registry.yml';

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
