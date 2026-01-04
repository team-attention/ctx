import path from 'path';
import { minimatch } from 'minimatch';
import { ContextEntry } from './types.js';

/**
 * Check if target pattern is a glob pattern
 */
export function isGlobPattern(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[');
}

/**
 * Check if file path matches a target pattern
 * Supports exact match, glob patterns, and folder targets
 */
export function matchesTarget(filePath: string, target: string, projectRoot: string): boolean {
  // Normalize file path to relative
  const absoluteFile = path.isAbsolute(filePath)
    ? filePath
    : path.join(projectRoot, filePath);
  const relativePath = path.relative(projectRoot, absoluteFile);

  // Handle folder targets (ending with /)
  if (target.endsWith('/')) {
    const targetWithoutSlash = target.slice(0, -1);
    return relativePath.startsWith(target) || relativePath.startsWith(targetWithoutSlash);
  }

  // Normalize target (remove leading /)
  const normalizedTarget = target.startsWith('/') ? target.slice(1) : target;

  if (isGlobPattern(normalizedTarget)) {
    return minimatch(relativePath, normalizedTarget, { dot: true });
  } else {
    return relativePath === normalizedTarget;
  }
}

export interface MatchedContext {
  contextPath: string;
  target: string;
  source: 'project' | 'global';
  matchType: 'exact' | 'glob';
  priority: number;
  preview?: {
    what?: string;
    keywords?: string[];
  };
}

/**
 * Find contexts that match a given file path
 * Used by load, check, status commands with --target option
 */
export function findMatchingContexts(
  contexts: Record<string, ContextEntry>,
  filePath: string,
  projectRoot: string,
  source: 'project' | 'global',
  basePath: string
): MatchedContext[] {
  const matches: MatchedContext[] = [];

  for (const [contextKey, entry] of Object.entries(contexts)) {
    if (!entry.target) {
      continue;
    }

    if (matchesTarget(filePath, entry.target, projectRoot)) {
      const isGlob = isGlobPattern(entry.target) || entry.target.endsWith('/');

      let priority: number;
      if (!isGlob) {
        priority = source === 'project' ? 1 : 2;
      } else {
        priority = source === 'project' ? 3 : 4;
      }

      matches.push({
        contextPath: path.join(basePath, contextKey),
        target: entry.target,
        source,
        matchType: isGlob ? 'glob' : 'exact',
        priority,
        preview: entry.preview,
      });
    }
  }

  return matches;
}
