import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ContextType = 'local' | 'global';

export interface TemplateData {
  targetPath?: string;
  documentTitle?: string;
  [key: string]: string | undefined;
}

/**
 * Load a template file by context type
 * Uses package's dist/templates/ directory
 */
export async function loadTemplate(
  contextType: ContextType = 'local',
  templateType: string = 'default'
): Promise<string> {
  const templateFileName = contextType === 'global'
    ? 'global-context.md'
    : 'local-context.md';

  const packageTemplatePath = path.join(__dirname, '..', 'templates', templateFileName);

  try {
    const content = await fs.readFile(packageTemplatePath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(
      `Template not found: ${templateFileName}. ` +
      `Expected at: ${packageTemplatePath}`
    );
  }
}

/**
 * Render a template by replacing placeholders with values
 * Converts camelCase keys to SNAKE_CASE placeholders
 * e.g., targetPath -> {{TARGET_PATH}}
 */
export function renderTemplate(template: string, data: TemplateData): string {
  let rendered = template;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      // Convert camelCase to SNAKE_CASE
      const snakeCase = key.replace(/([A-Z])/g, '_$1').toUpperCase();
      const placeholder = `{{${snakeCase}}}`;
      rendered = rendered.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
  }

  return rendered;
}

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
        // Get relative path from ai-commands directory
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
