import fs from 'fs/promises';
import path from 'path';
import { minimatch } from 'minimatch';
import {
  findProjectRoot,
  readProjectRegistry,
  readGlobalCtxRegistry,
  GLOBAL_CTX_DIR,
} from '../lib/registry.js';
import { ContextEntry } from '../lib/types.js';

interface MatchedContext {
  contextPath: string;
  target: string;
  source: 'project' | 'global';
  matchType: 'exact' | 'glob';
  priority: number;
  preview?: {
    what?: string;
    when?: string[];
  };
}

interface LoadOptions {
  file?: string;
}

/**
 * Check if target pattern is a glob pattern
 */
function isGlobPattern(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[');
}

/**
 * Check if file path matches a target pattern
 */
function matchesTarget(filePath: string, target: string, projectRoot: string): boolean {
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

/**
 * Find matching contexts from registry (for auto mode)
 */
function findAutoMatchingContexts(
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

/**
 * Find matching contexts by keywords (for manual mode)
 */
function findKeywordMatchingContexts(
  contexts: Record<string, ContextEntry>,
  keywords: string[],
  source: 'project' | 'global',
  basePath: string
): MatchedContext[] {
  const matches: MatchedContext[] = [];
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  for (const [contextKey, entry] of Object.entries(contexts)) {
    const searchText = [
      entry.preview?.what || '',
      ...(entry.preview?.when || []),
    ].join(' ').toLowerCase();

    let score = 0;
    for (const keyword of lowerKeywords) {
      if (searchText.includes(keyword)) {
        score++;
      }
    }

    if (score > 0) {
      matches.push({
        contextPath: path.join(basePath, contextKey),
        target: entry.target || '',
        source,
        matchType: 'exact',
        priority: source === 'project' ? score * 2 : score,
        preview: entry.preview,
      });
    }
  }

  return matches;
}

/**
 * Load context file content
 */
async function loadContextContent(contextPath: string): Promise<string | null> {
  try {
    return await fs.readFile(contextPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Auto mode: read from stdin (hook integration)
 */
async function handleAutoModeFromStdin(projectRoot: string | null): Promise<void> {
  let input = '';

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    process.exit(0);
  }

  let parsedInput: { tool_input?: { file_path?: string } };
  try {
    parsedInput = JSON.parse(input);
  } catch {
    console.error('Error: Invalid JSON input');
    process.exit(1);
  }

  const filePath = parsedInput.tool_input?.file_path;
  if (!filePath) {
    process.exit(0);
  }

  await handleAutoMode(filePath, projectRoot);
}

/**
 * Auto mode: path-based matching
 */
async function handleAutoMode(filePath: string, projectRoot: string | null): Promise<void> {
  // Skip context files
  if (filePath.endsWith('.ctx.md') || filePath.endsWith('/ctx.md')) {
    process.exit(0);
  }

  // Skip .ctx directory
  if (filePath.includes('/.ctx/')) {
    process.exit(0);
  }

  const allMatches: MatchedContext[] = [];
  const effectiveRoot = projectRoot || process.cwd();

  // Check project registry
  if (projectRoot) {
    const projectRegistry = await readProjectRegistry(projectRoot);
    const projectMatches = findAutoMatchingContexts(
      projectRegistry.contexts || {},
      filePath,
      projectRoot,
      'project',
      projectRoot
    );
    allMatches.push(...projectMatches);
  }

  // Check global registry
  const globalRegistry = await readGlobalCtxRegistry();
  const globalMatches = findAutoMatchingContexts(
    globalRegistry.contexts || {},
    filePath,
    effectiveRoot,
    'global',
    GLOBAL_CTX_DIR
  );
  allMatches.push(...globalMatches);

  if (allMatches.length === 0) {
    process.exit(0);
  }

  // Sort by priority (lower = higher priority)
  allMatches.sort((a, b) => a.priority - b.priority);

  // Output contexts
  await outputContexts(allMatches, projectRoot);
}

/**
 * Manual mode: keyword-based search
 */
async function handleManualMode(keywords: string[], projectRoot: string | null): Promise<void> {
  const allMatches: MatchedContext[] = [];

  // Check project registry
  if (projectRoot) {
    const projectRegistry = await readProjectRegistry(projectRoot);
    const projectMatches = findKeywordMatchingContexts(
      projectRegistry.contexts || {},
      keywords,
      'project',
      projectRoot
    );
    allMatches.push(...projectMatches);
  }

  // Check global registry
  const globalRegistry = await readGlobalCtxRegistry();
  const globalMatches = findKeywordMatchingContexts(
    globalRegistry.contexts || {},
    keywords,
    'global',
    GLOBAL_CTX_DIR
  );
  allMatches.push(...globalMatches);

  if (allMatches.length === 0) {
    console.log('No matching contexts found.');
    return;
  }

  // Sort by priority (higher = better match)
  allMatches.sort((a, b) => b.priority - a.priority);

  // Output contexts
  await outputContexts(allMatches, projectRoot);
}

/**
 * Output matched contexts
 */
async function outputContexts(matches: MatchedContext[], projectRoot: string | null): Promise<void> {
  for (const match of matches) {
    const content = await loadContextContent(match.contextPath);
    if (content) {
      const relativePath = projectRoot
        ? path.relative(projectRoot, match.contextPath)
        : match.contextPath;

      const matchTypeLabel = match.matchType === 'exact' ? 'exact' : 'pattern';
      const sourceLabel = match.source === 'project' ? 'Project' : 'Global';

      console.log(`
---
**Context loaded:** \`${relativePath}\` (${sourceLabel}, ${matchTypeLabel}${match.target ? `: \`${match.target}\`` : ''})
${match.preview?.what ? `> ${match.preview.what}` : ''}

${content}
---`);
    }
  }
}

/**
 * Main load command
 */
export async function loadCommand(
  keywords: string[],
  options: LoadOptions
): Promise<void> {
  const projectRoot = await findProjectRoot(process.cwd());

  // --file option: path-based auto matching
  if (options.file) {
    await handleAutoMode(options.file, projectRoot);
    return;
  }

  // No keywords and stdin has data: hook integration (parse JSON from stdin)
  if (keywords.length === 0 && !process.stdin.isTTY) {
    await handleAutoModeFromStdin(projectRoot);
    return;
  }

  // Keywords provided: manual keyword search
  if (keywords.length > 0) {
    await handleManualMode(keywords, projectRoot);
    return;
  }

  // No input at all
  console.error('Error: Provide keywords for search, or use --file <path> for auto-matching');
  process.exit(1);
}
