import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// New 3-level constants
const CTX_DIR = '.ctx';
const REGISTRY_FILE = 'registry.yaml';

/** Get global ctx directory (uses current HOME, not cached) */
function getGlobalCtxDir(): string {
  return path.join(os.homedir(), CTX_DIR);
}

/**
 * Check if a file or directory exists
 */
export async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the project is initialized
 * Checks both new format (.ctx/registry.yaml) and legacy format (ctx.config.yaml)
 */
export async function isProjectInitialized(projectRoot?: string): Promise<boolean> {
  const root = projectRoot || process.cwd();

  // Check new format first
  const newRegistryPath = path.join(root, CTX_DIR, REGISTRY_FILE);
  if (await fileExists(newRegistryPath)) {
    return true;
  }

  // Fall back to legacy format
  const configPath = path.join(root, 'ctx.config.yaml');
  return fileExists(configPath);
}

/**
 * Check if global ctx is initialized (~/.ctx/registry.yaml exists)
 */
export async function isGlobalInitialized(): Promise<boolean> {
  const registryPath = path.join(getGlobalCtxDir(), REGISTRY_FILE);
  return fileExists(registryPath);
}

/**
 * Find the project root by looking for ctx.config.yaml
 * Returns the current working directory for now
 */
export function getProjectRoot(): string {
  return process.cwd();
}

/**
 * Convert a target file path to its context file path
 * Examples:
 *   src/services/payment.ts -> src/services/payment.ctx.md
 *   src/services/ -> src/services/ctx.md
 */
export function resolveContextPath(targetPath: string): string {
  // Remove trailing slash if directory
  const normalized = targetPath.replace(/\/$/, '');

  // If it's a directory (no extension), create ctx.md
  const ext = path.extname(normalized);
  if (!ext) {
    return path.join(normalized, 'ctx.md');
  }

  // If it's a file, replace extension with .ctx.md
  const dir = path.dirname(normalized);
  const basename = path.basename(normalized, ext);
  return path.join(dir, `${basename}.ctx.md`);
}

/**
 * Convert a relative path to absolute path from project root
 * Returns path with leading slash for registry
 */
