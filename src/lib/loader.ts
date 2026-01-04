import fs from 'fs/promises';
import path from 'path';
import { LocalContextEntry, GlobalContextEntry, ContextFile, ContextFrontmatter } from './types.js';
import { parseContextFile } from './parser.js';

/**
 * Loaded context data
 */
export interface LoadedLocalContext {
  type: 'local';
  targetPath: string;
  contextPath: string;
  frontmatter: ContextFrontmatter;
  contextContent: string; // Markdown body
  targetFileContent: string | null;
  entry: LocalContextEntry;
}

export interface LoadedGlobalContext {
  type: 'global';
  documentPath: string;
  contextPath: string;
  frontmatter: ContextFrontmatter;
  documentContent: string; // Markdown body
  entry: GlobalContextEntry;
}

export type LoadedContext = LoadedLocalContext | LoadedGlobalContext;

/**
 * Load a local context and its target file
 */
export async function loadLocalContext(
  projectRoot: string,
  targetPath: string,
  entry: LocalContextEntry
): Promise<LoadedLocalContext> {
  const contextPath = path.join(projectRoot, entry.source);

  // Read and parse context file
  const contextFileRaw = await fs.readFile(contextPath, 'utf-8');
  const parsed = parseContextFile(entry.source, contextFileRaw);

  // Try to read target file
  let targetFileContent: string | null = null;
  const absoluteTargetPath = path.join(projectRoot, targetPath.replace(/^\//, ''));

  try {
    targetFileContent = await fs.readFile(absoluteTargetPath, 'utf-8');
  } catch (error) {
    // Target file not found or unreadable
    console.warn(`Warning: Could not read target file: ${targetPath}`);
  }

  return {
    type: 'local',
    targetPath,
    contextPath: entry.source,
    frontmatter: parsed.frontmatter,
    contextContent: parsed.content, // Markdown body
    targetFileContent,
    entry,
  };
}

/**
 * Load a global context document
 */
export async function loadGlobalContext(
  projectRoot: string,
  documentPath: string,
  entry: GlobalContextEntry
): Promise<LoadedGlobalContext> {
  const contextPath = path.join(projectRoot, entry.source);

  // Read and parse document file
  const documentFileRaw = await fs.readFile(contextPath, 'utf-8');
  const parsed = parseContextFile(entry.source, documentFileRaw);

  return {
    type: 'global',
    documentPath,
    contextPath: entry.source,
    frontmatter: parsed.frontmatter,
    documentContent: parsed.content, // Markdown body
    entry,
  };
}

/**
 * Load multiple contexts at once
 */
export async function loadContexts(
  projectRoot: string,
  localContexts: Array<{ targetPath: string; entry: LocalContextEntry }>,
  globalContexts: Array<{ documentPath: string; entry: GlobalContextEntry }>
): Promise<LoadedContext[]> {
  const loaded: LoadedContext[] = [];

  // Load local contexts
  for (const { targetPath, entry } of localContexts) {
    try {
      const loadedContext = await loadLocalContext(projectRoot, targetPath, entry);
      loaded.push(loadedContext);
    } catch (error) {
      console.error(`Error loading local context ${targetPath}:`, error);
    }
  }

  // Load global contexts
  for (const { documentPath, entry } of globalContexts) {
    try {
      const loadedContext = await loadGlobalContext(projectRoot, documentPath, entry);
      loaded.push(loadedContext);
    } catch (error) {
      console.error(`Error loading global context ${documentPath}:`, error);
    }
  }

  return loaded;
}

/**
 * Search contexts by description (simple text matching)
 * This is a basic implementation - AI can do better semantic matching
 */
export interface SearchMatch {
  targetPath?: string;
  documentPath?: string;
  entry: LocalContextEntry | GlobalContextEntry;
  relevanceScore: number;
}

export function searchContexts(
  description: string,
  localRegistry: Record<string, LocalContextEntry>,
  globalRegistry: Record<string, GlobalContextEntry>
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const keywords = description.toLowerCase().split(/\s+/);

  // Search local contexts
  for (const [targetPath, entry] of Object.entries(localRegistry)) {
    const searchText = [
      entry.preview.what,
      ...(entry.preview.keywords || []),
      targetPath,
      entry.source,
    ]
      .join(' ')
      .toLowerCase();

    let score = 0;
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        score += 1;
      }
    }

    if (score > 0) {
      matches.push({
        targetPath,
        entry,
        relevanceScore: score / keywords.length, // Normalize by keyword count
      });
    }
  }

  // Search global contexts
  for (const [documentPath, entry] of Object.entries(globalRegistry)) {
    const searchText = [
      entry.preview.what,
      ...(entry.preview.keywords || []),
      documentPath,
      entry.source,
      entry.folder || '',
    ]
      .join(' ')
      .toLowerCase();

    let score = 0;
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        score += 1;
      }
    }

    if (score > 0) {
      matches.push({
        documentPath,
        entry,
        relevanceScore: score / keywords.length,
      });
    }
  }

  // Sort by relevance score (descending)
  return matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
