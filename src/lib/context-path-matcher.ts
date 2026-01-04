import { minimatch } from 'minimatch';
import path from 'path';
import { ContextPathConfig } from './types.js';
import { readProjectRegistry, readGlobalCtxRegistry, getGlobalCtxDir } from './registry.js';

// ===== Centralized DEFAULT Constants =====
// All context path defaults should be defined here to avoid fragmentation

/** Default context paths for Project scope */
export const DEFAULT_PROJECT_CONTEXT_PATHS: ContextPathConfig[] = [
  { path: '**/*.ctx.md', purpose: 'Bound contexts next to code' },
  { path: '.ctx/contexts/**/*.md', purpose: 'Centralized project contexts' },
];

/** Default context paths for Global scope */
export const DEFAULT_GLOBAL_CONTEXT_PATHS: ContextPathConfig[] = [
  { path: 'contexts/**/*.md', purpose: 'General context documents' },
];

/**
 * Check if a file path matches any of the context_paths patterns
 */
export function matchesContextPaths(
  filePath: string,
  contextPaths: ContextPathConfig[]
): boolean {
  for (const cp of contextPaths) {
    if (minimatch(filePath, cp.path)) {
      return true;
    }
  }
  return false;
}

/**
 * Get context_paths from project registry
 */
export async function getProjectContextPaths(projectRoot: string): Promise<ContextPathConfig[]> {
  try {
    const registry = await readProjectRegistry(projectRoot);
    if (registry.settings?.context_paths && registry.settings.context_paths.length > 0) {
      return registry.settings.context_paths;
    }
  } catch {
    // Registry doesn't exist or is invalid
  }

  return DEFAULT_PROJECT_CONTEXT_PATHS;
}

/**
 * Get context_paths from global registry
 */
export async function getGlobalContextPaths(): Promise<ContextPathConfig[]> {
  try {
    const registry = await readGlobalCtxRegistry();
    if (registry.settings?.context_paths && registry.settings.context_paths.length > 0) {
      return registry.settings.context_paths;
    }
  } catch {
    // Registry doesn't exist or is invalid
  }

  return DEFAULT_GLOBAL_CONTEXT_PATHS;
}

/**
 * Suggest alternative paths that would match context_paths
 */
export function suggestMatchingPaths(
  filePath: string,
  contextPaths: ContextPathConfig[]
): string[] {
  const suggestions: string[] = [];
  const basename = path.basename(filePath);

  for (const cp of contextPaths) {
    // Extract base directory from pattern
    const baseDir = cp.path.split('**')[0].replace(/\*.*$/, '').trim();

    if (baseDir && baseDir !== '') {
      if (cp.path.includes('*.ctx.md')) {
        // Suggest .ctx.md variant
        const name = basename.replace(/\.md$/, '.ctx.md');
        suggestions.push(name);
      } else if (baseDir) {
        // Suggest in base directory
        suggestions.push(path.join(baseDir, basename));
      }
    }
  }

  // Remove duplicates
  return [...new Set(suggestions)];
}