export function resolveAbsoluteTargetPath(targetPath: string): string {
  // Normalize path separators
  const normalized = targetPath.replace(/\\/g, '/');

  // Remove trailing slash
  const cleaned = normalized.replace(/\/$/, '');

  // Ensure leading slash
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

/**
 * Get the directory path for a file path
 */
export function getDirectory(filepath: string): string {
  return path.dirname(filepath);
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Resolve global context document path
 * Ensures path is in global directory and has .md extension
 * Examples:
 *   architecture/caching, 'ctx' -> ctx/architecture/caching.md
 *   ctx/rules/api-design.md, 'ctx' -> ctx/rules/api-design.md
 *   caching, 'docs' -> docs/caching.md
 */
export function resolveGlobalContextPath(targetPath: string, globalDir: string): string {
  // Normalize path separators
  let normalized = targetPath.replace(/\\/g, '/');

  // Remove leading slash if present
  normalized = normalized.replace(/^\//, '');

  // Add global directory prefix if not present
  if (!normalized.startsWith(`${globalDir}/`)) {
    normalized = `${globalDir}/${normalized}`;
  }

  // Add .md extension if not present
  if (!normalized.endsWith('.md')) {
    normalized = `${normalized}.md`;
  }

  return normalized;
}

/**
 * Extract document title from path for global context
 * Examples:
 *   ctx/architecture/caching.md -> Caching
 *   ctx/rules/api-design.md -> Api Design
 */
export function extractDocumentTitle(globalPath: string): string {
  const basename = path.basename(globalPath, '.md');
  // Convert kebab-case or snake_case to Title Case
  return basename
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get target from frontmatter
 *
 * SoT (Source of Truth) is the frontmatter's target field.
 * - target exists → bound context (linked to specific file/pattern)
 * - target missing → standalone context (loaded by keywords)
 *
 * File naming convention (*.ctx.md) is for identification only,
 * it does NOT determine binding.
 */
export function getTargetFromFrontmatter(
  explicitTarget?: string
): string | null {
  // Only use explicit target from frontmatter
  // No inference from filename
  return explicitTarget || null;
}

/**
 * Add entry to .gitignore if it doesn't already exist
 * Creates .gitignore if it doesn't exist
 */
export async function addToGitignore(projectRoot: string, entry: string): Promise<boolean> {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  let content = '';
  let exists = false;

  try {
    content = await fs.readFile(gitignorePath, 'utf-8');
    exists = true;
  } catch {
    // .gitignore doesn't exist, will create it
  }

  // Check if entry already exists (exact match or as a line)
  const lines = content.split('\n');
  const trimmedEntry = entry.trim();

  if (lines.some(line => line.trim() === trimmedEntry)) {
    return false; // Entry already exists
  }

  const ctxComment = '# generated by ctx';
  const hasCtxComment = lines.some(line => line.trim() === ctxComment);

  // Add entry with comment header if needed
  let newContent: string;
  if (!exists) {
    // New file - add comment and entry
    newContent = `${ctxComment}\n${trimmedEntry}\n`;
  } else if (!hasCtxComment) {
    // File exists but no ctx comment yet - add comment and entry
    const contentWithNewline = content.endsWith('\n') ? content : `${content}\n`;
    newContent = `${contentWithNewline}${ctxComment}\n${trimmedEntry}\n`;
  } else {
    // File exists with ctx comment - just add entry
    const contentWithNewline = content.endsWith('\n') ? content : `${content}\n`;
    newContent = `${contentWithNewline}${trimmedEntry}\n`;
  }

  await fs.writeFile(gitignorePath, newContent, 'utf-8');
  return true; // Entry was added
}

/**
 * Update ctx-related entries in .gitignore
 * Removes old ctx entries and adds current ones
 */
export async function updateCtxGitignore(projectRoot: string, entries: string[]): Promise<number> {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  let content = '';

  try {
    content = await fs.readFile(gitignorePath, 'utf-8');
  } catch {
    // .gitignore doesn't exist, will create it
  }

  const lines = content.split('\n');
  const ctxComment = '# generated by ctx';

  // Find ctx section boundaries
  let ctxStartIdx = -1;
  let ctxEndIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === ctxComment) {
      ctxStartIdx = i;
      // Find the end of ctx section (next empty line or comment, or end of file)
      for (let j = i + 1; j < lines.length; j++) {
        const trimmed = lines[j].trim();
        if (trimmed === '' || (trimmed.startsWith('#') && trimmed !== ctxComment)) {
          ctxEndIdx = j - 1;
          break;
        }
      }
      if (ctxEndIdx === -1) {
        // Section goes to end of file
        ctxEndIdx = lines.length - 1;
      }
      break;
    }
  }

  // Build new ctx section
  const newCtxSection = [ctxComment, ...entries];

  let newLines: string[];
  let updatedCount = 0;

  if (ctxStartIdx === -1) {
    // No ctx section exists, add at the end
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    if (nonEmptyLines.length > 0 && !content.endsWith('\n')) {
      newLines = [...lines, '', ...newCtxSection, ''];
    } else {
      newLines = [...lines, ...newCtxSection, ''];
    }
    updatedCount = entries.length;
  } else {
    // Replace existing ctx section
    const beforeSection = lines.slice(0, ctxStartIdx);
    const afterSection = lines.slice(ctxEndIdx + 1);

    // Check if entries have actually changed
    const oldEntries = lines.slice(ctxStartIdx + 1, ctxEndIdx + 1).filter(line => line.trim() !== '');
    const oldSet = new Set(oldEntries.map(e => e.trim()));
    const newSet = new Set(entries.map(e => e.trim()));

    if (oldSet.size !== newSet.size || ![...oldSet].every(e => newSet.has(e))) {
      newLines = [...beforeSection, ...newCtxSection, ...afterSection];
      updatedCount = entries.length;
    } else {
      // No changes needed
      return 0;
    }
  }

  // Clean up multiple consecutive empty lines
  const cleanedLines: string[] = [];
  let prevEmpty = false;
  for (const line of newLines) {
    const isEmpty = line.trim() === '';
    if (isEmpty && prevEmpty) {
      continue; // Skip consecutive empty lines
    }
    cleanedLines.push(line);
    prevEmpty = isEmpty;
  }

  // Ensure file ends with newline
  const newContent = cleanedLines.join('\n') + (cleanedLines[cleanedLines.length - 1] !== '' ? '\n' : '');

  await fs.writeFile(gitignorePath, newContent, 'utf-8');
  return updatedCount;
}
