import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ContextType = 'local' | 'global';

export interface TemplateData {
  targetPath?: string;
  documentTitle?: string;
  [key: string]: string | undefined;
}

/**
 * Load a template file by context type and template type
 * @param contextType - 'local' or 'global'
 * @param templateType - Template variant (currently only 'default' is supported)
 *
 * Template loading priority:
 * 1. Check project's global directory templates/ (user-customized)
 * 2. Fallback to package's dist/templates/ (default)
 */
export async function loadTemplate(
  contextType: ContextType = 'local',
  templateType: string = 'default'
): Promise<string> {
  const templateFileName = contextType === 'global'
    ? 'global-context.md'
    : 'local-context.md';

  // Load config to get global directory
  const projectRoot = process.cwd();
  const config = await loadConfig(projectRoot);

  // Try project-local template first (e.g., ctx/templates/ or docs/templates/)
  const projectTemplatePath = path.join(projectRoot, config.global.directory, 'templates', templateFileName);

  try {
    const content = await fs.readFile(projectTemplatePath, 'utf-8');
    return content;
  } catch (error) {
    // Fallback to package template (dist/templates/)
    const packageTemplatePath = path.join(__dirname, '..', 'templates', templateFileName);

    try {
      const content = await fs.readFile(packageTemplatePath, 'utf-8');
      return content;
    } catch (fallbackError) {
      throw new Error(`Failed to load ${contextType} template '${templateType}': ${fallbackError}`);
    }
  }
}

/**
 * Render a template by replacing placeholders with actual data
 * Simple placeholder replacement: {{PLACEHOLDER}} -> value
 */
export function renderTemplate(template: string, data: TemplateData): string {
  let rendered = template;

  // Replace {{TARGET_PATH}} with actual target path (for local contexts)
  if (data.targetPath) {
    rendered = rendered.replace(/\{\{TARGET_PATH\}\}/g, data.targetPath);
  }

  // Replace {{DOCUMENT_TITLE}} with document title (for global contexts)
  if (data.documentTitle) {
    rendered = rendered.replace(/\{\{DOCUMENT_TITLE\}\}/g, data.documentTitle);
  }

  // Replace any other placeholders
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'targetPath' && key !== 'documentTitle' && value !== undefined) {
      const placeholder = new RegExp(`\\{\\{${key.toUpperCase()}\\}\\}`, 'g');
      rendered = rendered.replace(placeholder, value);
    }
  }

  return rendered;
}

/**
 * Get the AI commands template directory path
 */
export function getAICommandsTemplateDir(): string {
  return path.join(__dirname, '..', 'templates', 'ai-commands');
}

/**
 * Get list of all AI command templates (recursively scan subdirectories)
 * Returns paths with subdirectory prefix (e.g., 'work/plan.md', 'work/commit.md')
 */
export async function getAICommandTemplates(): Promise<string[]> {
  const templatesDir = getAICommandsTemplateDir();

  async function scanDirectory(dir: string, prefix: string = ''): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subResults = await scanDirectory(fullPath, relativePath);
          results.push(...subResults);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          results.push(relativePath);
        }
      }
    } catch (error) {
      throw new Error(`Failed to scan directory ${dir}: ${error}`);
    }

    return results;
  }

  try {
    return await scanDirectory(templatesDir);
  } catch (error) {
    throw new Error(`Failed to read AI command templates: ${error}`);
  }
}

/**
 * Load a specific AI command template by name
 */
export async function loadAICommandTemplate(commandName: string): Promise<string> {
  const templatePath = path.join(getAICommandsTemplateDir(), commandName);

  try {
    const content = await fs.readFile(templatePath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(`Failed to load AI command template '${commandName}': ${error}`);
  }
}

/**
 * Get the hooks template directory path
 */
export function getHooksTemplateDir(): string {
  return path.join(__dirname, '..', 'templates', 'hooks');
}

/**
 * Get list of all hook templates
 * Returns hook file names (e.g., 'ctx.track-session.sh')
 */
export async function getHookTemplates(): Promise<string[]> {
  const hooksDir = getHooksTemplateDir();

  try {
    const entries = await fs.readdir(hooksDir, { withFileTypes: true });
    const hooks = entries
      .filter(entry => entry.isFile())
      .map(entry => entry.name);

    return hooks;
  } catch (error) {
    // It's ok if hooks directory doesn't exist - just return empty array
    return [];
  }
}

/**
 * Load a specific hook template by name
 */
export async function loadHookTemplate(hookName: string): Promise<string> {
  const templatePath = path.join(getHooksTemplateDir(), hookName);

  try {
    const content = await fs.readFile(templatePath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(`Failed to load hook template '${hookName}': ${error}`);
  }
}
