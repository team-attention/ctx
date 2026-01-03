import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ContextTemplateData {
  target?: string; // Optional target path/pattern
  title: string; // Document title (derived from filename)
}

/**
 * Load the unified context template
 */
export async function loadContextTemplate(): Promise<string> {
  const templatePath = path.join(__dirname, '..', 'templates', 'context.md');

  try {
    return await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    throw new Error(`Template not found at: ${templatePath}`);
  }
}

/**
 * Render context template with data
 * - If target provided: fills in target value
 * - If no target: leaves target empty (can be filled later)
 */
export function renderContextTemplate(template: string, data: ContextTemplateData): string {
  let rendered = template;

  // Handle TARGET: if target exists, fill value, otherwise leave empty
  rendered = rendered.replace('{{TARGET}}', data.target || '');

  // Replace TITLE
  rendered = rendered.replace(/\{\{TITLE\}\}/g, data.title);

  return rendered;
}

// ===== Legacy exports for backward compatibility =====

/** @deprecated Use ContextTemplateData instead */
export interface TemplateData {
  targetPath?: string;
  documentTitle?: string;
  [key: string]: string | undefined;
}

/** @deprecated Use loadContextTemplate instead */
export type ContextType = 'local' | 'global';

/** @deprecated Use loadContextTemplate instead */
export async function loadTemplate(
  _contextType: ContextType = 'local',
  _templateType: string = 'default'
): Promise<string> {
  return loadContextTemplate();
}

/** @deprecated Use renderContextTemplate instead */
export function renderTemplate(template: string, data: TemplateData): string {
  // Convert old format to new format
  const newData: ContextTemplateData = {
    target: data.targetPath,
    title: data.documentTitle || data.targetPath || 'Untitled',
  };
  return renderContextTemplate(template, newData);
}

// ===== AI Command & Hook Templates =====

/**
 * Get all AI command template names
 */
export async function getAICommandTemplates(): Promise<string[]> {
  const templatesDir = path.join(__dirname, '..', 'templates', 'ai-commands');

  try {
    const entries = await fs.readdir(templatesDir, { withFileTypes: true, recursive: true });
    const templates: string[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const relativePath = path.relative(templatesDir, path.join(entry.parentPath || entry.path, entry.name));
        templates.push(relativePath);
      }
    }

    return templates;
  } catch {
    return [];
  }
}

/**
 * Load an AI command template by name
 */
export async function loadAICommandTemplate(templateName: string): Promise<string> {
  const templatePath = path.join(__dirname, '..', 'templates', 'ai-commands', templateName);
  return fs.readFile(templatePath, 'utf-8');
}

/**
 * Get all hook template names
 */
export async function getHookTemplates(): Promise<string[]> {
  const hooksDir = path.join(__dirname, '..', 'templates', 'hooks');

  try {
    const entries = await fs.readdir(hooksDir);
    return entries.filter(name => name.endsWith('.sh') || name.endsWith('.json'));
  } catch {
    return [];
  }
}

/**
 * Load a hook template by name
 */
export async function loadHookTemplate(hookName: string): Promise<string> {
  const hookPath = path.join(__dirname, '..', 'templates', 'hooks', hookName);
  return fs.readFile(hookPath, 'utf-8');
}
