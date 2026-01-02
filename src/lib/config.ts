import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { Config } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default patterns for context discovery (hardcoded)
 * Used by new 3-level context system
 */
export const DEFAULT_PATTERNS = {
  local: ['**/*.ctx.md', '**/ctx.md'],
  ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**', '.ctx/**'],
};

/**
 * Load default configuration from template file
 */
function loadDefaultConfig(): Config {
  const templatePath = path.join(__dirname, '../templates/ctx.config.yaml');
  const content = readFileSync(templatePath, 'utf-8');
  return YAML.parse(content) as Config;
}

/**
 * Default configuration (loaded from template)
 */
export const DEFAULT_CONFIG: Config = loadDefaultConfig();

/**
 * Load configuration from ctx.config.yaml
 * Merges user config with defaults
 */
export async function loadConfig(projectRoot: string): Promise<Config> {
  const configPath = path.join(projectRoot, 'ctx.config.yaml');

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const userConfig = YAML.parse(content) as Partial<Config>;

    // Merge with defaults
    return {
      version: userConfig.version || DEFAULT_CONFIG.version,
      editor: userConfig.editor || DEFAULT_CONFIG.editor,
      local: {
        patterns: userConfig.local?.patterns || DEFAULT_CONFIG.local.patterns,
        ignore: [
          ...DEFAULT_CONFIG.local.ignore,
          ...(userConfig.local?.ignore || []),
        ],
      },
      global: {
        directory: userConfig.global?.directory || DEFAULT_CONFIG.global.directory,
        patterns: userConfig.global?.patterns || DEFAULT_CONFIG.global.patterns,
        ignore: [
          ...DEFAULT_CONFIG.global.ignore,
          ...(userConfig.global?.ignore || []),
        ],
      },
      frontmatter: {
        local: userConfig.frontmatter?.local || DEFAULT_CONFIG.frontmatter.local,
        global: userConfig.frontmatter?.global || DEFAULT_CONFIG.frontmatter.global,
      },
    };
  } catch (error) {
    // Return default config if file doesn't exist
    return DEFAULT_CONFIG;
  }
}

export interface CreateConfigOptions {
  editor: string;
}

/**
 * Create initial config file
 */
export async function createConfigFile(
  projectRoot: string,
  options: CreateConfigOptions
): Promise<void> {
  const configPath = path.join(projectRoot, 'ctx.config.yaml');

  const config: Config = {
    ...DEFAULT_CONFIG,
    editor: options.editor,
  };

  const yamlContent = YAML.stringify(config);
  await fs.writeFile(configPath, yamlContent, 'utf-8');
}

/**
 * Flatten config object into dot-notation placeholders
 * Example: { global: { directory: 'ctx' } } -> { 'global.directory': 'ctx' }
 */
export function flattenConfig(config: Config): Record<string, string> {
  const placeholders: Record<string, string> = {};

  function flatten(obj: any, prefix: string = '') {
    for (const key in obj) {
      const value = obj[key];
      const path = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value, path);
      } else if (value !== undefined) {
        // Convert value to string for placeholder replacement
        placeholders[path] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    }
  }

  flatten(config);

  return placeholders;
}
