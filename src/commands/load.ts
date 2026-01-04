import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  readGlobalCtxRegistry,
  getGlobalCtxDir,
} from '../lib/registry.js';
import { ContextEntry } from '../lib/types.js';
import { findMatchingContexts, MatchedContext } from '../lib/target-matcher.js';

interface LoadOptions {
  keywords?: string[];  // Keywords for searching context metadata
  target?: string;      // Target file path for auto-matching (supports glob)
  paths?: boolean;      // Output paths only (newline separated)
  pretty?: boolean;     // Human-readable markdown output
  global?: boolean;     // Search global only
  all?: boolean;        // Search both project and global
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
      ...(entry.preview?.keywords || []),
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
async function handleAutoModeFromStdin(
  projectRoot: string | null,
  options: LoadOptions = {}
): Promise<void> {
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

  await handleTargetMode(filePath, projectRoot, options);
}

/**
 * Determine search scope based on options
 */
function determineScope(options: LoadOptions): { searchProject: boolean; searchGlobal: boolean } {
  if (options.all) {
    return { searchProject: true, searchGlobal: true };
  }
  if (options.global) {
    return { searchProject: false, searchGlobal: true };
  }
  // Default: project only
  return { searchProject: true, searchGlobal: false };
}

/**
 * Auto mode: path-based matching with --target
 */
async function handleTargetMode(
  filePath: string,
  projectRoot: string | null,
  options: LoadOptions = {}
): Promise<void> {
  // Skip context files
  if (filePath.endsWith('.ctx.md') || filePath.endsWith('/ctx.md')) {
    process.exit(0);
  }

  // Skip .ctx directory
  if (filePath.includes('/.ctx/')) {
    process.exit(0);
  }

  const { searchProject, searchGlobal } = determineScope(options);
  const allMatches: MatchedContext[] = [];
  const effectiveRoot = projectRoot || process.cwd();

  // Check project registry
  if (searchProject && projectRoot) {
    const projectRegistry = await readProjectRegistry(projectRoot);
    const projectMatches = findMatchingContexts(
      projectRegistry.contexts || {},
      filePath,
      projectRoot,
      'project',
      projectRoot
    );
    allMatches.push(...projectMatches);
  }

  // Check global registry
  if (searchGlobal) {
    const globalRegistry = await readGlobalCtxRegistry();
    const globalMatches = findMatchingContexts(
      globalRegistry.contexts || {},
      filePath,
      effectiveRoot,
      'global',
      getGlobalCtxDir()
    );
    allMatches.push(...globalMatches);
  }

  if (allMatches.length === 0) {
    process.exit(0);
  }

  // Sort by priority (lower = higher priority)
  allMatches.sort((a, b) => a.priority - b.priority);

  // Output based on options
  if (options.paths) {
    // Paths only output
    allMatches.forEach(m => console.log(m.contextPath));
  } else {
    // JSON (default) or --pretty markdown
    await outputContexts(allMatches, projectRoot, options);
  }
}

/**
 * Manual mode: keyword-based search
 */
async function handleManualMode(
  keywords: string[],
  projectRoot: string | null,
  options: LoadOptions = {},
  scope?: { searchProject: boolean; searchGlobal: boolean }
): Promise<void> {
  // Use provided scope (respects fallback) or determine from options
  const { searchProject, searchGlobal } = scope || determineScope(options);
  const allMatches: MatchedContext[] = [];

  // Check project registry
  if (searchProject && projectRoot) {
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
  if (searchGlobal) {
    const globalRegistry = await readGlobalCtxRegistry();
    const globalMatches = findKeywordMatchingContexts(
      globalRegistry.contexts || {},
      keywords,
      'global',
      getGlobalCtxDir()
    );
    allMatches.push(...globalMatches);
  }

  if (allMatches.length === 0) {
    console.log('No matching contexts found.');
    return;
  }

  // Sort by priority (higher = better match)
  allMatches.sort((a, b) => b.priority - a.priority);

  // Output based on options
  if (options.paths) {
    allMatches.forEach(m => console.log(m.contextPath));
  } else {
    await outputContexts(allMatches, projectRoot, options);
  }
}

/**
 * Output matched contexts (JSON default, --pretty for markdown)
 */
async function outputContexts(
  matches: MatchedContext[],
  projectRoot: string | null,
  options: LoadOptions = {}
): Promise<void> {
  if (options.pretty) {
    // Human-readable markdown output
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
  } else {
    // Default: JSON output (CORE_PRINCIPLE #6)
    const results = await Promise.all(
      matches.map(async (match) => {
        const content = await loadContextContent(match.contextPath);
        const relativePath = projectRoot
          ? path.relative(projectRoot, match.contextPath)
          : match.contextPath;

        return {
          path: relativePath,
          target: match.target || null,
          source: match.source,
          matchType: match.matchType,
          what: match.preview?.what || null,
          keywords: match.preview?.keywords || [],
          content: content || null,
        };
      })
    );
    console.log(JSON.stringify(results, null, 2));
  }
}

/**
 * Main load command
 *
 * Default: project only
 * --global: global only
 * --all: both project and global
 */
export async function loadCommand(options: LoadOptions): Promise<void> {
  const projectRoot = await findProjectRoot(process.cwd());
  const globalInitialized = await isGlobalCtxInitialized();

  // Validate scope with global fallback for read commands (CORE_PRINCIPLE #5)
  let { searchProject, searchGlobal } = determineScope(options);

  if (searchProject && !projectRoot) {
    if (globalInitialized) {
      // Warning + global fallback
      console.error(chalk.yellow('⚠️  No project found. Falling back to global contexts.'));
      searchProject = false;
      searchGlobal = true;
    } else {
      console.error(chalk.red('✗ Error: Not in a ctx project and global ctx not initialized.'));
      console.log(chalk.gray("  Run 'ctx init' to initialize global, or 'ctx init .' for project."));
      process.exit(1);
    }
  }

  if (searchGlobal && !globalInitialized) {
    console.error(chalk.red('✗ Error: Global ctx not initialized.'));
    console.log(chalk.gray("  Run 'ctx init' first."));
    process.exit(1);
  }

  // Update options to reflect fallback scope
  if (!searchProject && searchGlobal && !options.global) {
    options.global = true;
  }

  const keywords = options.keywords || [];

  // --target option: path-based auto matching (supports glob)
  if (options.target) {
    await handleTargetMode(options.target, projectRoot, options);
    return;
  }

  // No keywords and stdin has data: hook integration (parse JSON from stdin)
  if (keywords.length === 0 && !process.stdin.isTTY) {
    await handleAutoModeFromStdin(projectRoot, options);
    return;
  }

  // --keywords provided: keyword search
  if (keywords.length > 0) {
    await handleManualMode(keywords, projectRoot, options, { searchProject, searchGlobal });
    return;
  }

  // No input at all
  console.error('Error: Use --keywords <words> or --target <path>');
  process.exit(1);
}
