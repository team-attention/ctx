/**
 * Type definitions for context management system
 */

// ===== Config Types =====

export type FrontmatterMode = 'required' | 'optional' | 'none';

export interface FrontmatterConfig {
  local: FrontmatterMode;
  global: FrontmatterMode;
}

export interface Config {
  version: string;
  editor: string;
  local: {
    patterns: string | string[];
    ignore: string[];
  };
  global: {
    directory: string;
    patterns: string | string[];
    ignore: string[];
  };
  frontmatter: FrontmatterConfig;
}

// ===== Context File Types =====

export interface ContextMeta {
  version: string;
  target?: string; // Absolute path from project root (e.g., /src/utils/url.ts)
}

export interface ContextFrontmatter {
  what: string;
  when: string[];
  not_when?: string[];
  future?: string[];
}

export interface ContextFile {
  meta: ContextMeta;
  frontmatter: ContextFrontmatter;
  content: string; // Markdown body content
}

// ===== Context Content Types =====

export interface ContextPreview {
  what: string;
  when: string[];
  not_when?: string[];
}

// ===== Registry Types =====

/** Context scope in 3-level hierarchy */
export type ContextScope = 'local' | 'project' | 'global';

/** Unified context entry for all scopes */
export interface ContextEntry {
  scope: ContextScope;
  source: string; // Relative path to context file
  target?: string; // For local contexts: path to target file
  checksum: string; // MD5 checksum of context file
  target_checksum?: string; // For local contexts: MD5 checksum of target file
  last_modified: string; // ISO timestamp
  preview: ContextPreview; // Mechanical extract from frontmatter
}

/** Unified registry structure for both Global and Project */
export interface UnifiedRegistry {
  meta: {
    version: string;
    last_synced: string; // ISO timestamp
  };
  contexts: Record<string, ContextEntry>; // Key: relative path to context file
  index?: Record<string, ProjectIndexEntry>; // Global only: index of known projects
}

/** Entry in Global registry's project index */
export interface ProjectIndexEntry {
  path: string; // Absolute path to project root
  last_synced: string; // ISO timestamp
  context_count: number;
  contexts: Array<{
    path: string; // Relative path within project
    what: string;
    when: string[];
  }>;
}

// Legacy types (kept for backward compatibility during migration)
export interface LocalContextEntry {
  type: 'file';
  source: string; // Relative path to context file (e.g., src/utils/url.ctx.yml)
  checksum: string; // MD5 checksum of context file
  target_checksum: string; // MD5 checksum of target file
  last_modified: string; // ISO timestamp
  preview: ContextPreview; // Mechanical extract from context file
}

export interface GlobalContextEntry {
  type: 'document';
  source: string; // Relative path (e.g., ctx/rules/typescript.md)
  folder: string | null; // Folder name (e.g., 'rules') or null for root files
  checksum: string; // MD5 checksum of file
  last_modified: string; // ISO timestamp
  preview: ContextPreview; // Mechanical extract from frontmatter
}

export interface GlobalFolderMeta {
  checksum: string; // Combined checksum of all files in folder
  last_modified: string; // Most recent file modification
}

export interface LocalContextRegistry {
  meta: {
    version: string;
    last_synced: string; // ISO timestamp
  };
  contexts: Record<string, LocalContextEntry>; // Key: absolute target path
}

export interface GlobalContextRegistry {
  meta: {
    version: string;
    last_synced: string; // ISO timestamp
  };
  contexts: Record<string, GlobalContextEntry>; // Key: absolute document path (e.g., /rules/typescript.md)
  folders: Record<string, GlobalFolderMeta>; // Key: folder name (e.g., 'rules', 'architecture')
}

// ===== Sync Types =====

export interface SyncOptions {
  local?: boolean;
  global?: boolean;
}

export interface SyncResult {
  localSynced: number;
  globalSynced: number;
  errors: string[];
}

// ===== Scanner Types =====

export interface ScannedContext {
  contextPath: string; // Absolute path to context file
  relativePath: string; // Relative path from project root
  content: string; // File content
}

// ===== Check Types =====

export interface CheckOptions {
  local?: boolean;
  global?: boolean;
  fix?: boolean;
  pretty?: boolean;
  path?: string; // Check only a specific context path
}

export interface CheckIssue {
  type: 'new' | 'deleted' | 'modified' | 'stale_target' | 'error';
  scope: 'local' | 'global';
  contextPath: string;
  targetPath?: string;
  message: string;
  lastModified?: string;
}

export interface CheckResult {
  status: 'fresh' | 'stale' | 'error';
  summary: {
    local: {
      total: number;
      fresh: number;
      stale: number;
      new: number;
      deleted: number;
      errors: number;
    };
    global: {
      total: number;
      fresh: number;
      stale: number;
      new: number;
      deleted: number;
      errors: number;
    };
  };
  issues: CheckIssue[];
}
