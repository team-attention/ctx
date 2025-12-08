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
    return path.join(this.projectRoot, '.claude', 'settings.json');
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

    // Add permission for npx ctx commands
    await this.updatePermissions('Bash(npx ctx:*)');

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
   * Update or create settings.json with hook configuration
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
   * Update permissions.allow in settings.json
   * Adds permission if not already present
   */
  private async updatePermissions(permission: string): Promise<void> {
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

    // Initialize permissions.allow array if not exists
    if (!settings.permissions) {
      settings.permissions = {};
    }
    if (!settings.permissions.allow) {
      settings.permissions.allow = [];
    }

    // Add permission if not already present
    if (!settings.permissions.allow.includes(permission)) {
      settings.permissions.allow.push(permission);
    }

    // Write back to file
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  }

  /**
   * Install hooks from templates to .claude/hooks/ and configure settings.json
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

    // Configure settings.json with hooks
    const hookConfig: Record<string, any> = {};

    // UserPromptSubmit: track session transcripts
    if (templates.includes('ctx.track-session.sh')) {
      hookConfig.UserPromptSubmit = [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: '.claude/hooks/ctx.track-session.sh'
            }
          ]
        }
      ];
    }

    // SessionStart: show current issue on startup/resume
    if (templates.includes('ctx.show-current-issue.sh')) {
      hookConfig.SessionStart = [
        {
          matcher: 'startup|resume',
          hooks: [
            {
              type: 'command',
              command: '.claude/hooks/ctx.show-current-issue.sh'
            }
          ]
        }
      ];
    }

    if (Object.keys(hookConfig).length > 0) {
      await this.updateSettingsLocal(hookConfig);
    }

    console.log(chalk.green(`✓ Installed ${templates.length} hook(s) to .claude/hooks/ and configured settings.json`));
  }

  /**
   * Resolve snippet references in template content
   * Supports two syntaxes:
   * - {{snippet:name}} - includes entire snippet file
   * - {{snippet:name#section}} - includes only the specified section (## section header)
   */
  private async resolveSnippets(template: string): Promise<string> {
    const snippetRegex = /\{\{snippet:([^#}]+)(?:#([^}]+))?\}\}/g;
    let resolved = template;
    // __dirname is in dist/lib/platforms/, need to go up two levels to get to dist/
    const snippetsDir = path.join(__dirname, '..', '..', 'templates', 'snippets');

    const matches = template.matchAll(snippetRegex);

    for (const match of matches) {
      const snippetName = match[1];
      const sectionName = match[2]; // optional section (e.g., "target-not-found")
      const snippetPath = path.join(snippetsDir, `${snippetName}.md`);

      try {
        let snippetContent = await fs.readFile(snippetPath, 'utf-8');

        // If section specified, extract only that section
        if (sectionName) {
          snippetContent = this.extractSection(snippetContent, sectionName);
        }

        resolved = resolved.replace(match[0], snippetContent);
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Warning: Snippet not found: ${snippetName}.md`));
        // Keep the placeholder if snippet file doesn't exist
      }
    }

    return resolved;
  }

  /**
   * Extract a specific section from snippet content
   * Looks for ## sectionName header and returns content until next ## header
   */
  private extractSection(content: string, sectionName: string): string {
    const lines = content.split('\n');
    const sectionHeader = `## ${sectionName}`;
    let inSection = false;
    const sectionLines: string[] = [];

    for (const line of lines) {
      if (line.trim() === sectionHeader) {
        inSection = true;
        continue; // Skip the header itself
      }

      if (inSection) {
        // Stop at next ## header
        if (line.startsWith('## ')) {
          break;
        }
        sectionLines.push(line);
      }
    }

    if (sectionLines.length === 0) {
      console.log(chalk.yellow(`⚠️  Warning: Section not found: ${sectionName}`));
      return `[Section "${sectionName}" not found]`;
    }

    // Trim leading/trailing empty lines
    while (sectionLines.length > 0 && sectionLines[0].trim() === '') {
      sectionLines.shift();
    }
    while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1].trim() === '') {
      sectionLines.pop();
    }

    return sectionLines.join('\n');
  }
}
