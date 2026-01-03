import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';
import { computeChecksum } from '../lib/checksum.js';
import { extractPreviewFromGlobal } from '../lib/parser.js';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  writeProjectRegistry,
  readGlobalCtxRegistry,
  writeGlobalCtxRegistry,
  updateGlobalIndex,
  getGlobalCtxDir,
} from '../lib/registry.js';
import { ContextEntry } from '../lib/types.js';

interface AdoptOptions {
  global?: boolean;
}

/**
 * Generate what/when from filename
 * e.g., "docs/api-guide.md" → what: "api guide", when: ["api", "guide", "docs"]
 */
function generateFromFilename(filePath: string): { what: string; when: string[] } {
  const basename = path.basename(filePath, path.extname(filePath));
  const dirname = path.dirname(filePath);

  // Convert kebab-case/snake_case to words
  const words = basename
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 0);

  // Add directory names as keywords (excluding common ones)
  const dirWords = dirname
    .split(path.sep)
    .filter(d => d && d !== '.' && d !== '..' && d !== 'src' && d !== 'lib')
    .map(d => d.toLowerCase());

  const when = [...new Set([...words, ...dirWords])];
  const what = words.join(' ');

  return { what, when };
}

/**
 * Check if file already has frontmatter
 */
function hasFrontmatter(content: string): boolean {
  return content.trimStart().startsWith('---');
}

/**
 * Add frontmatter to content
 */
function addFrontmatter(content: string, what: string, when: string[]): string {
  const whenYaml = when.map(k => `  - ${k}`).join('\n');
  const frontmatter = `---
what: "${what}"
when:
${whenYaml}
---

`;
  return frontmatter + content;
}

/**
 * Adopt existing documents into ctx system by adding frontmatter
 */
export async function adoptCommand(patterns: string[], options: AdoptOptions = {}) {
  try {
    if (options.global) {
      return adoptToGlobal(patterns);
    }
    return adoptToProject(patterns);
  } catch (error) {
    console.error(chalk.red('✗ Error:'), error);
    process.exit(1);
  }
}

/**
 * Adopt documents to project registry
 */
async function adoptToProject(patterns: string[]) {
  const projectRoot = await findProjectRoot();

  if (!projectRoot) {
    console.error(chalk.red('✗ Not in a ctx project.'));
    console.log(chalk.gray('  Run: ') + chalk.white('ctx init .') + chalk.gray(' to initialize.'));
    process.exit(1);
  }

  console.log(chalk.blue('Adopting documents to project...\n'));

  const registry = await readProjectRegistry(projectRoot);
  let adopted = 0;
  let skipped = 0;

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      absolute: false,
      ignore: ['node_modules/**', '.git/**', '.ctx/**'],
    });

    for (const file of files) {
      // Skip non-markdown files
      if (!file.endsWith('.md')) {
        console.log(chalk.gray(`  skip: ${file} (not markdown)`));
        skipped++;
        continue;
      }

      // Skip .ctx.md files (already context files)
      if (file.endsWith('.ctx.md')) {
        console.log(chalk.gray(`  skip: ${file} (already a context file)`));
        skipped++;
        continue;
      }

      const absolutePath = path.join(projectRoot, file);

      // Read file
      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch {
        console.log(chalk.yellow(`  skip: ${file} (file not found)`));
        skipped++;
        continue;
      }

      // Check if already has frontmatter
      if (hasFrontmatter(content)) {
        console.log(chalk.gray(`  skip: ${file} (already has frontmatter)`));
        skipped++;
        continue;
      }

      // Generate what/when from filename
      const { what, when } = generateFromFilename(file);

      // Add frontmatter
      const newContent = addFrontmatter(content, what, when);

      // Write back
      await fs.writeFile(absolutePath, newContent, 'utf-8');

      // Register in registry
      const stats = await fs.stat(absolutePath);
      const preview = extractPreviewFromGlobal(newContent);

      const entry: ContextEntry = {
        source: file,
        checksum: computeChecksum(newContent),
        last_modified: stats.mtime.toISOString(),
        preview: preview!,
      };

      registry.contexts[file] = entry;
      console.log(chalk.green(`  adopt: ${file}`));
      console.log(chalk.gray(`         what: "${what}"`));
      console.log(chalk.gray(`         when: [${when.join(', ')}]`));
      adopted++;
    }
  }

  await writeProjectRegistry(projectRoot, registry);

  // Update global index
  const globalInitialized = await isGlobalCtxInitialized();
  if (globalInitialized) {
    await updateGlobalIndex(projectRoot);
  }

  console.log();
  console.log(chalk.blue.bold('Done!'));
  console.log(chalk.gray(`  Adopted: ${adopted}`));
  console.log(chalk.gray(`  Skipped: ${skipped}`));
}

/**
 * Adopt documents to global registry
 */
async function adoptToGlobal(patterns: string[]) {
  const globalInitialized = await isGlobalCtxInitialized();

  if (!globalInitialized) {
    console.error(chalk.red('✗ Global context not initialized.'));
    console.log(chalk.gray('  Run: ') + chalk.white('ctx init') + chalk.gray(' first.'));
    process.exit(1);
  }

  console.log(chalk.blue('Adopting documents to global...\n'));

  const registry = await readGlobalCtxRegistry();
  let adopted = 0;
  let skipped = 0;

  for (const pattern of patterns) {
    const baseDir = pattern.startsWith('/') ? '/' : getGlobalCtxDir();
    const resolvedPattern = pattern.startsWith('/') ? pattern : path.join(getGlobalCtxDir(), pattern);

    const files = await glob(resolvedPattern, {
      absolute: true,
    });

    for (const absolutePath of files) {
      // Skip non-markdown
      if (!absolutePath.endsWith('.md')) {
        console.log(chalk.gray(`  skip: ${path.basename(absolutePath)} (not markdown)`));
        skipped++;
        continue;
      }

      const relativePath = absolutePath.startsWith(getGlobalCtxDir())
        ? path.relative(getGlobalCtxDir(), absolutePath)
        : absolutePath;

      // Read file
      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch {
        console.log(chalk.yellow(`  skip: ${relativePath} (file not found)`));
        skipped++;
        continue;
      }

      // Check if already has frontmatter
      if (hasFrontmatter(content)) {
        console.log(chalk.gray(`  skip: ${relativePath} (already has frontmatter)`));
        skipped++;
        continue;
      }

      // Generate what/when
      const { what, when } = generateFromFilename(relativePath);

      // Add frontmatter
      const newContent = addFrontmatter(content, what, when);

      // Write back
      await fs.writeFile(absolutePath, newContent, 'utf-8');

      // Register
      const stats = await fs.stat(absolutePath);
      const preview = extractPreviewFromGlobal(newContent);

      const entry: ContextEntry = {
        source: relativePath,
        checksum: computeChecksum(newContent),
        last_modified: stats.mtime.toISOString(),
        preview: preview!,
      };

      registry.contexts[relativePath] = entry;
      console.log(chalk.green(`  adopt: ${relativePath}`));
      console.log(chalk.gray(`         what: "${what}"`));
      console.log(chalk.gray(`         when: [${when.join(', ')}]`));
      adopted++;
    }
  }

  await writeGlobalCtxRegistry(registry);

  console.log();
  console.log(chalk.blue.bold('Done!'));
  console.log(chalk.gray(`  Adopted: ${adopted}`));
  console.log(chalk.gray(`  Skipped: ${skipped}`));
}
