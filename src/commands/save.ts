import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  writeProjectRegistry,
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
  when?: string; // comma-separated keywords
  global?: boolean;
  project?: boolean;
  force?: boolean;
}

/**
 * ctx save - Save content to a context file
 *
 * Examples:
 *   ctx save --path .ctx/contexts/auth.md --content "# Auth" --what "Auth patterns" --when "authentication,JWT"
 *   echo "# Test" | ctx save --path test.md --global
 */
export async function saveCommand(options: SaveOptions = {}) {
  try {
    // Require --path
    if (!options.path) {
      console.error(chalk.red('✗ Error: --path is required'));
      console.log(chalk.gray('  Usage: ctx save --path <file.md> --content "content"'));
      process.exit(1);
    }

    // Get content from --content or stdin
    let content = options.content || '';

    if (!content) {
      // Try reading from stdin
      const stdin = await readStdin();
      if (stdin) {
        content = stdin;
      }
    }

    if (!content) {
      console.error(chalk.red('✗ Error: No content provided'));
      console.log(chalk.gray('  Use --content "..." or pipe content via stdin'));
      process.exit(1);
    }

    // Check initialization
    const projectRoot = await findProjectRoot();
    const globalInitialized = await isGlobalCtxInitialized();

    // Determine absolute path
    let absolutePath: string;
    const filePath = options.path;

    if (filePath.startsWith('~')) {
      // Global path like ~/.ctx/contexts/xxx.md
      absolutePath = filePath.replace('~', process.env.HOME || '');
    } else if (filePath.startsWith('/')) {
      // Absolute path
      absolutePath = filePath;
    } else if (options.global && !filePath.includes('/')) {
      // Just filename with --global flag → save to ~/.ctx/contexts/
      if (!globalInitialized) {
        console.error(chalk.red('✗ Error: Global ctx not initialized.'));
        console.log(chalk.gray("  Run 'ctx init' first."));
        process.exit(1);
      }
      absolutePath = path.join(getGlobalCtxDir(), CONTEXTS_DIR, filePath);
    } else if (projectRoot) {
      // Relative path in project context
      absolutePath = path.join(projectRoot, filePath);
    } else {
      // Relative to cwd (no project root found)
      absolutePath = path.resolve(filePath);
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

    // Build content with frontmatter if what/when provided
    let finalContent = content;
    if (options.what || options.when) {
      const frontmatter = buildFrontmatter(options.what, options.when);
      if (!content.startsWith('---')) {
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

function buildFrontmatter(what?: string, when?: string): string {
  const lines = ['---'];

  if (what) {
    lines.push(`what: "${what}"`);
  }

  if (when) {
    const keywords = when.split(',').map(k => k.trim());
    lines.push('when:');
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
    when: options.when ? options.when.split(',').map(k => k.trim()) : [],
  };

  // Check if it's a global context
  if (absolutePath.startsWith(getGlobalCtxDir())) {
    if (!globalInitialized) return;

    const registry = await readGlobalCtxRegistry();
    const relativePath = path.relative(getGlobalCtxDir(), absolutePath);

    const entry: ContextEntry = {
      source: relativePath,
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
      checksum,
      last_modified: now,
      preview,
    };

    registry.contexts[relativePath] = entry;

    await writeProjectRegistry(projectRoot, registry);
    console.log(chalk.gray(`  Registered in project registry`));
    return;
  }
}
