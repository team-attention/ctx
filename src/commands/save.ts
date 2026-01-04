import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  writeProjectRegistryWithSync,
  readGlobalCtxRegistry,
  writeGlobalCtxRegistry,
  CONTEXTS_DIR,
  getGlobalCtxDir,
} from '../lib/registry.js';
import { ContextEntry, ContextPreview } from '../lib/types.js';
import { computeChecksum } from '../lib/checksum.js';

export interface SaveOptions {
  path?: string;
  content?: string;
  what?: string;
  keywords?: string; // comma-separated keywords
  target?: string; // target file/pattern for frontmatter
  global?: boolean;
  project?: boolean;
  force?: boolean;
}

/**
 * ctx save - Save content to a context file (content required)
 *
 * Examples:
 *   ctx save --path .ctx/contexts/auth.md --content "# Auth" --what "Auth patterns" --keywords "authentication,JWT"
 *   echo "# Test" | ctx save --path test.md --global
 *
 * Note: Use `ctx create` for template-based scaffolding
 */
export async function saveCommand(options: SaveOptions = {}) {
  try {
    // Require --path
    if (!options.path) {
      console.error(chalk.red('✗ Error: --path is required'));
      console.log(chalk.gray('  Usage: ctx save --path <file.md> --content "content"'));
      process.exit(1);
    }

    // Get content from --content or stdin (required)
    let content = options.content || '';

    if (!content) {
      // Try reading from stdin
      const stdin = await readStdin();
      if (stdin) {
        content = stdin;
      }
    }

    if (!content) {
      // No content provided - error with guidance
      console.error(chalk.red('✗ Error: No content provided'));
      console.log(chalk.gray('  Use --content "..." or pipe content via stdin'));
      console.log();
      console.log(chalk.blue('💡 Tip: Use `ctx create` for template-based scaffolding:'));
      console.log(chalk.gray('  ctx create .ctx/contexts/name.md --what "description"'));
      process.exit(1);
    }

    // Check initialization
    const projectRoot = await findProjectRoot();
    const globalInitialized = await isGlobalCtxInitialized();

    // Validate mutually exclusive options
    if (options.global && options.project) {
      console.error(chalk.red('✗ Error: --global and --project are mutually exclusive'));
      process.exit(1);
    }

    // Validate scope requirements
    // --project/--global only validate initialization, don't affect path
    if (options.project && !projectRoot) {
      console.error(chalk.red('✗ Error: Not in a ctx project.'));
      console.log(chalk.gray('  Use --global to save to global context, or run \'ctx init .\' to initialize.'));
      process.exit(1);
    }

    if (options.global && !globalInitialized) {
      console.error(chalk.red('✗ Error: Global ctx not initialized.'));
      console.log(chalk.gray("  Run 'ctx init' first."));
      process.exit(1);
    }

    // Determine absolute path from --path
    // --global/--project flags FORCE the scope, not just validate
    let absolutePath: string;
    const filePath = options.path;

    if (options.global) {
      // --global: Force save to global scope
      if (filePath.startsWith('/') || filePath.startsWith('~')) {
        // Absolute or home-relative path
        absolutePath = filePath.startsWith('~')
          ? filePath.replace('~', process.env.HOME || '')
          : filePath;
      } else {
        // Relative path → relative to ~/.ctx/
        absolutePath = path.join(getGlobalCtxDir(), filePath);
      }
    } else if (options.project) {
      // --project: Force save to project scope
      if (filePath.startsWith('/')) {
        absolutePath = filePath;
      } else {
        absolutePath = path.join(projectRoot!, filePath);
      }
    } else if (filePath.startsWith('~')) {
      // No flag, but path starts with ~ → global
      absolutePath = filePath.replace('~', process.env.HOME || '');
    } else if (filePath.startsWith('/')) {
      // Absolute path
      absolutePath = filePath;
    } else if (projectRoot) {
      // Relative path in project context → relative to project root
      absolutePath = path.join(projectRoot, filePath);
    } else {
      // No project root and no flag → error
      console.error(chalk.red('✗ Error: Not in a ctx project.'));
      console.log(chalk.gray('  Use --global to save to global context, or run \'ctx init .\' to initialize.'));
      process.exit(1);
    }

    // Ensure .md extension
    if (!absolutePath.endsWith('.md')) {
      absolutePath += '.md';
    }

    // Check if file exists
    const exists = await fileExists(absolutePath);
    if (exists && !options.force) {
      console.error(chalk.red(`✗ Error: File already exists: ${absolutePath}`));
      console.log(chalk.gray('  Use --force to overwrite'));
      process.exit(1);
    }

    // Build final content with frontmatter
    let finalContent = content;
    if (options.what || options.keywords || options.target) {
      const frontmatter = buildFrontmatter(options.what, options.keywords, options.target);
      if (!content.startsWith('---')) {
        // Prepend frontmatter to content
        finalContent = frontmatter + '\n' + content;
      }
    }

    // Ensure directory exists
    const dir = path.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(absolutePath, finalContent, 'utf-8');
    console.log(chalk.green(`✓ Saved: ${absolutePath}`));

    // Auto-register if in project or global
    await autoRegister(absolutePath, finalContent, projectRoot, globalInitialized, options);

  } catch (error) {
    console.error(chalk.red('✗ Error saving context:'), error);
    process.exit(1);
  }
}

function buildFrontmatter(what?: string, keywordsStr?: string, target?: string): string {
  const lines = ['---'];

  if (target) {
    lines.push(`target: ${target}`);
  }

  if (what) {
    lines.push(`what: "${what}"`);
  }

  if (keywordsStr) {
    const keywords = keywordsStr.split(',').map(k => k.trim());
    lines.push('keywords:');
    for (const kw of keywords) {
      lines.push(`  - "${kw}"`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data.trim());
    });

    // Timeout to avoid hanging
    setTimeout(() => {
      resolve(data.trim());
    }, 100);
  });
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function autoRegister(
  absolutePath: string,
  content: string,
  projectRoot: string | null,
  globalInitialized: boolean,
  options: SaveOptions
): Promise<void> {
  const checksum = await computeChecksum(absolutePath);
  const now = new Date().toISOString();

  // Build preview from options
  const preview: ContextPreview = {
    what: options.what || '',
    keywords: options.keywords ? options.keywords.split(',').map(k => k.trim()) : [],
  };

  // Check if it's a global context
  if (absolutePath.startsWith(getGlobalCtxDir())) {
    if (!globalInitialized) return;

    const registry = await readGlobalCtxRegistry();
    const relativePath = path.relative(getGlobalCtxDir(), absolutePath);

    const entry: ContextEntry = {
      source: relativePath,
      target: options.target,
      checksum,
      last_modified: now,
      preview,
    };

    registry.contexts[relativePath] = entry;

    await writeGlobalCtxRegistry(registry);
    console.log(chalk.gray(`  Registered in global registry`));
    return;
  }

  // Check if it's a project context
  if (projectRoot && absolutePath.startsWith(projectRoot)) {
    const registry = await readProjectRegistry(projectRoot);
    const relativePath = path.relative(projectRoot, absolutePath);

    const entry: ContextEntry = {
      source: relativePath,
      target: options.target,
      checksum,
      last_modified: now,
      preview,
    };

    registry.contexts[relativePath] = entry;

    await writeProjectRegistryWithSync(projectRoot, registry);
    console.log(chalk.gray(`  Registered in project registry`));
    return;
  }
}
