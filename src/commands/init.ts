import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import YAML from 'yaml';
import { execSync } from 'child_process';
import { getPlatform, isPlatformSupported } from '../lib/platforms/index.js';
import { createConfigFile } from '../lib/config.js';
import { addToGitignore } from '../lib/fileUtils.js';
import { IssueStoreType, IssueStoreConfig } from '../lib/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get GitHub remote URL from git config
 */
function getGitHubRemoteUrl(): string | null {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();

    // Parse GitHub URL (supports both HTTPS and SSH formats)
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    let match = remoteUrl.match(/github\.com[/:]([\w-]+)\/([\w.-]+?)(\.git)?$/);
    if (match) {
      const owner = match[1];
      const repo = match[2];
      return `https://github.com/${owner}/${repo}/issues`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get default URL for issue store type
 */
function getDefaultIssueStoreUrl(type: IssueStoreType): string | undefined {
  switch (type) {
    case 'local':
      return undefined;
    case 'github-issue':
      return getGitHubRemoteUrl() || 'https://github.com/{owner}/{repo}/issues';
    case 'linear':
      return 'https://linear.app/{workspace}';
    default:
      return undefined;
  }
}

export async function initCommand() {
  console.log(chalk.blue.bold('\n🚀 Initializing Context-Driven Development\n'));

  try {
    const projectRoot = process.cwd();
    const configPath = path.join(projectRoot, 'ctx.config.yaml');

    // Check if config exists to determine initialization status
    const configExists = await fileExists(configPath);

    if (configExists) {
      console.log(chalk.yellow('⚠️  Context management is already initialized in this directory.'));

      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Do you want to reinitialize?',
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.gray('Initialization cancelled.'));
        return;
      }
    }

    // Ask which code editor
    const { editor } = await inquirer.prompt([
      {
        type: 'list',
        name: 'editor',
        message: 'Which code editor are you using?',
        choices: [
          { name: 'Claude Code', value: 'claude-code' },
          { name: 'Other (coming soon)', value: 'other', disabled: true },
        ],
        default: 'claude-code',
      },
    ]);

    // Ask which issue store to use
    const { issueStoreType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'issueStoreType',
        message: 'Where do you want to manage issues?',
        choices: [
          { name: 'Local (ctx/issues folder)', value: 'local' },
          { name: 'GitHub Issues', value: 'github-issue' },
          { name: 'Linear', value: 'linear' },
        ],
        default: 'local',
      },
    ]);

    // Build issue store config
    const issueStore: IssueStoreConfig = {
      type: issueStoreType as IssueStoreType,
    };

    // Get URL for non-local issue stores
    if (issueStoreType !== 'local') {
      const defaultUrl = getDefaultIssueStoreUrl(issueStoreType);
      const { issueStoreUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'issueStoreUrl',
          message: `Enter your ${issueStoreType === 'github-issue' ? 'GitHub Issues' : 'Linear workspace'} URL:`,
          default: defaultUrl,
        },
      ]);
      issueStore.url = issueStoreUrl;
    }

    // Write ctx.config.yaml with full config structure
    await createConfigFile(projectRoot, { editor, issueStore });
    console.log(chalk.green('✓ Created ctx.config.yaml'));

    // Load config to get global directory setting
    const { loadConfig, DEFAULT_CONFIG } = await import('../lib/config.js');
    const config = await loadConfig(projectRoot);
    const globalDirPath = path.join(projectRoot, config.global.directory);

    // Create global context directory
    await fs.mkdir(globalDirPath, { recursive: true });
    console.log(chalk.green(`✓ Created ${config.global.directory} directory`));

    // Create issues directory
    const issuesDir = path.join(globalDirPath, 'issues');
    await fs.mkdir(issuesDir, { recursive: true });
    console.log(chalk.green(`✓ Created ${config.global.directory}/issues directory`));

    // Create templates directory and copy all template files
    const templatesDir = path.join(globalDirPath, 'templates');
    const packageTemplatesDir = path.join(__dirname, '..', 'templates');

    try {
      // Copy entire templates directory (excluding ai-commands subdirectory)
      await copyTemplates(packageTemplatesDir, templatesDir);
      console.log(chalk.green(`✓ Copied template files to ${config.global.directory}/templates/`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Warning: Could not copy template files: ${error}`));
    }

    // Create registry files
    const localRegistry = {
      version: '1.0.0',
      last_synced: new Date().toISOString(),
      contexts: {},
    };

    const globalRegistry = {
      version: '1.0.0',
      last_synced: new Date().toISOString(),
      contexts: {},
    };

    await fs.writeFile(
      path.join(globalDirPath, 'local-context-registry.yml'),
      YAML.stringify(localRegistry),
      'utf-8'
    );
    console.log(chalk.green('✓ Created local-context-registry.yml'));

    await fs.writeFile(
      path.join(globalDirPath, 'global-context-registry.yml'),
      YAML.stringify(globalRegistry),
      'utf-8'
    );
    console.log(chalk.green('✓ Created global-context-registry.yml'));

    // Create README in global directory
    const readmeContent = `# Context Directory

This directory contains project-wide context documentation.

## Registries

- \`local-context-registry.yml\` - Index of all local context files (*.ctx.md)
- \`global-context-registry.yml\` - Index of all global context files (${config.global.directory}/**/*.md)

These registries are auto-generated. Do not edit manually.

## Templates

The \`templates/\` directory contains template files for creating contexts:

- \`local-context.md\` - Template for local context files (*.ctx.md)
- \`global-context.md\` - Template for global context documents

**Customization**: You can modify these templates to fit your project's needs. The \`ctx create\` command will use your customized templates automatically.

## Recommended Structure

You can organize your context files however you like. Here are some common patterns:

- \`architecture/\` - Architecture documentation
- \`rules/\` - Development rules and guidelines
- \`stories/\` - Feature stories and specifications

Feel free to create your own structure that fits your project needs.
`;

    await fs.writeFile(path.join(globalDirPath, 'README.md'), readmeContent, 'utf-8');
    console.log(chalk.green(`✓ Created ${config.global.directory}/README.md`));

    // Install AI commands for the selected platform
    if (isPlatformSupported(editor)) {
      const platform = getPlatform(editor);
      await platform.install();

      // Install hooks if platform supports it (Claude Code)
      if (editor === 'claude-code' && 'installHooks' in platform) {
        await (platform as any).installHooks();
      }
    }

    // Add work directory to .gitignore
    const workDir = config.work?.directory || '.worktrees';
    const workDirAdded = await addToGitignore(projectRoot, workDir);
    if (workDirAdded) {
      console.log(chalk.green(`✓ Added ${workDir} to .gitignore`));
    }

    // Add .ctx.current to .gitignore
    const currentAdded = await addToGitignore(projectRoot, '.ctx.current');
    if (currentAdded) {
      console.log(chalk.green(`✓ Added .ctx.current to .gitignore`));
    }

    console.log(chalk.blue.bold('\n✨ Initialization complete!\n'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('  1. Create your first context file: ') + chalk.white('<filename>.ctx.md'));
    console.log(chalk.gray('  2. Run: ') + chalk.white('ctx sync'));
    console.log(chalk.gray('  3. Learn more: ') + chalk.white('ctx --help\n'));

  } catch (error) {
    console.error(chalk.red('Error during initialization:'), error);
    process.exit(1);
  }
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy template files from package to project ctx/templates/
 * Excludes ai-commands subdirectory
 */
async function copyTemplates(sourceDir: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    // Skip ai-commands directory
    if (entry.isDirectory() && entry.name === 'ai-commands') {
      continue;
    }

    if (entry.name === "ctx.config.yaml") {
      continue;
    }


    if (entry.isFile()) {
      await fs.copyFile(sourcePath, destPath);
    }
  }
}
