import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestEnvironment, suppressConsole } from '../helpers/testUtils.js';

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
      expect(contextContent).toContain('when:');
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
      expect(content).toContain('when:');
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
        '---\ntarget: src/existing.ts\nwhat: old content\nwhen:\n  - test\n---\n\n# Old Content'
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
});
