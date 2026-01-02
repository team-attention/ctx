import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import {
  fileExists,
  isProjectInitialized,
  resolveContextPath,
  resolveGlobalContextPath,
  resolveAbsoluteTargetPath,
  extractDocumentTitle,
  getDirectory,
  ensureDirectory,
} from '../lib/fileUtils.js';
import { validateTarget, checkContextFileExists } from '../lib/validation.js';
import { loadTemplate, renderTemplate, ContextType } from '../lib/templates.js';
import { loadConfig } from '../lib/config.js';
import {
  findProjectRoot,
  isGlobalCtxInitialized,
  readProjectRegistry,
  writeProjectRegistry,
  readGlobalCtxRegistry,
  writeGlobalCtxRegistry,
  updateGlobalIndex,
  CTX_DIR,
  CONTEXTS_DIR,
  GLOBAL_CTX_DIR,
} from '../lib/registry.js';
import { ContextEntry } from '../lib/types.js';
import { computeChecksum } from '../lib/checksum.js';
import { extractPreviewFromGlobal, extractPreviewFromLocal, parseContextFile } from '../lib/parser.js';

export interface CreateOptions {
  template?: string;
  force?: boolean;
  global?: boolean;
  project?: boolean; // New: Create in .ctx/contexts/
}

export async function createCommand(target: string, options: CreateOptions = {}) {
  try {
    // Check for 3-level system first
    const projectRoot = await findProjectRoot();
    const globalInitialized = await isGlobalCtxInitialized();

    // Determine scope
    const isGlobal = options.global || false;
    const isProject = options.project || false;
    const isLocal = !isGlobal && !isProject;

    // Use new 3-level system if available
    if (projectRoot || globalInitialized) {
      await createCommandNew(target, options, projectRoot, globalInitialized);
      return;
    }

    // Fall back to legacy system
    await createCommandLegacy(target, options);
  } catch (error) {
    console.error(chalk.red('✗ Error creating context file:'), error);
    process.exit(1);
  }
}

/**
 * New 3-level create command
 */
async function createCommandNew(
  target: string,
  options: CreateOptions,
  projectRoot: string | null,
  globalInitialized: boolean
) {
  const isGlobal = options.global || false;
  const isProject = options.project || false;
  const isLocal = !isGlobal && !isProject;

  // Validation based on scope
  if (isGlobal && !globalInitialized) {
    console.error(chalk.red('✗ Error: Global ctx not initialized.'));
    console.log(chalk.gray("  Run 'ctx init' first to initialize global context management."));
    process.exit(1);
  }

  if ((isProject || isLocal) && !projectRoot) {
    console.error(chalk.red('✗ Error: Project not initialized.'));
    console.log(chalk.gray("  Run 'ctx init .' first to initialize project context management."));
    process.exit(1);
  }

  let contextPath: string;
  let absoluteContextPath: string;
  let templateData: Record<string, string>;
  let contextType: ContextType;

  if (isGlobal) {
    // Global context: create in ~/.ctx/contexts/
    contextType = 'global';
    const filename = target.endsWith('.md') ? target : `${target}.md`;
    contextPath = path.join(CONTEXTS_DIR, filename);
    absoluteContextPath = path.join(GLOBAL_CTX_DIR, contextPath);
    const documentTitle = extractDocumentTitle(target);
    templateData = { documentTitle };
  } else if (isProject) {
    // Project context: create in .ctx/contexts/
    contextType = 'global'; // Uses global template (no target)
    const filename = target.endsWith('.md') ? target : `${target}.md`;
    contextPath = path.join(CTX_DIR, CONTEXTS_DIR, filename);
    absoluteContextPath = path.join(projectRoot!, contextPath);
    const documentTitle = extractDocumentTitle(target);
    templateData = { documentTitle };
  } else {
    // Local context: create as target.ctx.md
    contextType = 'local';
    contextPath = resolveContextPath(target);
    absoluteContextPath = path.join(projectRoot!, contextPath);
    const absoluteTargetPath = resolveAbsoluteTargetPath(target);
    templateData = { targetPath: absoluteTargetPath };
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
      console.log(chalk.gray(`  Use --force to overwrite without confirmation.`));
      return;
    }
  }

  // Check if target file exists (warning only, local contexts only)
  if (isLocal && projectRoot) {
    const targetFilePath = path.join(projectRoot, target);
    const targetExists = await fileExists(targetFilePath);
    if (!targetExists) {
      console.log(chalk.yellow(`⚠️  Warning: Target file does not exist: ${target}`));
      console.log(chalk.gray('  Context file will be created anyway.'));
    }
  }

  // Load and render template
  const templateType = options.template || 'default';
  const template = await loadTemplate(contextType, templateType);
  const rendered = renderTemplate(template, templateData);

  // Ensure directory exists
  const contextDir = getDirectory(absoluteContextPath);
  await ensureDirectory(contextDir);

  // Write context file
  await fs.writeFile(absoluteContextPath, rendered, 'utf-8');

  // Auto-register to registry
  try {
    await registerContext(contextPath, absoluteContextPath, rendered, {
      isGlobal,
      isProject,
      isLocal,
      projectRoot,
      target: isLocal ? target : undefined,
    });
    console.log(chalk.green(`✓ Created and registered: ${contextPath}`));
  } catch (error) {
    console.log(chalk.green(`✓ Created: ${contextPath}`));
    console.warn(chalk.yellow(`⚠️  Warning: Failed to register to registry: ${error}`));
  }

  // Show scope info
  if (isGlobal) {
    console.log(chalk.gray(`  Scope: Global (~/.ctx/)`));
  } else if (isProject) {
    console.log(chalk.gray(`  Scope: Project (.ctx/contexts/)`));
  } else {
    console.log(chalk.gray(`  Scope: Local (companion file)`));
    console.log(chalk.gray(`  Target: ${target}`));
  }

  console.log();
  console.log(chalk.blue('Next steps:'));
  console.log(chalk.gray('  1. Fill in the TODO fields with meaningful information'));
  console.log(chalk.gray('  2. Run: ') + chalk.white('ctx sync') + chalk.gray(' to update checksums'));
  console.log();
}

