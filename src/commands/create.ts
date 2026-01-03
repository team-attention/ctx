import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import {
  extractDocumentTitle,
  getDirectory,
  ensureDirectory,
} from '../lib/fileUtils.js';
import { checkContextFileExists } from '../lib/validation.js';
import { loadContextTemplate, renderContextTemplate } from '../lib/templates.js';
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
import { computeChecksum } from '../lib/checksum.js';
import { extractPreviewFromGlobal } from '../lib/parser.js';

export interface CreateOptions {
  force?: boolean;
  global?: boolean;
  target?: string; // Optional target path/pattern for frontmatter
}

/**
 * Create a new context file
 *
 * @param contextPath - Full path to the context file (e.g., ".ctx/contexts/arch.md", "src/api.ctx.md")
 * @param options - Creation options
 */
export async function createCommand(contextPath: string, options: CreateOptions = {}) {
  try {
    const isGlobal = options.global || false;

    // Ensure path ends with .md
    if (!contextPath.endsWith('.md')) {
      contextPath = `${contextPath}.md`;
    }

    // Validation: check initialization
    if (isGlobal) {
      const globalInitialized = await isGlobalCtxInitialized();
      if (!globalInitialized) {
        console.error(chalk.red('✗ Error: Global ctx not initialized.'));
        console.log(chalk.gray("  Run 'ctx init' first to initialize global context management."));
        process.exit(1);
      }
    } else {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('✗ Error: Project not initialized.'));
        console.log(chalk.gray("  Run 'ctx init .' first to initialize project context management."));
        process.exit(1);
      }
    }

    // Resolve absolute path
    let absoluteContextPath: string;
    let registryContextPath: string; // Path stored in registry (relative)

    if (isGlobal) {
      // Global: path is relative to ~/.ctx/
      absoluteContextPath = path.join(getGlobalCtxDir(), contextPath);
      registryContextPath = contextPath;
    } else {
      // Project: path is relative to project root
      const projectRoot = (await findProjectRoot())!;
      absoluteContextPath = path.join(projectRoot, contextPath);
      registryContextPath = contextPath;
    }

    // Check if context file already exists
    const exists = await checkContextFileExists(absoluteContextPath);
    if (exists && !options.force) {
      console.log(chalk.yellow(`⚠️  Context file already exists: ${contextPath}`));

      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Do you want to overwrite it?',
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.gray('Operation cancelled.'));
        console.log(chalk.gray('  Use --force to overwrite without confirmation.'));
        return;
      }
    }

    // Load and render template
    const template = await loadContextTemplate();
    const title = extractDocumentTitle(contextPath);
    const rendered = renderContextTemplate(template, {
      target: options.target,
      title,
    });

    // Ensure directory exists
    const contextDir = getDirectory(absoluteContextPath);
    await ensureDirectory(contextDir);

    // Write context file
    await fs.writeFile(absoluteContextPath, rendered, 'utf-8');

    // Auto-register to registry
    try {
      await registerContext(registryContextPath, rendered, {
        isGlobal,
        target: options.target,
      });
      console.log(chalk.green(`✓ Created and registered: ${contextPath}`));
    } catch (error) {
      console.log(chalk.green(`✓ Created: ${contextPath}`));
      console.warn(chalk.yellow(`⚠️  Warning: Failed to register to registry: ${error}`));
    }

    // Show info
    if (isGlobal) {
      console.log(chalk.gray(`  Scope: Global (~/.ctx/)`));
    } else {
      console.log(chalk.gray(`  Scope: Project`));
    }

    if (options.target) {
      console.log(chalk.gray(`  Target: ${options.target}`));
    }

    console.log();
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.gray('  1. Fill in the TODO fields with meaningful information'));
    console.log(chalk.gray('  2. Run: ') + chalk.white('ctx sync') + chalk.gray(' to update checksums'));
    console.log();
  } catch (error) {
    console.error(chalk.red('✗ Error creating context file:'), error);
    process.exit(1);
  }
}

/**
 * Register context to appropriate registry
 */
async function registerContext(
  contextPath: string,
  content: string,
  opts: {
    isGlobal: boolean;
    target?: string;
  }
) {
  const checksum = computeChecksum(content);
  const now = new Date().toISOString();

  // Extract preview from content
  let preview: { what: string; when: string[] };
  try {
    const extracted = extractPreviewFromGlobal(content);
    preview = extracted || { what: 'TODO: Fill in', when: [] };
  } catch {
    preview = { what: 'TODO: Fill in', when: [] };
  }

  const entry: ContextEntry = {
    source: contextPath,
    target: opts.target,
    checksum,
    last_modified: now,
    preview,
  };

  if (opts.isGlobal) {
    const registry = await readGlobalCtxRegistry();
    registry.contexts[contextPath] = entry;
    await writeGlobalCtxRegistry(registry);
  } else {
    const projectRoot = (await findProjectRoot())!;
    const registry = await readProjectRegistry(projectRoot);
    registry.contexts[contextPath] = entry;
    await writeProjectRegistry(projectRoot, registry);

    // Update global index if global is initialized
    const globalInitialized = await isGlobalCtxInitialized();
    if (globalInitialized) {
      await updateGlobalIndex(projectRoot);
    }
  }
}
