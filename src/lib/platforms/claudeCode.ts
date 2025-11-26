import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { Platform } from './types.js';
import { getAICommandTemplates, loadAICommandTemplate, getHookTemplates, loadHookTemplate } from '../templates.js';
import { loadConfig, flattenConfig } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Claude Code platform implementation
 * Manages AI commands in .claude/commands/ directory
 */
export class ClaudeCodePlatform implements Platform {
  readonly name = 'Claude Code';
  readonly id = 'claude-code';
  private readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  getCommandsDir(): string {
    return path.join(this.projectRoot, '.claude', 'commands');
  }

  getHooksDir(): string {
    return path.join(this.projectRoot, '.claude', 'hooks');
  }

  getSettingsPath(): string {
    return path.join(this.projectRoot, '.claude', 'settings.local.json');
  }

  async isInstalled(): Promise<boolean> {
    try {
      const commandsDir = this.getCommandsDir();
      await fs.access(commandsDir);
      return true;
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    const commandsDir = this.getCommandsDir();

    // Create .claude/commands directory
    await fs.mkdir(commandsDir, { recursive: true });

    // Load config and flatten to placeholders
    const config = await loadConfig(this.projectRoot);
    const placeholders = flattenConfig(config);

    // Get all AI command templates
    const templates = await getAICommandTemplates();

    if (templates.length === 0) {
      console.log(chalk.yellow('⚠️  No AI command templates found'));
      return;
    }

    // Copy each template with ctx. prefix and substitute placeholders
    for (const templateName of templates) {
      let content = await loadAICommandTemplate(templateName);

      // Resolve snippets first (before config placeholders)
      content = await this.resolveSnippets(content);

      // Substitute all config placeholders
      for (const [key, value] of Object.entries(placeholders)) {
        const placeholder = `{{${key}}}`;
        content = content.replaceAll(placeholder, value);
      }

      // Convert path separators to dots for command name
      // e.g., 'work/plan.md' -> 'ctx.work.plan.md'
      const commandName = templateName.replace(/\//g, '.');
      const targetPath = path.join(commandsDir, `ctx.${commandName}`);
      await fs.writeFile(targetPath, content, 'utf-8');
    }

    console.log(chalk.green(`✓ Installed ${templates.length} AI commands to .claude/commands/`));
  }

  async update(): Promise<number> {
    const commandsDir = this.getCommandsDir();

    // Check if commands directory exists
    const installed = await this.isInstalled();
    if (!installed) {
      throw new Error('AI commands not installed. Run `ctx init` first.');
    }

    // Load config and flatten to placeholders
    const config = await loadConfig(this.projectRoot);
    const placeholders = flattenConfig(config);

    const templates = await getAICommandTemplates();
    let updated = 0;

    for (const templateName of templates) {
      // Convert path separators to dots for command name
      // e.g., 'work/plan.md' -> 'ctx.work.plan.md'
      const commandName = templateName.replace(/\//g, '.');
      const targetPath = path.join(commandsDir, `ctx.${commandName}`);
      let templateContent = await loadAICommandTemplate(templateName);

      // Resolve snippets first (before config placeholders)
      templateContent = await this.resolveSnippets(templateContent);

      // Substitute all config placeholders
      for (const [key, value] of Object.entries(placeholders)) {
        const placeholder = `{{${key}}}`;
        templateContent = templateContent.replaceAll(placeholder, value);
      }

      // Check if file exists and content is different
      try {
        const existingContent = await fs.readFile(targetPath, 'utf-8');
        if (existingContent !== templateContent) {
          await fs.writeFile(targetPath, templateContent, 'utf-8');
          updated++;
        }
      } catch {
        // File doesn't exist, create it
        await fs.writeFile(targetPath, templateContent, 'utf-8');
        updated++;
      }
    }

    return updated;
  }

  /**
   * Update or create settings.local.json with hook configuration
   */
  private async updateSettingsLocal(hookConfig: any): Promise<void> {
    const settingsPath = this.getSettingsPath();
    let settings: any = {};

    // Read existing settings if file exists
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      settings = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid, start fresh
      settings = {};
    }

    // Initialize hooks structure if not exists
    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Merge hook configuration
    Object.assign(settings.hooks, hookConfig);

    // Write back to file
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  }

  /**
   * Install hooks from templates to .claude/hooks/ and configure settings.local.json
   */
  async installHooks(): Promise<void> {
    const hooksDir = this.getHooksDir();

    // Create .claude/hooks directory
    await fs.mkdir(hooksDir, { recursive: true });

    // Get all hook templates
    const templates = await getHookTemplates();

    if (templates.length === 0) {
      console.log(chalk.yellow('⚠️  No hook templates found'));
      return;
    }

    // Copy each hook template
    for (const hookName of templates) {
      const content = await loadHookTemplate(hookName);
      const targetPath = path.join(hooksDir, hookName);
      await fs.writeFile(targetPath, content, 'utf-8');

      // Make executable on Unix systems
      if (hookName.endsWith('.sh')) {
        try {
          await fs.chmod(targetPath, 0o755);
        } catch {
          // chmod might fail on Windows, that's ok
        }
      }
    }

    // Configure settings.local.json with UserPromptSubmit hook
    // Only configure track-session hook if it exists
    if (templates.includes('ctx.track-session.sh')) {
      await this.updateSettingsLocal({
        UserPromptSubmit: [
          {
            matcher: '',
            hooks: [
              {
                type: 'command',
                command: '.claude/hooks/ctx.track-session.sh'
              }
            ]
          }
        ]
      });
    }

    console.log(chalk.green(`✓ Installed ${templates.length} hook(s) to .claude/hooks/ and configured settings.local.json`));
  }

  /**
   * Resolve snippet references in template content
   * Replaces {{snippet:name}} with actual snippet content
   */
  private async resolveSnippets(template: string): Promise<string> {
    const snippetRegex = /\{\{snippet:([^}]+)\}\}/g;
    let resolved = template;
    // __dirname is in dist/lib/platforms/, need to go up two levels to get to dist/
    const snippetsDir = path.join(__dirname, '..', '..', 'templates', 'snippets');

    const matches = template.matchAll(snippetRegex);

    for (const match of matches) {
      const snippetName = match[1];
      const snippetPath = path.join(snippetsDir, `${snippetName}.md`);

      try {
        const snippetContent = await fs.readFile(snippetPath, 'utf-8');
        resolved = resolved.replace(match[0], snippetContent);
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Warning: Snippet not found: ${snippetName}.md`));
        // Keep the placeholder if snippet file doesn't exist
      }
    }

    return resolved;
  }
}
