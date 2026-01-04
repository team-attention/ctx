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
  writeProjectRegistryWithSync,
  readGlobalCtxRegistry,
  writeGlobalCtxRegistry,
  getGlobalCtxDir,
} from '../lib/registry.js';
import { ContextEntry, ContextPathConfig } from '../lib/types.js';
import { computeChecksum } from '../lib/checksum.js';
import { extractPreviewFromGlobal } from '../lib/parser.js';
import {
  matchesContextPaths,
  getProjectContextPaths,
  getGlobalContextPaths,
  suggestMatchingPaths,
} from '../lib/context-path-matcher.js';
import { syncCommand } from './sync.js';

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
    let projectRoot: string | null = null;
    if (isGlobal) {
      const globalInitialized = await isGlobalCtxInitialized();
      if (!globalInitialized) {
        console.error(chalk.red('✗ Error: Global ctx not initialized.'));
        console.log(chalk.gray("  Run 'ctx init' first to initialize global context management."));
        process.exit(1);
      }
    } else {
      projectRoot = await findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('✗ Error: Project not initialized.'));
        console.log(chalk.gray("  Run 'ctx init .' first to initialize project context management."));
        process.exit(1);
      }
    }

    // Check if path matches context_paths patterns
    let registry = isGlobal
      ? await readGlobalCtxRegistry()
      : await readProjectRegistry(projectRoot!);

    const contextPaths = isGlobal
      ? await getGlobalContextPaths()
      : await getProjectContextPaths(projectRoot!);

    const matches = matchesContextPaths(contextPath, contextPaths);
    let patternAdded = false;

    if (!matches) {
      // Auto-add to context_paths
      if (!registry.settings) {
        registry.settings = { context_paths: [] };
      }
      if (!registry.settings.context_paths) {
        registry.settings.context_paths = [];
      }

      const newPattern: ContextPathConfig = {
        path: contextPath,
        purpose: 'Added via ctx create'
      };
      registry.settings.context_paths.push(newPattern);
      patternAdded = true;

      // Save registry with new pattern
      if (isGlobal) {
        await writeGlobalCtxRegistry(registry);
      } else {
        await writeProjectRegistry(projectRoot!, registry);
      }

      console.log(chalk.blue(`ℹ️  Added '${contextPath}' to context_paths`));
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
      absoluteContextPath = path.join(projectRoot!, contextPath);
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

    // Auto-sync if pattern was added
    if (patternAdded) {
      console.log();
      console.log(chalk.blue('Running sync to apply new pattern...'));
      await syncCommand({ global: isGlobal });
    }

    console.log();
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.gray('  1. Fill in the TODO fields with meaningful information'));
    if (!patternAdded) {
      console.log(chalk.gray('  2. Run: ') + chalk.white('ctx sync') + chalk.gray(' to update checksums'));
    }
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
  let preview: { what: string; keywords: string[] };
  try {
    const extracted = extractPreviewFromGlobal(content);
    preview = extracted || { what: 'TODO: Fill in', keywords: [] };
  } catch {
    preview = { what: 'TODO: Fill in', keywords: [] };
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
    await writeProjectRegistryWithSync(projectRoot, registry);
  }
}
