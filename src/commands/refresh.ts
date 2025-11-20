import chalk from 'chalk';
import { isProjectInitialized, updateCtxGitignore } from '../lib/fileUtils.js';
import { ClaudeCodePlatform } from '../lib/platforms/claudeCode.js';
import { loadConfig } from '../lib/config.js';

/**
 * Refresh AI commands by re-installing them with current config
 * Useful when ctx.config.yaml has been modified (e.g., global.directory changed)
 */
export async function refreshCommand() {
  try {
    // Check if project is initialized
    const initialized = await isProjectInitialized();
    if (!initialized) {
      console.error(chalk.red('✗ Error: Project not initialized.'));
      console.log(chalk.gray("  Run 'ctx init' first to initialize context management."));
      process.exit(1);
    }

    const projectRoot = process.cwd();
    const platform = new ClaudeCodePlatform(projectRoot);

    console.log(chalk.blue('Refreshing AI commands...'));

    // Update AI commands with current config
    const updated = await platform.update();

    if (updated === 0) {
      console.log(chalk.green('✓ AI commands are already up to date'));
    } else {
      console.log(chalk.green(`✓ Refreshed ${updated} AI command(s)`));
      console.log(chalk.gray('  AI commands now reflect current ctx.config.yaml settings'));
    }

    // Update .gitignore with current config
    console.log(chalk.blue('Updating .gitignore...'));
    const config = await loadConfig(projectRoot);

    // Collect all ctx-managed entries
    const gitignoreEntries = [
      '.ctx.current',
      config.work?.directory || '.worktrees',
    ];

    const gitignoreUpdated = await updateCtxGitignore(projectRoot, gitignoreEntries);
    if (gitignoreUpdated > 0) {
      console.log(chalk.green(`✓ Updated .gitignore with ${gitignoreUpdated} ctx-managed entries`));
    } else {
      console.log(chalk.green('✓ .gitignore is already up to date'));
    }
  } catch (error) {
    console.error(chalk.red(`✗ Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}
