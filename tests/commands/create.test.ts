import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestEnvironment, suppressConsole } from '../helpers/testUtils.js';
import YAML from 'yaml';

// Create mock function with proper typing
const mockPrompt = jest.fn<any>();

// Mock inquirer before importing createCommand
jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: mockPrompt,
  },
}));

// Import after mocking
await import('inquirer');
const { createCommand } = await import('../../src/commands/create.js');

describe('create command', () => {
  let testEnv: TestEnvironment;
  let consoleOutput: ReturnType<typeof suppressConsole>;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    await testEnv.initProject(); // Always init project for create tests
    consoleOutput = suppressConsole();

    // Mock process.exit to prevent test worker from dying
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
      throw new Error(`process.exit(${code})`);
    }) as any;

    // Reset mocks
    mockPrompt.mockClear();
    mockPrompt.mockResolvedValue({ overwrite: true });
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    consoleOutput.restore();
    await testEnv.cleanup();
  });

  describe('project context creation', () => {
    it('should create context file with full path', async () => {
      await createCommand('.ctx/contexts/api.md', { force: true });

      expect(await testEnv.fileExists('.ctx/contexts/api.md')).toBe(true);
    });

    it('should create context file with correct template structure', async () => {
      await createCommand('.ctx/contexts/helpers.md', { force: true });

      const contextContent = await testEnv.readFile('.ctx/contexts/helpers.md');

      // Check for frontmatter markers
      expect(contextContent).toContain('---');
      expect(contextContent).toContain('what:');
      expect(contextContent).toContain('keywords:');
    });

    it('should add .md extension if not present', async () => {
      await createCommand('.ctx/contexts/architecture', { force: true });

      expect(await testEnv.fileExists('.ctx/contexts/architecture.md')).toBe(true);
    });

    it('should include target in frontmatter when --target is provided', async () => {
      await createCommand('src/api.ctx.md', { force: true, target: 'src/api.ts' });

      const contextContent = await testEnv.readFile('src/api.ctx.md');

      expect(contextContent).toContain('target: src/api.ts');
    });

    it('should have empty target when --target is not provided', async () => {
      await createCommand('.ctx/contexts/general.md', { force: true });

      const contextContent = await testEnv.readFile('.ctx/contexts/general.md');

      // Should have empty target line (can be filled later)
      expect(contextContent).toContain('target:');
      expect(contextContent).not.toContain('target: src/');
    });

    it('should create nested directories if they do not exist', async () => {
      await createCommand('.ctx/docs/guides/getting-started.md', { force: true });

      expect(await testEnv.fileExists('.ctx/docs/guides/getting-started.md')).toBe(true);
    });

    it('should render title from filename', async () => {
      await createCommand('.ctx/contexts/api-patterns.md', { force: true });

      const contextContent = await testEnv.readFile('.ctx/contexts/api-patterns.md');

      // Title should be derived from filename
      expect(contextContent).toContain('# Api Patterns');
    });
  });

  describe('global context creation', () => {
    beforeEach(async () => {
      // Initialize global context for these tests
      await testEnv.initGlobal();
    });

    it('should create global context in ~/.ctx/ directory', async () => {
      await createCommand('contexts/caching.md', { global: true, force: true });

      expect(await testEnv.fileExists('home/.ctx/contexts/caching.md')).toBe(true);
    });

    it('should add .md extension if not present', async () => {
      await createCommand('contexts/database', { global: true, force: true });

      expect(await testEnv.fileExists('home/.ctx/contexts/database.md')).toBe(true);
    });

    it('should render template with document title', async () => {
      await createCommand('contexts/api-versioning.md', { global: true, force: true });

      const content = await testEnv.readFile('home/.ctx/contexts/api-versioning.md');

      // Check for frontmatter structure
      expect(content).toContain('---');
      expect(content).toContain('keywords:');
      expect(content).toContain('what:');

      // Document title should be rendered (converted from kebab-case)
      expect(content).toContain('# Api Versioning');
    });

    it('should create nested directories for global contexts', async () => {
      await createCommand('rules/typescript/strict-mode.md', { global: true, force: true });

      expect(await testEnv.fileExists('home/.ctx/rules/typescript/strict-mode.md')).toBe(true);
    });

    it('should include target when --target is provided', async () => {
      await createCommand('contexts/ts-patterns.md', { global: true, force: true, target: '**/*.ts' });

      const content = await testEnv.readFile('home/.ctx/contexts/ts-patterns.md');
      expect(content).toContain('target: **/*.ts');
    });
  });

  describe('file overwrite handling', () => {
    beforeEach(async () => {
      // Create existing context file
      await testEnv.createFile(
        'src/existing.ctx.md',
        '---\ntarget: src/existing.ts\nwhat: old content\nkeywords:\n  - test\n---\n\n# Old Content'
      );
    });

    it('should prompt for confirmation when file exists without --force', async () => {
      // Mock user declining overwrite
      mockPrompt.mockResolvedValueOnce({ overwrite: false });

      await createCommand('src/existing.ctx.md', {}); // No force flag

      // Should have prompted
      expect(mockPrompt).toHaveBeenCalled();

      // Original content should remain
      const content = await testEnv.readFile('src/existing.ctx.md');
      expect(content).toContain('old content');
    });

    it('should overwrite with --force flag without prompting', async () => {
      await createCommand('src/existing.ctx.md', { force: true });

      // Should not have prompted
      expect(mockPrompt).not.toHaveBeenCalled();

      // File should be overwritten (no longer contains old content)
      const content = await testEnv.readFile('src/existing.ctx.md');
      expect(content).not.toContain('old content');
      expect(content).toContain('TODO');
    });

    it('should overwrite if user confirms prompt', async () => {
      // Mock user confirming overwrite
      mockPrompt.mockResolvedValueOnce({ overwrite: true });

      await createCommand('src/existing.ctx.md', {});

      // Should have prompted
      expect(mockPrompt).toHaveBeenCalled();

      // File should be overwritten
      const content = await testEnv.readFile('src/existing.ctx.md');
      expect(content).not.toContain('old content');
    });
  });

  describe('error handling', () => {
    it('should fail if project is not initialized', async () => {
      // Create new environment without init
      await testEnv.cleanup();
      testEnv = new TestEnvironment();
      await testEnv.setup();
      // Don't call initProject()

      await expect(async () => {
        await createCommand('.ctx/contexts/test.md', { force: true });
      }).rejects.toThrow('process.exit(1)');
    });

    it('should fail for global if global is not initialized', async () => {
      // Project is initialized but not global
      // Set HOME to a non-existent directory to ensure global is not initialized
      const originalHome = process.env.HOME;
      process.env.HOME = testEnv.getPath('nonexistent-home');

      try {
        await expect(async () => {
          await createCommand('contexts/test.md', { global: true, force: true });
        }).rejects.toThrow('process.exit(1)');
      } finally {
        process.env.HOME = originalHome;
      }
    });
  });

  describe('idempotency', () => {
    it('should produce same result when run multiple times with --force', async () => {
      // First run
      await createCommand('.ctx/contexts/test.md', { force: true });
      const firstContent = await testEnv.readFile('.ctx/contexts/test.md');

      // Second run
      await createCommand('.ctx/contexts/test.md', { force: true });
      const secondContent = await testEnv.readFile('.ctx/contexts/test.md');

      // Content should be identical
      expect(firstContent).toBe(secondContent);
    });

    it('should produce same result with target option', async () => {
      // First run
      await createCommand('src/api.ctx.md', { force: true, target: 'src/api.ts' });
      const firstContent = await testEnv.readFile('src/api.ctx.md');

      // Second run
      await createCommand('src/api.ctx.md', { force: true, target: 'src/api.ts' });
      const secondContent = await testEnv.readFile('src/api.ctx.md');

      // Content should be identical and contain target
      expect(firstContent).toBe(secondContent);
      expect(firstContent).toContain('target: src/api.ts');
    });

    it('should produce consistent global context structure', async () => {
      // Initialize global for this test
      await testEnv.initGlobal();

      // First run
      await createCommand('contexts/test-doc.md', { global: true, force: true });
      const firstContent = await testEnv.readFile('home/.ctx/contexts/test-doc.md');

      // Second run
      await createCommand('contexts/test-doc.md', { global: true, force: true });
      const secondContent = await testEnv.readFile('home/.ctx/contexts/test-doc.md');

      // Content structure should be identical
      expect(firstContent).toBe(secondContent);
    });
  });

  describe('Phase 2: auto-add pattern to context_paths', () => {
    it('should auto-add pattern when created file does not match existing patterns', async () => {
      const testFile = 'random/new-context.md';

      // Read initial registry
      const registryBefore = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      const initialPatternCount = registryBefore.settings?.context_paths?.length || 0;

      // Create file
      await createCommand(testFile, { force: true });

      // Read updated registry
      const registryAfter = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      const finalPatternCount = registryAfter.settings?.context_paths?.length || 0;

      // Verify pattern was added
      expect(finalPatternCount).toBe(initialPatternCount + 1);

      // Verify the specific pattern exists
      const hasPattern = registryAfter.settings?.context_paths?.some(
        (cp: any) => cp.path === testFile
      );
      expect(hasPattern).toBe(true);
    });

    it('should NOT add duplicate pattern if file already matches', async () => {
      // Add a pattern first
      let registry = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      if (!registry.settings) {
        registry.settings = { context_paths: [] };
      }
      registry.settings.context_paths.push({
        path: '.ctx/contexts/**/*.md',
        purpose: 'Project contexts'
      });
      await testEnv.createFile('.ctx/registry.yaml', YAML.stringify(registry));

      const patternCountBefore = registry.settings.context_paths.length;

      // Create file that matches the pattern
      await createCommand('.ctx/contexts/matching.md', { force: true });

      // Read updated registry
      const registryAfter = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      const patternCountAfter = registryAfter.settings?.context_paths?.length || 0;

      // Pattern count should NOT increase
      expect(patternCountAfter).toBe(patternCountBefore);
    });

    it('should auto-sync after adding pattern', async () => {
      const testFile = 'unmatched/test.md';

      await createCommand(testFile, { force: true });

      const registry = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));

      // Verify file is in registry after sync
      expect(registry.contexts[testFile]).toBeDefined();
      expect(registry.contexts[testFile].checksum).toBeDefined();
    });

    it('should work with global contexts too', async () => {
      await testEnv.initGlobal();

      const testFile = 'random-global.md';

      const registryBefore = YAML.parse(await testEnv.readFile('home/.ctx/registry.yaml'));
      const initialPatternCount = registryBefore.settings?.context_paths?.length || 0;

      await createCommand(testFile, { global: true, force: true });

      const registryAfter = YAML.parse(await testEnv.readFile('home/.ctx/registry.yaml'));
      const finalPatternCount = registryAfter.settings?.context_paths?.length || 0;

      // Verify pattern was added
      expect(finalPatternCount).toBe(initialPatternCount + 1);
    });
  });
});