/**
 * Register context to appropriate registry
 */
async function registerContext(
  contextPath: string,
  absoluteContextPath: string,
  content: string,
  opts: {
    isGlobal: boolean;
    isProject: boolean;
    isLocal: boolean;
    projectRoot: string | null;
    target?: string;
  }
) {
  const checksum = computeChecksum(content);
  const now = new Date().toISOString();

  // Extract preview from content
  let preview: { what: string; when: string[] };
  try {
    if (opts.isLocal && opts.target) {
      const contextFile = parseContextFile(contextPath, content);
      const extracted = extractPreviewFromLocal(contextFile);
      preview = extracted || { what: 'TODO: Fill in', when: [] };
    } else {
      const extracted = extractPreviewFromGlobal(content);
      preview = extracted || { what: 'TODO: Fill in', when: [] };
    }
  } catch {
    preview = { what: 'TODO: Fill in', when: [] };
  }

  const entry: ContextEntry = {
    scope: opts.isGlobal ? 'global' : opts.isProject ? 'project' : 'local',
    source: contextPath,
    target: opts.isLocal && opts.target ? `/${opts.target.replace(/^\//, '')}` : undefined,
    checksum,
    last_modified: now,
    preview,
  };

  if (opts.isGlobal) {
    // Register to global registry
    const registry = await readGlobalCtxRegistry();
    registry.contexts[contextPath] = entry;
    await writeGlobalCtxRegistry(registry);
  } else if (opts.projectRoot) {
    // Register to project registry
    const registry = await readProjectRegistry(opts.projectRoot);
    registry.contexts[contextPath] = entry;
    await writeProjectRegistry(opts.projectRoot, registry);

    // Update global index
    const globalInitialized = await isGlobalCtxInitialized();
    if (globalInitialized) {
      await updateGlobalIndex(opts.projectRoot);
    }
  }
}

/**
 * Legacy create command (backward compatibility)
 */
async function createCommandLegacy(target: string, options: CreateOptions) {
  // 1. Validate target
  const validation = validateTarget(target);
  if (!validation.valid) {
    console.error(chalk.red(`✗ ${validation.error}`));
    process.exit(1);
  }

  // 2. Check if project is initialized
  const initialized = await isProjectInitialized();
  if (!initialized) {
    console.error(chalk.red('✗ Error: Project not initialized.'));
    console.log(chalk.gray("  Run 'ctx init' first to initialize context management."));
    process.exit(1);
  }

  // 3. Load config
  const projectRoot = process.cwd();
  const config = await loadConfig(projectRoot);

  // 4. Determine context type and resolve paths
  const isGlobal = options.global || false;
  const contextType: ContextType = isGlobal ? 'global' : 'local';

  let contextPath: string;
  let absoluteContextPath: string;
  let templateData: Record<string, string>;

  if (isGlobal) {
    // Global context: resolve to configured global directory
    contextPath = resolveGlobalContextPath(target, config.global.directory);
    absoluteContextPath = path.resolve(projectRoot, contextPath);

    // Extract document title from path
    const documentTitle = extractDocumentTitle(contextPath);
    templateData = { documentTitle };
  } else {
    // Local context: resolve based on target file
    contextPath = resolveContextPath(target);
    absoluteContextPath = path.resolve(projectRoot, contextPath);

    const absoluteTargetPath = resolveAbsoluteTargetPath(target);
    templateData = { targetPath: absoluteTargetPath };
  }

  // 5. Check if context file already exists
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
      console.log(chalk.gray(`  Use --force to overwrite without confirmation.`));
      return;
    }
  }

  // 6. Check if target file exists (warning only, local contexts only)
  if (!isGlobal) {
    const targetFilePath = path.resolve(process.cwd(), target);
    const targetExists = await fileExists(targetFilePath);
    if (!targetExists) {
      console.log(chalk.yellow(`⚠️  Warning: Target file does not exist: ${target}`));
      console.log(chalk.gray('  Context file will be created anyway.'));
    }
  }

  // 7. Load template
  const templateType = options.template || 'default';
  const template = await loadTemplate(contextType, templateType);

  // 8. Render template with data
  const rendered = renderTemplate(template, templateData);

  // 9. Ensure directory exists
  const contextDir = getDirectory(absoluteContextPath);
  await ensureDirectory(contextDir);

  // 10. Write context file
  await fs.writeFile(absoluteContextPath, rendered, 'utf-8');

  // 11. Display success message
  console.log(chalk.green(`✓ Created ${contextPath}`));
  if (!isGlobal && templateData.targetPath) {
    console.log(chalk.gray(`→ Target: ${templateData.targetPath}`));
  }
  console.log();
  console.log(chalk.blue('Next steps:'));
  console.log(chalk.gray('  1. Fill in the TODO fields with meaningful information'));

  if (isGlobal) {
    console.log(chalk.gray('  2. Run: ') + chalk.white('ctx sync --global'));
  } else {
    console.log(chalk.gray('  2. Run: ') + chalk.white('ctx sync --local'));
  }
  console.log();
}
