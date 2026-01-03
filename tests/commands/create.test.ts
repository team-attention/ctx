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

  describe('local context creation', () => {
    it('should create context file for a source file', async () => {
      // Create target source file
      await testEnv.createFile('src/services/payment.ts', 'export class Payment {}');

      await createCommand('src/services/payment.ts', { force: true });

      // Check context file was created
      expect(await testEnv.fileExists('src/services/payment.ctx.md')).toBe(true);
    });

    it('should create context file with correct template structure', async () => {
      await testEnv.createFile('src/utils/helpers.ts', 'export function help() {}');

      await createCommand('src/utils/helpers.ts', { force: true });

      const contextContent = await testEnv.readFile('src/utils/helpers.ctx.md');

      // Check for frontmatter markers
      expect(contextContent).toContain('---');
      expect(contextContent).toContain('target:');
      expect(contextContent).toContain('what:');
      expect(contextContent).toContain('when:');
    });

    it('should render template with absolute target path', async () => {
      await testEnv.createFile('src/models/user.ts', 'export interface User {}');

      await createCommand('src/models/user.ts', { force: true });

      const contextContent = await testEnv.readFile('src/models/user.ctx.md');

      // Target path should be absolute (starts with /)
      expect(contextContent).toContain('target: /src/models/user.ts');
    });

    it('should create context file for directory', async () => {
      await testEnv.createFile('src/api/.gitkeep', '');

      await createCommand('src/api/', { force: true });

      // For directories, context file is ctx.md inside the directory
      expect(await testEnv.fileExists('src/api/ctx.md')).toBe(true);
    });

    it('should create nested directories if they do not exist', async () => {
      // Don't create the directory structure
      // create command should handle it

      await createCommand('src/deeply/nested/path/file.ts', { force: true });

      // Context file should be created along with directories
      expect(await testEnv.fileExists('src/deeply/nested/path/file.ctx.md')).toBe(true);
    });

    it('should warn if target file does not exist but still create context', async () => {
      // Don't create target file

      await createCommand('src/nonexistent.ts', { force: true });

      // Context file should still be created
      expect(await testEnv.fileExists('src/nonexistent.ctx.md')).toBe(true);

      // Check console output for warning
      const output = consoleOutput.getOutput();
      const warningFound = output.log.some(log =>
        log.includes('Warning') && log.includes('does not exist')
      );
      expect(warningFound).toBe(true);
    });
  });

  describe('global context creation', () => {
    beforeEach(async () => {
      // Initialize global context for these tests
      await testEnv.initGlobal();
    });

    it('should create global context in ~/.ctx/contexts/ directory', async () => {
      await createCommand('architecture/caching', { global: true, force: true });

      // Should create in home/.ctx/contexts/ directory with .md extension
      expect(await testEnv.fileExists('home/.ctx/contexts/architecture/caching.md')).toBe(true);
    });

    it('should add .md extension if not present', async () => {
      await createCommand('architecture/database', { global: true, force: true });

      expect(await testEnv.fileExists('home/.ctx/contexts/architecture/database.md')).toBe(true);
    });

    it('should render template with document title', async () => {
      await createCommand('architecture/api-versioning', { global: true, force: true });

      const content = await testEnv.readFile('home/.ctx/contexts/architecture/api-versioning.md');

      // Check for frontmatter structure
      expect(content).toContain('---');
      expect(content).toContain('when:');
      expect(content).toContain('what:');

      // Document title should be rendered (converted from kebab-case)
      expect(content).toContain('# Api Versioning');
    });

    it('should create nested directories for global contexts', async () => {
      await createCommand('deep/nested/structure/doc', { global: true, force: true });

      expect(await testEnv.fileExists('home/.ctx/contexts/deep/nested/structure/doc.md')).toBe(true);
    });
  });

  describe('file overwrite handling', () => {
    beforeEach(async () => {
      // Create existing context file
      await testEnv.createFile(
        'src/existing.ctx.md',
        '---\ntarget: /src/existing.ts\nwhat: old content\nwhen:\n  - test\n---\n\n# Old Content'
      );
    });

    it('should prompt for confirmation when file exists without --force', async () => {
      // Mock user declining overwrite
      mockPrompt.mockResolvedValueOnce({ overwrite: false });

      await createCommand('src/existing.ts', {}); // No force flag

      // Should have prompted
      expect(mockPrompt).toHaveBeenCalled();

      // Original content should remain
      const content = await testEnv.readFile('src/existing.ctx.md');
      expect(content).toContain('old content');
    });

    it('should overwrite with --force flag without prompting', async () => {
      await createCommand('src/existing.ts', { force: true });

      // Should not have prompted
      expect(mockPrompt).not.toHaveBeenCalled();

      // File should be overwritten (no longer contains old content)
      const content = await testEnv.readFile('src/existing.ctx.md');
      expect(content).not.toContain('old content');
      expect(content).toContain('Brief description');
    });

    it('should overwrite if user confirms prompt', async () => {
      // Mock user confirming overwrite
      mockPrompt.mockResolvedValueOnce({ overwrite: true });

      await createCommand('src/existing.ts', {});

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
        await createCommand('src/test.ts', { force: true });
      }).rejects.toThrow('process.exit(1)');
    });

    it('should handle empty target path gracefully', async () => {
      // Empty path creates .ctx.md in project root (or returns early)
      // This behavior is acceptable - no crash
      await createCommand('', { force: true });
      // Test passes if no exception thrown
    });
  });

  describe('idempotency', () => {
    it('should produce same result when run multiple times with --force', async () => {
      await testEnv.createFile('src/test.ts', 'export class Test {}');

      // First run
      await createCommand('src/test.ts', { force: true });
      const firstContent = await testEnv.readFile('src/test.ctx.md');

      // Second run
      await createCommand('src/test.ts', { force: true });
      const secondContent = await testEnv.readFile('src/test.ctx.md');

      // Content should be identical
      expect(firstContent).toBe(secondContent);
      expect(firstContent).toContain('target: /src/test.ts');
    });

    it('should produce consistent global context structure', async () => {
      // Initialize global for this test
      await testEnv.initGlobal();

      // First run
      await createCommand('test-doc', { global: true, force: true });
      const firstContent = await testEnv.readFile('home/.ctx/contexts/test-doc.md');

      // Second run
      await createCommand('test-doc', { global: true, force: true });
      const secondContent = await testEnv.readFile('home/.ctx/contexts/test-doc.md');

      // Content structure should be identical
      expect(firstContent.split('\n').slice(0, 10)).toEqual(
        secondContent.split('\n').slice(0, 10)
      );
    });
  });
});
